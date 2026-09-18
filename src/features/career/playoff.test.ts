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
