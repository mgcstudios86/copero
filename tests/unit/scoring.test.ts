import { describe, it, expect } from 'vitest';
import {
  computePoints,
  computeNewStreak,
  POINTS_FAST,
  POINTS_SLOW,
  STREAK_BONUS,
  STREAK_THRESHOLD,
} from '../../src/features/game/scoring';

describe('scoring', () => {
  describe('computePoints', () => {
    it('acierto rápido (>= mitad) → POINTS_FAST', () => {
      expect(
        computePoints({
          outcome: 'correct',
          remainingMs: 20_000,
          totalMs: 30_000,
          streakBefore: 0,
        }),
      ).toBe(POINTS_FAST);
    });

    it('acierto lento (< mitad) → POINTS_SLOW', () => {
      expect(
        computePoints({
          outcome: 'correct',
          remainingMs: 5_000,
          totalMs: 30_000,
          streakBefore: 0,
        }),
      ).toBe(POINTS_SLOW);
    });

    it('skip → 0 puntos', () => {
      expect(
        computePoints({
          outcome: 'skip',
          remainingMs: 25_000,
          totalMs: 30_000,
          streakBefore: 5,
        }),
      ).toBe(0);
    });

    it('timeout → 0 puntos', () => {
      expect(
        computePoints({
          outcome: 'timeout',
          remainingMs: 0,
          totalMs: 30_000,
          streakBefore: 5,
        }),
      ).toBe(0);
    });

    it(`bonus racha cada ${STREAK_THRESHOLD} aciertos consecutivos`, () => {
      // streakBefore=2 → tras acierto newStreak=3 → bonus
      expect(
        computePoints({
          outcome: 'correct',
          remainingMs: 20_000,
          totalMs: 30_000,
          streakBefore: STREAK_THRESHOLD - 1,
        }),
      ).toBe(POINTS_FAST + STREAK_BONUS);
    });
  });

  describe('computeNewStreak', () => {
    it('correct → streak + 1', () => {
      expect(computeNewStreak('correct', 3)).toBe(4);
    });
    it('skip → streak 0', () => {
      expect(computeNewStreak('skip', 3)).toBe(0);
    });
    it('timeout → streak 0', () => {
      expect(computeNewStreak('timeout', 3)).toBe(0);
    });
  });
});
