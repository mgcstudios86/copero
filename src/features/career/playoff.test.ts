import { describe, expect, it } from 'vitest';
import {
  PLAYOFF_START_WEEK,
  PLAYOFF_TEAMS,
  advancePlayoffRound,
  bracketChampion,
  buildPlayoffBracket,
  resolvePlayoffMatch,
  type BracketRng,
} from './playoff';

/** Mulberry32 trivial — determinista, suficiente para tests. */
function makeRng(seed: number): BracketRng {
  let s = seed >>> 0;
  return {
    int: (min: number, max: number) => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      const r = ((t ^ (t >>> 14)) >>> 0) % (max - min + 1);
      return min + r;
    },
  };
}

describe('MGC-487 — playoff bracket generator', () => {
  it('construye cuartos con sembrado 1v8, 2v7, 3v6, 4v5', () => {
    const seeded = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const bracket = buildPlayoffBracket(seeded, makeRng(1));

    expect(bracket).toHaveLength(4);
    expect(bracket[0]).toMatchObject({ home: 'A', away: 'H', slot: 0 });
    expect(bracket[1]).toMatchObject({ home: 'B', away: 'G', slot: 1 });
    expect(bracket[2]).toMatchObject({ home: 'C', away: 'F', slot: 2 });
    expect(bracket[3]).toMatchObject({ home: 'D', away: 'E', slot: 3 });
    expect(bracket[0].round).toBe('quarter');
    expect(bracket[0].week).toBe(PLAYOFF_START_WEEK);
  });

  it('padding con BYE si hay menos de 8 equipos', () => {
    const seeded = ['A', 'B', 'C', 'D', 'E', 'F'];
    const bracket = buildPlayoffBracket(seeded, makeRng(1));

    // Sembrado 1v8 → A vs BYE-8 (A gana por bye), B vs BYE-7 (B gana).
    // C vs BYE-6 (C gana por bye), D vs E (partido real, winner=null).
    const aBye = bracket.find((m) => m.home === 'A' && m.away === 'BYE-8')!;
    expect(aBye.winner).toBe('A');
    const bBye = bracket.find((m) => m.home === 'B' && m.away === 'BYE-7')!;
    expect(bBye.winner).toBe('B');
    const dVsE = bracket.find((m) => m.home === 'D' && m.away === 'E')!;
    expect(dVsE.winner).toBeNull();
  });

  it('lanza si hay menos de 4 equipos', () => {
    expect(() => buildPlayoffBracket(['A', 'B'], makeRng(1))).toThrow();
  });

  it('resolvePlayoffMatch respeta winner precomputado (BYE)', () => {
    const bracket = buildPlayoffBracket(['A', 'B', 'C', 'D', 'E', 'F'], makeRng(1));
    const cMatch = bracket.find((m) => m.home === 'C' && m.away === 'F')!;
    expect(cMatch.winner).toBeNull();
    // Simular resolución con RNG (50/50) y verificar que devuelve el winner.
    const winner = resolvePlayoffMatch(cMatch, makeRng(99));
    expect(['C', 'F']).toContain(winner);
    const byeMatch = bracket.find((m) => m.home === 'A' && m.away === 'BYE-8')!;
    expect(byeMatch.winner).toBe('A');
    expect(resolvePlayoffMatch(byeMatch, makeRng(1))).toBe('A');
  });

  it('resolvePlayoffMatch consume RNG cuando winner es null', () => {
    const bracket = buildPlayoffBracket(
      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      makeRng(1),
    );
    expect(bracket.every((m) => m.winner === null)).toBe(true);
    const match = bracket[0];
    const winner = resolvePlayoffMatch(match, makeRng(1));
    expect([match.home, match.away]).toContain(winner);
  });

  it('advancePlayoffRound crea semis desde cuartos resueltos', () => {
    const quarters = buildPlayoffBracket(['A', 'B', 'C', 'D'], makeRng(1))
      .map((m) => ({ ...m, winner: resolvePlayoffMatch(m, makeRng(7)) }));
    const next = advancePlayoffRound(quarters, makeRng(7));

    const semis = next.filter((m) => m.round === 'semi');
    expect(semis).toHaveLength(2);
    expect(semis[0].home).toBe(quarters[0].winner);
    expect(semis[0].away).toBe(quarters[1].winner);
  });

  it('advancePlayoffRound crea final desde semis', () => {
    const quarters = buildPlayoffBracket(['A', 'B', 'C', 'D'], makeRng(1))
      .map((m) => ({ ...m, winner: resolvePlayoffMatch(m, makeRng(7)) }));
    const semis = advancePlayoffRound(quarters, makeRng(7))
      .filter((m) => m.round === 'semi')
      .map((m) => ({ ...m, winner: resolvePlayoffMatch(m, makeRng(11)) }));
    const next = advancePlayoffRound([...quarters, ...semis], makeRng(11));

    const finalMatch = next.find((m) => m.round === 'final');
    expect(finalMatch).toBeDefined();
    expect(finalMatch!.home).toBe(semis[0].winner);
    expect(finalMatch!.away).toBe(semis[1].winner);
  });

  it('bracketChampion devuelve null hasta resolver la final', () => {
    const quarters = buildPlayoffBracket(['A', 'B', 'C', 'D'], makeRng(1))
      .map((m) => ({ ...m, winner: resolvePlayoffMatch(m, makeRng(7)) }));
    expect(bracketChampion(quarters)).toBeNull();
  });

  it('bracketChampion devuelve el ganador de la final', () => {
    type Slot = { winner: string; round: 'quarter' | 'semi' | 'final'; week: number; slot: number; home: string; away: string };
    let bracket: Slot[] = buildPlayoffBracket(['A', 'B', 'C', 'D'], makeRng(1))
      .map((m) => ({ ...m, winner: resolvePlayoffMatch(m, makeRng(7)) }));
    bracket = advancePlayoffRound(bracket, makeRng(7)) as Slot[];
    const semis: Slot[] = bracket.filter((m) => m.round === 'semi')
      .map((m) => ({ ...m, winner: resolvePlayoffMatch(m, makeRng(11)) }));
    bracket = advancePlayoffRound(
      [...bracket.filter((m) => m.round !== 'semi'), ...semis] as Slot[],
      makeRng(11),
    ) as Slot[];
    const finalMatch = bracket.find((m) => m.round === 'final')!;
    finalMatch.winner = resolvePlayoffMatch(finalMatch, makeRng(13));
    expect(bracketChampion(bracket)).toBe(finalMatch.winner);
  });

  it('PLAYOFF_TEAMS = 8 por contrato de spec Step 4', () => {
    expect(PLAYOFF_TEAMS).toBe(8);
  });
});

describe('MGC-487.2 — playoff integration with resolveMatch (OVR-weighted)', () => {
  // Catálogo ACADEMY_CLUBS:
  //   Boca Juniors      → reputation 5 → OVR 99
  //   River Plate       → reputation 5 → OVR 99
  //   Vélez Sarsfield   → reputation 4 → OVR 80
  //   Temperley         → reputation 2 → OVR 40
  //   Morón             → reputation 1 → OVR 20
  const TOP = 'Boca Juniors';
  const MID = 'Vélez Sarsfield';
  const LOW = 'Morón';
  const makeMatch = (home: string, away: string) => ({
    round: 'quarter' as const,
    week: 35,
    slot: 0,
    home,
    away,
    winner: null as string | null,
  });

  it('mismo seed + mismos clubes produce mismo ganador (determinista)', () => {
    const m = makeMatch(TOP, LOW);
    const winnerA = resolvePlayoffMatch(m, makeRng(42));
    const winnerB = resolvePlayoffMatch(m, makeRng(42));
    expect(winnerA).toBe(winnerB);
    // Diff OVR ≈ 80 → Boca gana de forma estable (no 50/50).
    expect(winnerA).toBe(TOP);
  });

  it('club de mayor reputación gana de forma estable sobre corridas (no 50/50)', () => {
    let topWins = 0;
    let lowWins = 0;
    const runs = 200;
    for (let seed = 1; seed <= runs; seed += 1) {
      const w = resolvePlayoffMatch(makeMatch(TOP, LOW), makeRng(seed));
      if (w === TOP) topWins += 1;
      else if (w === LOW) lowWins += 1;
    }
    // Diff OVR=80 ⇒ Boca gana la enorme mayoría de las corridas.
    expect(topWins).toBeGreaterThan(0.85 * runs);
    expect(lowWins).toBeLessThan(0.15 * runs);
    expect(topWins + lowWins).toBe(runs); // siempre uno de los dos.
  });

  it('clubes de misma reputación: empate técnico → resultado determinista por RNG', () => {
    // MID vs MID (mismo OVR=80): ambos lados reciben el mismo score base,
    // por lo que la diferencia de luck cae dentro del epsilon del float.
    // El bracket cae al tie-break (home-advantage determinista vía
    // rng.int(0,1)), que debe ser reproducible para misma seed.
    const m = makeMatch(MID, MID);
    const seenWinners = new Set<string>();
    for (let seed = 1; seed <= 30; seed += 1) {
      seenWinners.add(resolvePlayoffMatch(m, makeRng(seed)));
    }
    // Con misma reputación, el winner es siempre uno de los dos lados.
    for (const w of seenWinners) {
      expect([m.home, m.away]).toContain(w);
    }
    // Misma seed + mismo bracket → mismo winner (contrato determinista).
    expect(resolvePlayoffMatch(m, makeRng(7))).toBe(
      resolvePlayoffMatch(m, makeRng(7)),
    );
  });

  it('diferencia intermedia (rep=4 vs rep=2) favorece al más fuerte', () => {
    // Temperley (rep=2) vs Vélez (rep=4): diff OVR=40 ⇒ ventaja clara
    // pero no aplastante. Vélez gana > 70% de las corridas.
    let midWins = 0;
    const runs = 200;
    for (let seed = 1; seed <= runs; seed += 1) {
      const w = resolvePlayoffMatch(
        makeMatch('Vélez Sarsfield', 'Temperley'),
        makeRng(seed),
      );
      if (w === 'Vélez Sarsfield') midWins += 1;
    }
    expect(midWins).toBeGreaterThan(0.7 * runs);
  });

  it('bye no consume RNG: misma seed produce mismo resultado antes y después', () => {
    const bracket = buildPlayoffBracket([TOP, MID, MID, MID], makeRng(1));
    const byeMatch = bracket.find((m) => m.winner !== null && m.away.startsWith('BYE-'))!;
    expect(byeMatch.winner).not.toBeNull();
    const before = byeMatch.winner;
    // Re-resolver con un RNG distinto no debe cambiar el resultado de BYE.
    expect(resolvePlayoffMatch(byeMatch, makeRng(999))).toBe(before);
  });

  it('club desconocido cae al fallback 50/50 sin invocar resolveMatch', () => {
    // Strings arbitrarios no presentes en ACADEMY_CLUBS.
    const m = makeMatch('Unknown A', 'Unknown B');
    let homeWins = 0;
    const runs = 200;
    for (let seed = 1; seed <= runs; seed += 1) {
      const w = resolvePlayoffMatch(m, makeRng(seed));
      if (w === 'Unknown A') homeWins += 1;
    }
    // 50/50 ±15% (rng.int(0,1) puro, sin ponderación por OVR).
    expect(Math.abs(homeWins - runs / 2)).toBeLessThan(0.15 * runs);
  });

  it('bracket completo es determinista: misma seed produce mismo campeón', () => {
    const seeded = [TOP, MID, MID, LOW, LOW, MID, MID, TOP];
    const run = (seed: number): string | null => {
      let bracket = buildPlayoffBracket(seeded, makeRng(seed));
      for (let round = 0; round < 3; round += 1) {
        bracket = advancePlayoffRound(bracket, makeRng(seed + round * 31));
      }
      return bracketChampion(bracket);
    };
    expect(run(7)).toBe(run(7));
  });
});
