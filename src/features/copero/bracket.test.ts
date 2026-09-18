/**
 * Tests unitarios del generador de bracket — MGC-490.
 *
 * Cubre:
 *  - determinismo (mismo seed → mismo bracket)
 *  - byes automáticos cuando teams < 32
 *  - size según potencia de 2 más cercana
 *  - applyResult propaga al siguiente round
 *  - isBracketComplete y getChampion
 *  - shape estable: 5 rondas, sizes [16, 8, 4, 2, 1]
 */

import { describe, expect, it } from 'vitest';
import {
  applyResult,
  generateBracket,
  getChampion,
  isBracketComplete,
  PHASE_ORDER,
  seedRandom,
} from './bracket';

const TEAMS_32 = Array.from({ length: 32 }, (_, i) => `T${i + 1}`);
const TEAMS_16 = Array.from({ length: 16 }, (_, i) => `T${i + 1}`);
const TEAMS_7 = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

describe('generateBracket', () => {
  it('builds 5 rounds for a full 32-team field', () => {
    const b = generateBracket(TEAMS_32, 'seed-A');
    expect(b.rounds.round_of_32).toHaveLength(16);
    expect(b.rounds.round_of_16).toHaveLength(8);
    expect(b.rounds.quarterfinal).toHaveLength(4);
    expect(b.rounds.semifinal).toHaveLength(2);
    expect(b.rounds.final).toHaveLength(1);
    expect(b.hadByes).toBe(false);
  });

  it('is deterministic for the same seed', () => {
    const a = generateBracket(TEAMS_32, 'seed-X');
    const b = generateBracket(TEAMS_32, 'seed-X');
    expect(a.rounds.round_of_32).toEqual(b.rounds.round_of_32);
  });

  it('produces different brackets for different seeds', () => {
    const a = generateBracket(TEAMS_32, 'seed-1');
    const b = generateBracket(TEAMS_32, 'seed-2');
    expect(a.rounds.round_of_32).not.toEqual(b.rounds.round_of_32);
  });

  it('handles 16 teams without byes', () => {
    const b = generateBracket(TEAMS_16, 'seed-16');
    expect(b.rounds.round_of_32).toHaveLength(8);
    // 16 < 32 means hadByes flag is true (bracket under-filled), but each
    // match in round_of_32 still has 2 real teams — no bye matches.
    const byes = b.rounds.round_of_32.filter((m) => m.isBye);
    expect(byes.length).toBe(0);
    b.rounds.round_of_32.forEach((m) => {
      expect(m.home).not.toBeNull();
      expect(m.away).not.toBeNull();
    });
  });

  it('assigns byes when teams < 32 (7 teams → 8 bracket)', () => {
    const b = generateBracket(TEAMS_7, 'seed-7');
    expect(b.rounds.round_of_32).toHaveLength(4);
    expect(b.hadByes).toBe(true);
    const byes = b.rounds.round_of_32.filter((m) => m.isBye);
    expect(byes.length).toBe(1);
    byes.forEach((m) => expect(m.winner).not.toBeNull());
  });

  it('rejects fewer than 2 teams', () => {
    expect(() => generateBracket(['solo'], 'x')).toThrow();
    expect(() => generateBracket([], 'x')).toThrow();
  });
});

describe('applyResult', () => {
  it('marks the winner and propagates to the next round', () => {
    const b = generateBracket(TEAMS_32, 'seed-A');
    const m = b.rounds.round_of_32[0];
    expect(m.winner).toBeNull();
    const winner = m.home ?? m.away ?? TEAMS_32[0];
    const updated = applyResult(b, m.id, winner);
    const updatedMatch = updated.rounds.round_of_32[0];
    expect(updatedMatch.winner).toBe(winner);
    const next = updated.rounds.round_of_16[0];
    if (m.index % 2 === 0) expect(next.home).toBe(winner);
    else expect(next.away).toBe(winner);
  });

  it('propagates odd-index match winner to the away side of the next round', () => {
    const b = generateBracket(TEAMS_32, 'seed-A');
    const m = b.rounds.round_of_32[1];
    expect(m.index % 2).toBe(1);
    const winner = m.home ?? m.away ?? TEAMS_32[1];
    const updated = applyResult(b, m.id, winner);
    const next = updated.rounds.round_of_16[0];
    expect(next.away).toBe(winner);
    expect(next.home).toBeNull();
  });

  it('rejects winner that is not a participant', () => {
    const b = generateBracket(TEAMS_32, 'seed-A');
    const m = b.rounds.round_of_32[0];
    expect(() => applyResult(b, m.id, 'NOEXISTE')).toThrow();
  });

  it('rejects unknown match id', () => {
    const b = generateBracket(TEAMS_32, 'seed-A');
    expect(() => applyResult(b, 'R32-M999', 'T1')).toThrow();
  });
});

describe('isBracketComplete / getChampion', () => {
  it('returns false initially', () => {
    const b = generateBracket(TEAMS_32, 'seed-A');
    expect(isBracketComplete(b)).toBe(false);
    expect(getChampion(b)).toBeNull();
  });

  it('plays through to completion and reports champion', () => {
    let b = generateBracket(TEAMS_32, 'seed-A');
    for (const phase of PHASE_ORDER) {
      for (const m of b.rounds[phase]) {
        if (m.winner) continue;
        const winner = m.home ?? m.away;
        if (!winner) throw new Error('no participant');
        b = applyResult(b, m.id, winner);
      }
    }
    expect(isBracketComplete(b)).toBe(true);
    expect(getChampion(b)).not.toBeNull();
  });
});

describe('seedRandom', () => {
  it('produces the same sequence for the same seed', () => {
    const a = seedRandom('hi');
    const b = seedRandom('hi');
    for (let i = 0; i < 5; i++) expect(a()).toBe(b());
  });
  it('produces values in [0,1)', () => {
    const r = seedRandom('x');
    for (let i = 0; i < 50; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
