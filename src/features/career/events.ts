/**
 * F3.2 — Eventos post-partido (MGC-1632 / MGC-1644).
 *
 * Implementa literalmente ADR-0017 §1 (probabilidades base) y §2 (gate de
 * suerte por posición). El brief del operador en MGC-1623 es explícito:
 * *"la suerte tmb tiene que estar acompañada a buen rendimiento"*. Por eso
 * el `luckBonus` está gateado por el stat principal de la posición: si el
 * jugador no llega al umbral, el evento **solo aplica el costo**
 * (fatiga / riesgo de lesión) y no compensa nada.
 *
 * Módulo puro: sin React, sin `Math.random()`. El `Rng` (Mulberry32,
 * `rng.ts`) entra por invocación para que QA pueda reproducir historias
 * con seed fijo (ADR-0017 §5).
 */

import type { Position, PositionGroup } from '@/types/career';
import { groupOf } from './positions';
import { STAT_INIT, type PositionStats, type StatKey } from './position-stats';
import type { Rng } from './rng';

/* ── Tipos ───────────────────────────────────────────────────────── */

export type PostMatchEventId =
  | 'descanso'
  | 'fiesta'
  | 'gambling'
  | 'compra_lujosa'
  | 'premiacion_individual';

export type PostMatchEvent = {
  id: PostMatchEventId;
  /** copyId que la UI resuelve contra `COPY[locale].postMatch`. */
  copyId: string;
  /** Rating del partido que disparó el evento (0..10). */
  rating: number;
  /** Semana en la que se disparó, para que el save reanude el modal. */
  week: number;
  /** True si el gate de suerte (§2) dejó pasar el bonus. */
  luckGatePassed: boolean;
};

/**
 * Modificadores que el evento deja para la semana siguiente. Los consume
 * `applyWeeklyChoice` (multiplicando el `prob` del árbol por
 * `1 + luckBonus`) y `maybeRollInjury` (multiplicando su chance por
 * `injuryRiskMul`).
 */
export type NextWeekModifiers = {
  /** 0 .. 0.15 — bonus de probabilidad sobre outcomes favorables. */
  luckBonus: number;
  /** Multiplicador sobre los deltas de entrenamiento (0.9 .. 1.0). */
  trainingBoost: number;
  /** Multiplicador sobre la chance de lesión (1.0 .. 2.0). */
  injuryRiskMul: number;
  /** Delta directo a `career.moral`. */
  moralDelta: number;
  /** Delta directo a `career.fisico` (negativo = fatiga). */
  fatigueDelta: number;
  /** Delta directo a `career.confianza`. */
  confianzaDelta: number;
};

export const NO_MODIFIERS: NextWeekModifiers = {
  luckBonus: 0,
  trainingBoost: 1,
  injuryRiskMul: 1,
  moralDelta: 0,
  fatigueDelta: 0,
  confianzaDelta: 0,
};

/* ── §2 — Gate de suerte por posición ────────────────────────────── */

/**
 * ADR-0017 §2. Umbral del stat principal por línea. GK exige más alto
 * porque reflejos es un stat consolidado; FWD exige menos porque los
 * goles son ruidosos y el stat principal explica menos varianza.
 */
export const SUERTE_GATE: Record<PositionGroup, number> = {
  goalkeeper: 70, // GK
  defense: 68, // DEF
  midfield: 66, // MID
  attack: 65, // FWD
};

/**
 * Stat "principal" de cada línea = el de mayor peso en
 * `match.POSITION_WEIGHTS`. Empates (DEF: marcaje 0.30 / anticipación
 * 0.30) se rompen por el orden declarado en `DEF_STATS`, que pone
 * `marcaje` primero. Definición determinista y documentada para que el
 * gate no dependa del orden de iteración de un objeto.
 */
export const KEY_STAT_BY_GROUP: Record<PositionGroup, StatKey> = {
  goalkeeper: 'reflejos', // 0.35
  defense: 'marcaje', // 0.30 (empate con anticipación, gana el orden DEF_STATS)
  midfield: 'pase', // 0.30
  attack: 'definicion', // 0.35
};

export function keyStatFor(position: Position): StatKey {
  return KEY_STAT_BY_GROUP[groupOf(position)];
}

/** True si el jugador supera el umbral de suerte para su posición. */
export function passesLuckGate(position: Position, stats: PositionStats): boolean {
  const group = groupOf(position);
  const key = KEY_STAT_BY_GROUP[group];
  const value = stats[key] ?? STAT_INIT[key];
  return value >= SUERTE_GATE[group];
}

/* ── §1 — Roll del evento post-partido ───────────────────────────── */

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/** Convierte el `score` 0..100 de `resolveMatch` al rating 0..10 del ADR. */
export function ratingFromScore(score: number): number {
  return clamp(score / 10, 0, 10);
}

export type PostMatchInput = {
  position: Position;
  positionStats: PositionStats;
  /** Rating del partido 0..10 (usar `ratingFromScore`). */
  rating: number;
  /** Momentum del jugador — `career.confianza` 0..100. */
  form: number;
  /** Semana en la que se jugó el partido. */
  week: number;
};

/**
 * ADR-0017 §1. Devuelve el evento disparado o `null` si el partido no
 * alcanzó ni el piso de `descanso` (rating < 6.0).
 *
 * Orden de evaluación (importa, consume RNG en secuencia):
 *
 * 1. `premiacion_individual` — cap independiente, 10% con rating ≥ 9.0.
 *    Se evalúa **antes** que `fiesta` para que un partido brillante no
 *    se quede sólo en "salir a festejar".
 * 2. `fiesta` — 50% con rating ≥ 7.0. Si sale, se elige el sabor entre
 *    tres outcomes **mutuamente excluyentes** (§7): `gambling` 30% (si
 *    form ≥ 60), `compra_lujosa` 20% (si rating ≥ 8.0), o `fiesta` pelada.
 * 3. `descanso` — piso, siempre que rating ≥ 6.0.
 */
export function rollPostMatchEvent(input: PostMatchInput, rng: Rng): PostMatchEvent | null {
  const { rating, form, week, position, positionStats } = input;
  const gate = passesLuckGate(position, positionStats);

  const build = (id: PostMatchEventId): PostMatchEvent => ({
    id,
    copyId: `post_match_${id}`,
    rating,
    week,
    luckGatePassed: gate,
  });

  if (rating >= 9.0 && rng.chance(0.1)) return build('premiacion_individual');

  if (rating >= 7.0 && rng.chance(0.5)) {
    // Salió a festejar. Los tres sabores son condicionales y excluyentes.
    if (form >= 60 && rng.chance(0.3)) return build('gambling');
    if (rating >= 8.0 && rng.chance(0.2)) return build('compra_lujosa');
    return build('fiesta');
  }

  if (rating >= 6.0) return build('descanso');

  return null;
}

/* ── §2 — Resolución del evento a modificadores ──────────────────── */

/** Costo fijo del evento, se aplica pase o no pase el gate de suerte. */
const EVENT_COST: Record<PostMatchEventId, Pick<NextWeekModifiers, 'moralDelta' | 'fatigueDelta' | 'confianzaDelta'>> = {
  descanso: { moralDelta: 1, fatigueDelta: 10, confianzaDelta: 0 },
  fiesta: { moralDelta: 6, fatigueDelta: -12, confianzaDelta: 2 },
  gambling: { moralDelta: 2, fatigueDelta: -20, confianzaDelta: -4 },
  compra_lujosa: { moralDelta: 8, fatigueDelta: -8, confianzaDelta: 3 },
  premiacion_individual: { moralDelta: 12, fatigueDelta: -4, confianzaDelta: 8 },
};

/**
 * ADR-0017 §2. Traduce el evento a los modificadores de la semana
 * siguiente.
 *
 * Si `luckGatePassed === false`, `luckBonus = 0`: el jugador paga la
 * fatiga y el riesgo de lesión igual, pero **no recibe compensación**.
 * Ese es el corazón del brief "sin stats → la suerte no compensa".
 */
export function resolvePostMatch(event: PostMatchEvent, rng: Rng): NextWeekModifiers {
  const cost = EVENT_COST[event.id];

  const luckBonus = event.luckGatePassed ? 0.1 + 0.05 * rng.next() : 0;

  const trainingBoost = event.id === 'compra_lujosa' ? 0.9 : 1.0;

  const injuryRiskMul = event.id === 'gambling' ? 1.5 + 0.5 * rng.next() : 1.0;

  return {
    luckBonus,
    trainingBoost,
    injuryRiskMul,
    moralDelta: cost.moralDelta,
    fatigueDelta: cost.fatigueDelta,
    confianzaDelta: cost.confianzaDelta,
  };
}

/**
 * Atajo para el wiring: rolea el evento y, si hay, lo resuelve. Devuelve
 * ambos para que la UI pueda mostrar el modal (`event`) y el motor
 * aplicar los modificadores (`modifiers`).
 */
export function runPostMatch(
  input: PostMatchInput,
  rng: Rng,
): { event: PostMatchEvent | null; modifiers: NextWeekModifiers } {
  const event = rollPostMatchEvent(input, rng);
  if (!event) return { event: null, modifiers: NO_MODIFIERS };
  return { event, modifiers: resolvePostMatch(event, rng) };
}
