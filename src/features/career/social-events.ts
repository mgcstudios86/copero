/**
 * F4 — Eventos sociales post-partido (MGC-1738 / MGC-1762).
 *
 * Implementa la design rev2 de MGC-1738: tras un partido, el jugador
 * sale con amigos y se rolea un evento social probabilístico que
 * modifica la semana siguiente.
 *
 * Decisiones clave (MGC-1738 rev 2):
 * - **Módulo NUEVO**, no extiende `events.ts` / `decision-tree.ts` para
 *   no romper AC 4-outcomes de F2.2 (`position-tree.ts`) ni AC
 *   6-outcomes de F3.2 (`decision-tree.ts`).
 * - **4 outcomes disjuntos**: timba / asado / tour / quedarse (piso).
 * - **Gates** por posición y stat principal reusan `KEY_STAT_BY_GROUP` y
 *   `SUERTE_GATE` de `events.ts` — el mismo "sin stats la suerte no
 *   compensa" del brief.
 * - **Composición**: `mergeModifiers(postMatch, social)` aplica las
 *   reglas de la design rev2: `luckBonus = MAX`, `injuryRiskMul =
 *   producto`, `fatigue/moral/confianza = suma`, `trainingBoost = MIN`.
 *   El clamp `injuryRiskMul ≤ 2.5` se aplica aquí (no en `events.ts`).
 * - **RNG snapshot v2**: `runSocialEvent` acepta un `Rng` o un
 *   `RngSnapshot` y devuelve `{ event, modifiers, rngSnapshot }`. Misma
 *   semilla + mismo snapshot → misma secuencia (replay determinista).
 * - **Outcome piso**: `quedarse` reemplaza al nombre anterior `descanso`
 *   que colisiona con `WeeklyBaseOptionId` en `position-tree.ts:28`.
 *
 * Módulo puro: sin React, sin `Math.random()`.
 */

import type { Position, PositionGroup } from '@/types/career';
import { groupOf } from './positions';
import type { PositionStats } from './position-stats';
import {
  createRngFromSnapshot,
  snapshotRng,
  type Rng,
  type RngSnapshot,
} from './rng';
import {
  KEY_STAT_BY_GROUP,
  NO_MODIFIERS,
  SUERTE_GATE,
  passesLuckGate,
  type NextWeekModifiers,
} from './events';

/* ── Tipos ───────────────────────────────────────────────────────── */

/**
 * 4 outcomes sociales disjuntos. `quedarse` (piso) **no** colisiona con
 * `descanso` de `PostMatchEventId`: la design rev 2 lo renombró a
 * propósito (ver §C1 del comment en MGC-1738).
 */
export type SocialEventId = 'timba' | 'asado' | 'tour' | 'quedarse';

export type SocialEvent = {
  id: SocialEventId;
  /** copyId que la UI resuelve contra `COPY[locale].socialEvents`. */
  copyId: string;
  /** Semana en la que se roleó el evento. */
  week: number;
  /** True si el gate de suerte dejó pasar el bonus (mismo gate que `events.ts`). */
  luckGatePassed: boolean;
};

/**
 * Input de `runSocialEvent`. Simétrico con `PostMatchInput`:
 * `rating` ya viene en 0..10 (aplicar `ratingFromScore(score)` antes de
 * llamar, igual que en `runPostMatch`).
 */
export type SocialEventInput = {
  position: Position;
  positionStats: PositionStats;
  /** Rating del partido 0..10. */
  rating: number;
  /** Semana en la que se jugó el partido. */
  week: number;
};

/**
 * Acepta `Rng | RngSnapshot | undefined` — mismo patrón que
 * `applyWeeklyChoice` (MGC-1676). Si es `undefined`, devuelve no-op
 * determinista (defensa ante falta de cursor en state.rng).
 */
export type SocialRngInput = Rng | RngSnapshot | undefined;

export type SocialEventResult = {
  event: SocialEvent | null;
  modifiers: NextWeekModifiers;
  /** Cursor del RNG tras consumir el evento (para persistir en state.rng). */
  rngSnapshot: RngSnapshot;
};

/* ── §A — Probabilidades base (design rev 2) ─────────────────────── */

/**
 * Probabilidades base, normalizadas para sumar 1.0:
 *   timba 0.30 + asado 0.40 + tour 0.20 + quedarse 0.10 = 1.0
 *
 * El piso (`quedarse`) cubre el caso de rating bajo + mala suerte
 * social; no es un "default" sino un outcome rolado.
 */
const PROBS: Record<SocialEventId, number> = {
  timba: 0.30,
  asado: 0.40,
  tour: 0.20,
  quedarse: 0.10,
};

/* ── §B — Costo base por outcome (siempre se aplica) ──────────────── */

const EVENT_COST: Record<
  SocialEventId,
  Pick<NextWeekModifiers, 'moralDelta' | 'fatigueDelta' | 'confianzaDelta'>
> = {
  timba:    { moralDelta: 4,  fatigueDelta: -14, confianzaDelta: -2 },
  asado:    { moralDelta: 8,  fatigueDelta: -6,  confianzaDelta: 1 },
  tour:     { moralDelta: 6,  fatigueDelta: -18, confianzaDelta: 4 },
  quedarse: { moralDelta: 1,  fatigueDelta: 8,   confianzaDelta: 0 },
};

/* ── §C — Gates por outcome (design rev 2) ──────────────────────── */

/**
 * Gates opcionales por outcome. Si el stat principal no cumple el
 * umbral, ese outcome se **excluye** del pool antes del roll. Si el
 * pool queda vacío (caso degenerado), caemos al piso `quedarse`.
 *
 * Reglas:
 * - `timba` exige `KEY_STAT ≥ SUERTE_GATE` — si no llega, no sale a
 *   apostar (es lo que el operador llamó "timba con amigos de verdad").
 * - `tour` exige `rating ≥ 7.0` — salir de tour requiere un partido
 *   mínimamente brillante (no se hace tour tras un 5.0).
 * - `asado` y `quedarse` no tienen gate adicional (siempre disponibles).
 */
type OutcomeGate = { minRating?: number };

const GATES: Record<SocialEventId, OutcomeGate> = {
  timba:    {},
  asado:    {},
  tour:     { minRating: 7.0 },
  quedarse: {},
};

/* ── §D — Resolución (rol + modificadores) ──────────────────────── */

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/** Devuelve el pool de outcomes disponibles dados los gates del profile. */
function eligibleOutcomes(
  rating: number,
  position: Position,
  stats: PositionStats,
): SocialEventId[] {
  const group: PositionGroup = groupOf(position);
  const keyStat = stats[KEY_STAT_BY_GROUP[group]] ?? 0;
  const minKeyStat = SUERTE_GATE[group];

  return (Object.keys(GATES) as SocialEventId[]).filter((id) => {
    const g = GATES[id];
    if (g.minRating !== undefined && rating < g.minRating) return false;
    // `timba` usa el mismo umbral de suerte que `events.ts`.
    if (id === 'timba' && keyStat < minKeyStat) return false;
    return true;
  });
}

/**
 * Sortea un outcome del pool usando `rng.next()`. Si el pool está vacío
 * (no debería pasar si `rating ≥ 6.0` y stats ≥ init, pero defensivo),
 * devuelve `quedarse`.
 */
function pickSocialEvent(pool: SocialEventId[], rng: Rng): SocialEventId {
  if (pool.length === 0) return 'quedarse';
  const total = pool.reduce((s, id) => s + PROBS[id], 0);
  // Renormaliza por si los gates cambiaron la masa (defensa ante futuro).
  const r = rng.next() * total;
  let acc = 0;
  for (const id of pool) {
    acc += PROBS[id];
    if (r < acc) return id;
  }
  return pool[pool.length - 1];
}

/**
 * ADR / design rev 2 §D. Genera los `NextWeekModifiers` a partir del
 * outcome social sorteado. La suerte **solo** amplifica `luckBonus`
 * cuando `passesLuckGate` es true — mismo corazón que `events.ts`.
 *
 * Los multiplicadores extra por outcome:
 * - `timba`:  `injuryRiskMul ∈ [1.5, 2.5]` (clamp ≤ 2.5; era 2.0 en events)
 * - `asado`:  sin bonus extra (evento benigno).
 * - `tour`:   `luckBonus` se duplica si pasa el gate (factor 1.0..1.5).
 * - `quedarse`: `trainingBoost = 1.0` (recuperación plana).
 */
function resolveSocial(
  event: SocialEvent,
  rng: Rng,
): NextWeekModifiers {
  const cost = EVENT_COST[event.id];

  // luckBonus: 0..0.15 con gate. `tour` dobla el rango (0..0.30) pero
  // solo amplifica — sigue siendo 0 si el gate no pasa.
  const baseLuck = 0.1 + 0.05 * rng.next();
  const luckBonus =
    event.luckGatePassed
      ? event.id === 'tour' ? clamp(baseLuck * 2, 0, 0.30) : baseLuck
      : 0;

  // trainingBoost: `quedarse` recupera (1.0), `timba`/`tour` bajan
  // entrenamiento por fatiga residual, `asado` plano.
  const trainingBoost =
    event.id === 'quedarse' ? 1.0
    : event.id === 'asado' ? 1.0
    : event.id === 'timba' ? 0.9
    : 0.85; // tour

  // injuryRiskMul: solo `timba` lo aumenta; clamp ≤ 2.5.
  const injuryRiskMul =
    event.id === 'timba' ? clamp(1.5 + 0.5 * rng.next(), 1.0, 2.5) : 1.0;

  return {
    luckBonus,
    trainingBoost,
    injuryRiskMul,
    moralDelta: cost.moralDelta,
    fatigueDelta: cost.fatigueDelta,
    confianzaDelta: cost.confianzaDelta,
  };
}

/* ── §E — Composición con `runPostMatch` ────────────────────────── */

/**
 * Design rev 2 §E. Combina modificadores del evento post-partido
 * (`runPostMatch`) con los del evento social. Reglas declaradas:
 *
 * - `luckBonus`       = MAX(a, b) — el mayor de los dos gana.
 * - `injuryRiskMul`   = producto — el riesgo se acumula.
 * - `moralDelta`      = suma — los efectos en moral se acumulan.
 * - `fatigueDelta`    = suma — idem.
 * - `confianzaDelta`  = suma — idem.
 * - `trainingBoost`   = MIN(a, b) — el peor de los dos gana.
 *
 * Clamps:
 * - `injuryRiskMul` se clampea a `[1.0, 2.5]` post-producto.
 * - `luckBonus` se clampea a `[0, 0.30]` (cota superior del tour).
 */
export function mergeModifiers(
  a: NextWeekModifiers,
  b: NextWeekModifiers,
): NextWeekModifiers {
  return {
    luckBonus: clamp(Math.max(a.luckBonus, b.luckBonus), 0, 0.30),
    injuryRiskMul: clamp(a.injuryRiskMul * b.injuryRiskMul, 1.0, 2.5),
    moralDelta: a.moralDelta + b.moralDelta,
    fatigueDelta: a.fatigueDelta + b.fatigueDelta,
    confianzaDelta: a.confianzaDelta + b.confianzaDelta,
    trainingBoost: Math.min(a.trainingBoost, b.trainingBoost),
  };
}

/* ── §F — API pública ────────────────────────────────────────────── */

/**
 * Atajo de wiring: rolea y resuelve el evento social. Consume 1-3
 * draws del RNG (1 para pick + 0-2 para luckBonus/injuryRiskMul según
 * outcome), persistiendo el cursor avanzado en `rngSnapshot` para que
 * `engine.ts` lo guarde en `state.rng`.
 *
 * Acepta `Rng | RngSnapshot | undefined`. Si recibe `RngSnapshot`,
 * restaura el cursor (patrón MGC-1676). Si recibe `Rng`, lo consume
 * directamente (tests / mocks). Si `undefined`, devuelve no-op
 * determinista con `NO_MODIFIERS` (defensa ante falta de cursor en
 * `state.rng`; engine.ts siempre debería tener uno).
 */
export function runSocialEvent(
  input: SocialEventInput,
  rngOrSnapshot?: SocialRngInput,
): SocialEventResult {
  const { position, positionStats, rating, week } = input;

  // Sin RNG → no-op determinista (mismo patrón que `runPostMatch` cuando
  // rating < 6.0 → null + NO_MODIFIERS).
  if (!rngOrSnapshot) {
    return {
      event: null,
      modifiers: { ...NO_MODIFIERS },
      rngSnapshot: { v: 1, seed: 0, cursor: 0, algorithm: 'mulberry32' },
    };
  }

  // Restaura el snapshot si lo que entró fue un snapshot, o usa el Rng
  // directamente. Importante: el cursor que devolvemos debe ser el
  // cursor FINAL, no el de entrada.
  const rng: Rng =
    typeof (rngOrSnapshot as Rng).next === 'function'
      ? (rngOrSnapshot as Rng)
      : createRngFromSnapshot(rngOrSnapshot as RngSnapshot);

  const gate = passesLuckGate(position, positionStats);
  // `rating` ya viene en escala 0..10 (el caller aplica `ratingFromScore`
  // contra `result.match.score` antes de invocar). Ver `engine.ts#resolveMatchweek`.
  const pool = eligibleOutcomes(rating, position, positionStats);
  const id = pickSocialEvent(pool, rng);

  const event: SocialEvent = {
    id,
    copyId: `social_${id}`,
    week,
    luckGatePassed: gate,
  };

  const modifiers = resolveSocial(event, rng);

  return {
    event,
    modifiers,
    rngSnapshot: snapshotRng(rng),
  };
}
