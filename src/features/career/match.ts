/**
 * F2.2 — Resolución de partido (MGC-1629 AC §"Resolución de partido").
 *
 * Salida por partido:
 *
 *   score = base (media stats posición) × position_factor
 *         + suerte (RNG seedeado, draw ∈ [-25, +25])
 *         + club_ovr_factor ∈ [-5, +5]
 *
 * `position_factor` pondera los 4 stats según la posición:
 * - GK: reflejos 35% + posicionamiento 25% + salida 15% + manos 25%.
 * - DEF: marcaje 30% + cabeceo 20% + anticipación 30% + salida 20%.
 * - MID: visión 25% + pase 30% + dribling 20% + resistencia 25%.
 * - FWD: definición 35% + velocidad 25% + regate 25% + juego aéreo 15%.
 *
 * Score se clamp-ifica a [0, 100]. `resolvedGoals = floor(score / 20)`
 * (0..5 goles). Defensores/arqueros reciben un `cleanSheetProb` cuya
 * salida se incluye como flag booleano en el output.
 */

import type { Position, PlayerProfile } from '@/types/career';
import { groupOf } from './positions';
import { type Rng } from './rng';
import {
  STAT_INIT,
  statsForPosition,
  type PositionStats,
  type StatKey,
} from './position-stats';

export type PositionWeight = Partial<Record<StatKey, number>>;

export const POSITION_WEIGHTS: Record<'goalkeeper' | 'defense' | 'midfield' | 'attack', PositionWeight> = {
  goalkeeper: { reflejos: 0.35, posicionamiento: 0.25, salida: 0.15, manos: 0.25 },
  defense:     { marcaje: 0.30, cabeceo: 0.20, anticipacion: 0.30, salida: 0.20 },
  midfield:    { vision: 0.25, pase: 0.30, dribling: 0.20, resistencia: 0.25 },
  attack:      { definicion: 0.35, velocidad: 0.25, regate: 0.25, juegoAereo: 0.15 },
};

export type MatchOutcome = {
  /** Score interno 0..100. */
  score: number;
  /** Goles anotados por el jugador 0..5. */
  goals: number;
  /** True si fue valla invicta (porteros y defensores). */
  cleanSheet: boolean;
  /** Componente del score por cada factor (debug). */
  breakdown: {
    base: number;
    luck: number;
    clubFactor: number;
    weighted: number;
  };
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function weightedForPosition(stats: PositionStats, position: Position): number {
  const group = groupOf(position);
  const weights = POSITION_WEIGHTS[group];
  const keys = statsForPosition(position);
  let acc = 0;
  for (const k of keys) {
    const w = weights[k] ?? 0;
    const v = stats[k] ?? STAT_INIT[k];
    acc += w * v;
  }
  return acc;
}

/**
 * Resuelve un partido individual. El RNG debe venir pre-sembrado por el
 * caller (semilla = id de carrera según AC). Devuelve outcome inmutable.
 */
export function resolveMatch(
  profile: PlayerProfile,
  stats: PositionStats,
  rng: Rng,
): MatchOutcome {
  const weighted = weightedForPosition(stats, profile.position);
  // base = weighted (0..99); luck draw ∈ [-25, +25]
  const luck = (rng.next() * 50 - 25);
  const clubFactor = ((profile.club?.reputation ?? 3) - 3); // -2..+2, escalado a ±5
  const clubScaled = clubFactor * 2.5;
  const rawScore = weighted + luck + clubScaled;
  const score = clamp(rawScore, 0, 100);

  const goals = Math.floor(score / 20); // 0..5

  const group = groupOf(profile.position);
  const cleanSheetProb = (() => {
    if (group === 'goalkeeper') return 0.55;
    if (group === 'defense') return 0.30;
    if (group === 'midfield') return 0.10;
    return 0.0;
  })();
  const cleanSheet = group === 'attack' ? false : rng.chance(cleanSheetProb);

  return {
    score,
    goals,
    cleanSheet,
    breakdown: { base: weighted, luck, clubFactor: clubScaled, weighted },
  };
}

/**
 * MGC-1650 (WF5 post-partido) — rating 0.0–10.0 (1 decimal).
 */
export function ratingFromOutcome(outcome: MatchOutcome): number {
  const base = outcome.score / 10;
  let rating = base;
  if (outcome.goals >= 3) rating += 0.5;
  if (outcome.cleanSheet) rating += 0.3;
  const clamped = Math.max(0, Math.min(10, rating));
  return Math.round(clamped * 10) / 10;
}

/**
 * MGC-1650 (WF5) — deltas de moral/fisico/confianza según el rating.
 */
export function deltasFromRating(rating: number): {
  moralDelta: number;
  fisicoDelta: number;
  confianzaDelta: number;
} {
  if (rating >= 8.5)
    return { moralDelta: 12, fisicoDelta: -8, confianzaDelta: 15 };
  if (rating >= 7.0)
    return { moralDelta: 6, fisicoDelta: -5, confianzaDelta: 8 };
  if (rating >= 5.0)
    return { moralDelta: 0, fisicoDelta: -3, confianzaDelta: 0 };
  if (rating >= 3.0)
    return { moralDelta: -6, fisicoDelta: -2, confianzaDelta: -8 };
  return { moralDelta: -12, fisicoDelta: -1, confianzaDelta: -15 };
}

/** Clamp helper público para que la UI no reimplemente el rango. */
export function clampCareerStat(n: number): number {
  return Math.max(0, Math.min(100, n));
}
