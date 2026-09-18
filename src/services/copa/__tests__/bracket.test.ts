/**
 * AC8 — CopaBracket determinism + RngSnapshot byte-equal (MGC-497).
 *
 * Cubre:
 *   - 100 iteraciones con misma seed → mismo `serialized(bracket)` byte-equal.
 *   - Misma seed con diferente ranking del jugador → distinto bracket
 *     (cambia la siembra).
 *   - Distinta seed → distinto bracket (sanity).
 *   - 32 equipos con jugador top-seed → bracket completo, 5 rondas.
 *   - Fallback explícito a 16 cuando hay entre 17 y 31 inscritos (gate #1).
 *   - Fallback a 8 / 4 cuando hay menos.
 *   - RngSnapshot.serialize/deserialize round-trip preserva estado.
 *   - RngSnapshot.fingerprint byte-equal con misma seed/draws.
 *   - Persistencia AsyncStorage: fallback en memoria funciona vitest.
 *   - i18n: namespace `copa` está poblado en los 4 locales.
 */

import { describe, expect, it, beforeEach } from 'vitest';

import {
  COPA_DEFAULT_SIZE,
  COPA_FALLBACK_SIZE,
  COPA_MIN_SIZE,
  generate,
  resolveBracketSize,
  roundsFor,
  serialize as serializeBracket,
  type CopaBracket,
} from '../CopaBracket';
import {
  create,
  deserialize,
  fingerprint,
  nextFloat,
  nextInt,
  nextPick,
  serialize as serializeSnapshot,
} from '../RngSnapshot';
import {
  COPA_STORAGE_KEY,
  __resetCopaStorageForTests,
  clearCopaState,
  loadCopaState,
  saveCopaState,
} from '../persistence';
import { COPY, SUPPORTED_LOCALES, type Locale } from '@/i18n/copy';

function makeTeams(count: number, prefix = 'team'): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}-${i + 1}`);
}

describe('CopaBracket — resolveBracketSize', () => {
  it('returns 32 when there are 32+ teams', () => {
    expect(resolveBracketSize(32).size).toBe(32);
    expect(resolveBracketSize(50).size).toBe(32);
    expect(resolveBracketSize(32).usedFallback).toBe(false);
  });

  it('gate #1: falls back to 16 when 17–31 teams sign up', () => {
    for (const n of [17, 20, 24, 28, 31]) {
      const r = resolveBracketSize(n);
      expect(r.size).toBe(COPA_FALLBACK_SIZE);
      expect(r.fallbackToSixteen).toBe(true);
      expect(r.usedFallback).toBe(true);
    }
  });

  it('uses 16 naturally when there are 9–16 teams', () => {
    for (const n of [9, 10, 12, 15, 16]) {
      const r = resolveBracketSize(n);
      expect(r.size).toBe(16);
      expect(r.fallbackToSixteen).toBe(false);
    }
  });

  it('falls back to 8 when there are 5–8 teams', () => {
    for (const n of [5, 6, 7, 8]) {
      expect(resolveBracketSize(n).size).toBe(8);
    }
  });

  it('falls back to the minimum 4 when there are exactly 4 teams', () => {
    expect(resolveBracketSize(4).size).toBe(COPA_MIN_SIZE);
  });

  it('throws when there are fewer than 4 teams', () => {
    expect(() => resolveBracketSize(3)).toThrow();
    expect(() => resolveBracketSize(0)).toThrow();
  });
});

describe('CopaBracket — generate', () => {
  it('produces a complete 32-team bracket with 5 rounds', () => {
    const bracket = generate({
      seed: 'seed-32',
      teamIds: makeTeams(32),
      playerTeamId: 'team-1',
      rankingPosition: 1,
    });
    expect(bracket.size).toBe(COPA_DEFAULT_SIZE);
    expect(bracket.rounds).toBe(5);
    expect(roundsFor(32)).toBe(5);
    expect(bracket.usedFallback).toBe(false);
    expect(bracket.round).toHaveLength(5);
    expect(bracket.round[0].matches).toHaveLength(16);
    expect(bracket.round[1].matches).toHaveLength(8);
    expect(bracket.round[2].matches).toHaveLength(4);
    expect(bracket.round[3].matches).toHaveLength(2);
    expect(bracket.round[4].matches).toHaveLength(1);
    expect(bracket.finalMatchId).toBe(bracket.round[4].matches[0].id);
  });

  it('throws when playerTeamId is not in teamIds', () => {
    expect(() =>
      generate({
        seed: 'bad',
        teamIds: makeTeams(8),
        playerTeamId: 'team-99',
      }),
    ).toThrow(/no está en teamIds/);
  });

  it('gate #1: 17 teams produces a 16-bracket with fallbackToSixteen=true', () => {
    const bracket = generate({
      seed: 'gate1',
      teamIds: makeTeams(17),
      playerTeamId: 'team-1',
      rankingPosition: 1,
    });
    expect(bracket.size).toBe(16);
    expect(bracket.fallbackToSixteen).toBe(true);
    expect(bracket.usedFallback).toBe(true);
    // 16 equipos = 4 rondas
    expect(bracket.rounds).toBe(4);
    expect(bracket.round[0].matches).toHaveLength(8);
  });

  it('links each match to its next round slot', () => {
    const bracket = generate({
      seed: 'links',
      teamIds: makeTeams(32),
      playerTeamId: 'team-1',
    });
    for (let r = 0; r < bracket.rounds - 1; r += 1) {
      const round = bracket.round[r];
      round.matches.forEach((match, mIdx) => {
        expect(match.nextMatchId).not.toBeNull();
        expect(match.nextSlot).not.toBeNull();
        const expectedNextMatch =
          bracket.round[r + 1].matches[Math.floor(mIdx / 2)];
        expect(match.nextMatchId).toBe(expectedNextMatch.id);
        expect(match.nextSlot).toBe(mIdx % 2 === 0 ? 0 : 1);
      });
    }
    // La final no apunta a nada.
    const finalMatch = bracket.round[bracket.rounds - 1].matches[0];
    expect(finalMatch.nextMatchId).toBeNull();
    expect(finalMatch.nextSlot).toBeNull();
  });
});

describe('AC8 — determinism: 100 iter same seed → byte-equal', () => {
  it('serialize(bracket) is byte-equal across 100 iterations (seed=ac8-32)', () => {
    const seed = 'ac8-32';
    const teamIds = makeTeams(32);
    const reference = serializeBracket(
      generate({ seed, teamIds, playerTeamId: 'team-1', rankingPosition: 1 }),
    );
    for (let i = 0; i < 100; i += 1) {
      const current = serializeBracket(
        generate({
          seed,
          teamIds,
          playerTeamId: 'team-1',
          rankingPosition: 1,
        }),
      );
      expect(current).toBe(reference);
    }
  });

  it('serialize(bracket) is byte-equal across 100 iterations with fallback (17 teams)', () => {
    const seed = 'ac8-fallback';
    const teamIds = makeTeams(17);
    const reference = serializeBracket(
      generate({ seed, teamIds, playerTeamId: 'team-1' }),
    );
    for (let i = 0; i < 100; i += 1) {
      const current = serializeBracket(
        generate({ seed, teamIds, playerTeamId: 'team-1' }),
      );
      expect(current).toBe(reference);
    }
  });

  it('RngSnapshot.fingerprint is byte-equal across 100 iterations', () => {
    const seed = 'ac8-fp';
    const ref = fingerprint(advanceSnap(create(seed), 7));
    for (let i = 0; i < 100; i += 1) {
      const snap = advanceSnap(create(seed), 7);
      expect(fingerprint(snap)).toBe(ref);
    }
  });

  it('different seed produces different bracket', () => {
    const teamIds = makeTeams(32);
    const a = serializeBracket(
      generate({ seed: 'a', teamIds, playerTeamId: 'team-1' }),
    );
    const b = serializeBracket(
      generate({ seed: 'b', teamIds, playerTeamId: 'team-1' }),
    );
    expect(a).not.toBe(b);
  });

  it('player seeding position affects bracket when rankingPosition differs', () => {
    const teamIds = makeTeams(32);
    const top = serializeBracket(
      generate({
        seed: 'fixed',
        teamIds,
        playerTeamId: 'team-1',
        rankingPosition: 1,
      }),
    );
    const mid = serializeBracket(
      generate({
        seed: 'fixed',
        teamIds,
        playerTeamId: 'team-1',
        rankingPosition: 16,
      }),
    );
    expect(top).not.toBe(mid);
  });
});

function advanceSnap(snap: ReturnType<typeof create>, steps: number) {
  let cur = snap;
  for (let i = 0; i < steps; i += 1) {
    cur = nextInt(cur, 0, 100).snap;
  }
  return cur;
}

describe('RngSnapshot — primitives', () => {
  it('nextInt / nextFloat / nextPick advance state and return expected ranges', () => {
    const snap0 = create('primitives');
    const a = nextInt(snap0, 0, 10);
    expect(a.value).toBeGreaterThanOrEqual(0);
    expect(a.value).toBeLessThanOrEqual(10);
    expect(a.snap.state).not.toBe(snap0.state);
    expect(a.snap.draws).toBe(snap0.draws + 1);

    const b = nextFloat(a.snap);
    expect(b.value).toBeGreaterThanOrEqual(0);
    expect(b.value).toBeLessThan(1);

    const c = nextPick(b.snap, ['x', 'y', 'z']);
    expect(['x', 'y', 'z']).toContain(c.value);
    expect(c.snap.draws).toBe(b.snap.draws + 1);
  });

  it('serialize / deserialize round-trip preserves state', () => {
    const original = advanceSnap(create('roundtrip'), 5);
    const json = serializeSnapshot(original);
    const restored = deserialize(json);
    expect(restored.seed).toBe(original.seed);
    expect(restored.state).toBe(original.state);
    expect(restored.draws).toBe(original.draws);
    expect(fingerprint(restored)).toBe(fingerprint(original));
  });

  it('deserialize rejects bad version', () => {
    const bad = JSON.stringify({ v: 99, seed: 'x', state: 0, draws: 0 });
    expect(() => deserialize(bad)).toThrow(/versión 99/);
  });

  it('deserialize rejects malformed JSON', () => {
    expect(() => deserialize('{not-json')).toThrow(/JSON inválido/);
  });
});

describe('Copa persistence — in-memory fallback', () => {
  beforeEach(async () => {
    __resetCopaStorageForTests();
    await clearCopaState();
  });

  it('returns ok=true after save and ok=true with state on load', async () => {
    const bracket: CopaBracket = generate({
      seed: 'persist',
      teamIds: makeTeams(32),
      playerTeamId: 'team-1',
    });
    const saveResult = await saveCopaState(bracket);
    expect(saveResult.ok).toBe(true);

    const loadResult = await loadCopaState();
    expect(loadResult.ok).toBe(true);
    if (loadResult.ok) {
      expect(loadResult.state.bracket.size).toBe(32);
      expect(loadResult.state.bracket.seed).toBe('persist');
      expect(loadResult.state.v).toBe(1);
      expect(typeof loadResult.state.savedAt).toBe('number');
    }
  });

  it('returns empty when the key is missing', async () => {
    const loadResult = await loadCopaState();
    expect(loadResult.ok).toBe(false);
    if (!loadResult.ok) {
      expect(loadResult.reason).toBe('empty');
    }
  });

  it('clearCopaState removes the persisted bracket', async () => {
    const bracket = generate({
      seed: 'to-clear',
      teamIds: makeTeams(16),
      playerTeamId: 'team-1',
    });
    await saveCopaState(bracket);
    await clearCopaState();
    const loadResult = await loadCopaState();
    expect(loadResult.ok).toBe(false);
  });
});

describe('i18n — copa namespace is populated for all 4 locales', () => {
  for (const locale of SUPPORTED_LOCALES) {
    it(`locale=${locale} has all required copa keys`, () => {
      const copy = COPY[locale as Locale];
      expect(copy).toBeDefined();
      expect(copy.copa).toBeDefined();
      const required = [
        'bannerTitle',
        'bannerBody',
        'bannerCta',
        'inscriptionTitle',
        'bracketTitle',
        'round32',
        'round16',
        'round8',
        'semifinal',
        'final',
        'fallbackNoticeTitle',
        'fallbackNoticeBody',
        'championTitle',
        'championBadge',
        'eliminatedTitle',
        'slotEmpty',
        'slotActive',
      ] as const;
      for (const key of required) {
        expect(copy.copa[key]).toBeTypeOf('string');
        expect(copy.copa[key].length).toBeGreaterThan(0);
      }
    });
  }
});

describe('AC8 — module-internal invariants', () => {
  it('uses the documented AsyncStorage key', () => {
    expect(COPA_STORAGE_KEY).toBe('copero.copa.v1');
  });
});
