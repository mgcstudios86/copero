import type { RoundOutcome } from '@/types/game';

/**
 * Reglas de scoring puras.
 * - Acierto rápido (>= mitad del tiempo) → 100 puntos.
 * - Acierto lento (< mitad) → 50 puntos.
 * - Skip (pasarse) → 0 puntos.
 * - Timeout (timer llega a 0) → 0 puntos.
 *
 * Bonus de racha: cada 3 aciertos consecutivos suma +50 (apilado).
 */

export const POINTS_FAST = 100;
export const POINTS_SLOW = 50;
export const STREAK_BONUS = 50;
export const STREAK_THRESHOLD = 3;

export type ScoreInput = {
  outcome: RoundOutcome;
  remainingMs: number;
  totalMs: number;
  streakBefore: number;
};

export const computePoints = ({
  outcome,
  remainingMs,
  totalMs,
  streakBefore,
}: ScoreInput): number => {
  if (outcome !== 'correct') return 0;
  const half = totalMs / 2;
  const base = remainingMs >= half ? POINTS_FAST : POINTS_SLOW;
  // La racha se cuenta ANTES de aplicar el bonus del acierto actual
  const newStreak = streakBefore + 1;
  if (newStreak > 0 && newStreak % STREAK_THRESHOLD === 0) {
    return base + STREAK_BONUS;
  }
  return base;
};

export const computeNewStreak = (
  outcome: RoundOutcome,
  streakBefore: number,
): number => (outcome === 'correct' ? streakBefore + 1 : 0);
