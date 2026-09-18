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
 *
 * MGC-585: `generate(input, snapshot)` consume snapshot y devuelve
 * `{ bracket, snapshot }`. ADR-0016 D1/D3.
 */

import { describe, expect, it, beforeEach } from 'vitest';

import {
  COPA_DEFAULT_SIZE,
  COPA_FALLBACK_SIZE,
  COPA_MIN_SIZE,
  generate,
  generateFresh,
  resolveBracketSize,
  roundsFor,
  serialize as serializeBracket,
} from '../CopaBracket';
import {
  create,
  createRngFromSnapshot,
  deserialize,
  fingerprint,
  nextFloat,
  nextInt,
  nextPick,
  serialize as serializeSnapshot,
  type RngSnapshot,
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

describe('CopaBracket — generate (MGC-585 / ADR-0016 D3)', () => {
  it('produces a complete 32-team bracket with 5 rounds', () => {
    const { bracket, snapshot } = generateFresh({
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
    // D3: el snapshot devuelto debe tener exactamente 1 draw consumido
    // (rngInt(0, 0) al consumir el snapshot). cursor monotónico.
    expect(snapshot.draws).toBe(1);
    expect(snapshot.seed).toBe('seed-32');
  });

  it('throws when playerTeamId is not in teamIds', () => {
    expect(() =>
      generateFresh({
        seed: 'bad',
        teamIds: makeTeams(8),
        playerTeamId: 'team-99',
      }),
    ).toThrow(/no está en teamIds/);
  });

  it('gate #1: 17 teams produces a 16-bracket with fallbackToSixteen=true', () => {
    const { bracket } = generateFresh({
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
    const { bracket } = generateFresh({
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

  it('consumes the provided snapshot and advances its cursor (ADR-0016 D1/D3)', () => {
    const seed = 'consumed';
    const inputSnap = create(seed);
    const result = generate(
      {
        seed,
        teamIds: makeTeams(16),
        playerTeamId: 'team-1',
      },
      inputSnap,
    );
    // El snapshot devuelto es uno nuevo (state y draws actualizados);
    // el de entrada queda intacto.
    expect(inputSnap.draws).toBe(0);
    expect(result.snapshot.draws).toBe(1);
    expect(result.snapshot.seed).toBe(seed);
    // El bracket.seed debe matchear el snapshot.seed (snapshot gana).
    expect(result.bracket.seed).toBe(seed);
  });

  it('two generate() calls with same snapshot input produce identical brackets', () => {
    const snap = create('idem-snap');
    const input = {
      seed: 'idem-snap',
      teamIds: makeTeams(32),
      playerTeamId: 'team-1',
      rankingPosition: 1,
    };
    const a = serializeBracket(generate(input, snap).bracket);
    const b = serializeBracket(generate(input, snap).bracket);
    expect(a).toBe(b);
  });
});

describe('RngSnapshot — createRngFromSnapshot (ADR-0016 D1)', () => {
  it('returns an instance whose rngInt consumes 1 draw per call', () => {
    const snap = create('d1');
    const rng = createRngFromSnapshot(snap);
    const r1 = rng.rngInt(0, 10);
    expect(r1.value).toBeGreaterThanOrEqual(0);
    expect(r1.value).toBeLessThanOrEqual(10);
    expect(r1.snap.draws).toBe(1);
    // El snapshot original queda intacto (readonly + closure).
    expect(snap.draws).toBe(0);
  });

  it('rngFloat returns [0,1) and advances the cursor', () => {
    const rng = createRngFromSnapshot(create('flu'));
    const r = rng.rngFloat();
    expect(r.value).toBeGreaterThanOrEqual(0);
    expect(r.value).toBeLessThan(1);
    expect(r.snap.draws).toBe(1);
  });

  it('rngPick returns an item and advances the cursor', () => {
    const rng = createRngFromSnapshot(create('pick'));
    const r = rng.rngPick(['x', 'y', 'z']);
    expect(['x', 'y', 'z']).toContain(r.value);
    expect(r.snap.draws).toBe(1);
  });

  it('rebuilding the rng from a previous result continues monotonically', () => {
    const snap0 = create('chain');
    const rng1 = createRngFromSnapshot(snap0);
    const r1 = rng1.rngInt(0, 100);
    // Propagamos el snap manualmente.
    const rng2 = createRngFromSnapshot(r1.snap);
    const r2 = rng2.rngInt(0, 100);
    expect(r1.snap.draws).toBe(1);
    expect(r2.snap.draws).toBe(2);
  });
});

describe('AC8 — determinism: 100 iter same seed → byte-equal', () => {
  it('serialize(bracket) is byte-equal across 100 iterations (seed=ac8-32)', () => {
    const seed = 'ac8-32';
    const teamIds = makeTeams(32);
    const reference = serializeBracket(
      generateFresh({ seed, teamIds, playerTeamId: 'team-1', rankingPosition: 1 })
        .bracket,
    );
    for (let i = 0; i < 100; i += 1) {
      const current = serializeBracket(
        generateFresh({
          seed,
          teamIds,
          playerTeamId: 'team-1',
          rankingPosition: 1,
        }).bracket,
      );
      expect(current).toBe(reference);
    }
  });

  it('serialize(bracket) is byte-equal across 100 iterations with fallback (17 teams)', () => {
    const seed = 'ac8-fallback';
    const teamIds = makeTeams(17);
    const reference = serializeBracket(
      generateFresh({ seed, teamIds, playerTeamId: 'team-1' }).bracket,
    );
    for (let i = 0; i < 100; i += 1) {
      const current = serializeBracket(
        generateFresh({ seed, teamIds, playerTeamId: 'team-1' }).bracket,
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

  it('generate returns an updated snapshot whose fingerprint is byte-equal across 100 iterations', () => {
    const seed = 'ac8-snap';
    const teamIds = makeTeams(32);
    const refSnap = generate({
      seed,
      teamIds,
      playerTeamId: 'team-1',
      rankingPosition: 1,
    }, create(seed)).snapshot;
    const refFp = fingerprint(refSnap);
    for (let i = 0; i < 100; i += 1) {
      const { snapshot } = generate(
        {
          seed,
          teamIds,
          playerTeamId: 'team-1',
          rankingPosition: 1,
        },
        create(seed),
      );
      expect(fingerprint(snapshot)).toBe(refFp);
    }
  });

  it('different seed produces different bracket', () => {
    const teamIds = makeTeams(32);
    const a = serializeBracket(
      generateFresh({ seed: 'a', teamIds, playerTeamId: 'team-1' }).bracket,
    );
    const b = serializeBracket(
      generateFresh({ seed: 'b', teamIds, playerTeamId: 'team-1' }).bracket,
    );
    expect(a).not.toBe(b);
  });

  it('player seeding position affects bracket when rankingPosition differs', () => {
    const teamIds = makeTeams(32);
    const top = serializeBracket(
      generateFresh({
        seed: 'fixed',
        teamIds,
        playerTeamId: 'team-1',
        rankingPosition: 1,
      }).bracket,
    );
    const mid = serializeBracket(
      generateFresh({
        seed: 'fixed',
        teamIds,
        playerTeamId: 'team-1',
        rankingPosition: 16,
      }).bracket,
    );
    expect(top).not.toBe(mid);
  });
});

function advanceSnap(snap: RngSnapshot, steps: number): RngSnapshot {
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

  it('snapshot properties are readonly (TypeScript-level opacidad)', () => {
    const snap = create('ro');
    // @ts-expect-error — state es readonly; cualquier intento de mutación
    // es un error de compilación. Si el test corre, es que alguien quitó
    // el `readonly` del tipo RngSnapshot. ADR-0016 D1.
    snap.state = 0;
    expect(snap.state).not.toBe(0);
  });
});

describe('Copa persistence — in-memory fallback', () => {
  beforeEach(async () => {
    __resetCopaStorageForTests();
    await clearCopaState();
  });

  it('returns ok=true after save and ok=true with state on load', async () => {
    const { bracket } = generateFresh({
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
    const { bracket } = generateFresh({
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

describe('i18n — fallbackNoticeBody no menciona gates internas (MGC-585 #4)', () => {
  for (const locale of SUPPORTED_LOCALES) {
    it(`locale=${locale} fallbackNoticeBody copy neutro (sin "gate #1" / "17–31")`, () => {
      const body: string = COPY[locale as Locale].copa.fallbackNoticeBody;
      // No debe exponer el lenguaje interno de ADR/gate al usuario.
      expect(body.toLowerCase()).not.toMatch(/gate/);
      // El copy debe ser explicativo sin enumerar el rango exacto (17-31)
      // como discriminador interno — el ajuste se describe en lenguaje
      // de producto ("menos equipos", "potencia de 2 más cercana").
      expect(body).not.toMatch(/\b17\s*[-–—]\s*31\b/);
      expect(body).toMatch(/\{teams\}/);
    });
  }
});

describe('AC8 — module-internal invariants', () => {
  it('uses the documented AsyncStorage key', () => {
    expect(COPA_STORAGE_KEY).toBe('copero.copa.v1');
  });
});