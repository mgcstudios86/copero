/**
 * F3.2 — Transfer system entre temporadas (MGC-1632 / MGC-1645).
 *
 * Implementa ADR-0017 §4 tal cual: veredicto por rendimiento de la
 * temporada, generación de ofertas con parámetros acotados y deadline de
 * decisión para que el jugador no quede colgado entre temporadas.
 *
 * Módulo puro: sin React, sin `Math.random()`. `Rng` por invocación.
 */

import type { Club, Position } from '@/types/career';
import { ACADEMY_CLUBS, type ClubWithPosition } from './clubs';
import { groupOf } from './positions';
import type { Rng } from './rng';

/* ── Tipos ───────────────────────────────────────────────────────── */

export type TransferVerdict =
  | 'elite_offers'
  | 'strong_offers'
  | 'hold'
  | 'hold_low'
  | 'descent_risk'
  | 'retirement';

export type ExpectedRole = 'starter' | 'rotation';

export type TransferOffer = {
  /** Id estable `offer_<clubId>_<index>` para keys de lista en la UI. */
  id: string;
  club: Club;
  /** Puntos de reputación que suma aceptar (10..25). */
  reputationDelta: number;
  /** Multiplicador salarial 1.0..3.0. */
  wageMultiplier: number;
  /** Duración del contrato en años (2..5). */
  yearsContract: number;
  expectedRole: ExpectedRole;
};

export type TransferState = {
  verdict: TransferVerdict;
  offers: TransferOffer[];
  /** True cuando el club actual empuja la salida (`descent_risk`). */
  forcedTransfer: boolean;
  /** Semana límite para decidir. Al cruzarla se aplica `no_movement`. */
  decisionDeadline: number;
  /** Temporada evaluada (1-indexed), para que el save no reabra un modal viejo. */
  season: number;
  /** Id de la oferta aceptada. `null` mientras esté pendiente. */
  acceptedOfferId: string | null;
  /** True cuando el jugador resolvió (aceptando o dejando vencer). */
  resolved: boolean;
};

export type TransferInput = {
  /** Promedio de rating de la temporada (0..10). */
  avgRating: number;
  /** Goles de la temporada. Sólo pondera para atacantes. */
  goals: number;
  /** Posición final del club en la tabla (1 = campeón). */
  tablePos: number;
  position: Position;
  age: number;
  season: number;
  /** Última semana de la temporada; el deadline son 4 semanas más. */
  seasonEndWeek: number;
  /** Club actual — se excluye del pool de ofertas. */
  currentClubId?: string | null;
};

/** Edad a partir de la cual `retirement.ts` toma el control (ADR §4). */
export const TRANSFER_RETIREMENT_AGE = 35;

/** Semanas de gracia para decidir tras el cierre de temporada (ADR §4). */
export const DECISION_WINDOW_WEEKS = 4;

/* ── §4 — Veredicto ──────────────────────────────────────────────── */

/**
 * Tabla de veredictos de ADR-0017 §4.
 *
 * El criterio secundario depende de la línea: un delantero se mide por
 * goles, el resto por la posición del club en la tabla. `hold_low` es la
 * fila que MGC-1654 agregó para cerrar el hueco `[6.0, 7.0)`, que antes
 * caía en `no_movement` implícito sin contrato explícito.
 */
export function evaluateVerdict(input: TransferInput): TransferVerdict {
  const { avgRating, goals, tablePos, position, age } = input;

  if (age >= TRANSFER_RETIREMENT_AGE) return 'retirement';

  const isForward = groupOf(position) === 'attack';
  const eliteSecondary = isForward ? goals >= 15 : tablePos <= 4;
  const strongSecondary = isForward ? goals >= 10 : tablePos <= 8;

  if (avgRating >= 8.0 && eliteSecondary) return 'elite_offers';
  if (avgRating >= 7.4 && strongSecondary) return 'strong_offers';
  if (avgRating >= 7.0 && tablePos < 16) return 'hold';
  if (avgRating >= 6.0 && tablePos < 16) return 'hold_low';
  return 'descent_risk';
}

/* ── §4 — Generación de ofertas ──────────────────────────────────── */

/** Bandas de reputación de club (`Club.reputation` 1..5) por veredicto. */
const REPUTATION_BAND: Record<TransferVerdict, [number, number]> = {
  elite_offers: [4, 5],
  strong_offers: [3, 4],
  hold: [2, 4],
  hold_low: [2, 3],
  descent_risk: [1, 2],
  retirement: [1, 5], // no se usa: retirement no genera ofertas
};

/** Cantidad de ofertas por veredicto. `hold`/`hold_low` son 0 ó 1. */
function offerCountFor(verdict: TransferVerdict, rng: Rng): number {
  switch (verdict) {
    case 'elite_offers':
      return 3;
    case 'strong_offers':
      return 2;
    case 'hold':
    case 'hold_low':
      return rng.chance(0.5) ? 1 : 0;
    case 'descent_risk':
      return 1;
    case 'retirement':
      return 0;
  }
}

/**
 * Elige un club del catálogo dentro de la banda de reputación pedida,
 * excluyendo el club actual y los ya ofertados. Si la banda queda vacía
 * (catálogo chico), cae al pool completo menos las exclusiones; si eso
 * también queda vacío devuelve `null` y el caller emite menos ofertas.
 */
export function pickOfferClub(
  rng: Rng,
  band: [number, number],
  excludeIds: ReadonlySet<string>,
): ClubWithPosition | null {
  const [min, max] = band;
  const inBand = ACADEMY_CLUBS.filter(
    (c) => !excludeIds.has(c.id) && (c.reputation ?? 3) >= min && (c.reputation ?? 3) <= max,
  );
  const pool = inBand.length > 0 ? inBand : ACADEMY_CLUBS.filter((c) => !excludeIds.has(c.id));
  if (pool.length === 0) return null;
  return pool[rng.int(0, pool.length - 1)];
}

/**
 * Parámetros de la oferta (ADR §4). Los rangos son fijos: no se
 * introduce RNG libre más allá de estas cuatro extracciones, para que el
 * replay por seed sea exacto.
 *
 * Nota: la prosa del ADR resume el rango de `reputationDelta` como
 * "5..25"; la fórmula canónica `5 + 5 * rng.int(1, 4)` produce 10..25.
 * Se implementa la fórmula, que es la parte normativa del ADR.
 */
function buildOffer(
  club: ClubWithPosition,
  index: number,
  verdict: TransferVerdict,
  rng: Rng,
): TransferOffer {
  const reputationDelta = 5 + 5 * rng.int(1, 4);
  const wageMultiplier = Number((1.0 + 0.1 * rng.int(0, 20)).toFixed(2));
  const yearsContract = rng.int(2, 5);
  // Elite fuerza titularidad; el resto lo sortea 50/50.
  const expectedRole: ExpectedRole =
    verdict === 'elite_offers' ? 'starter' : rng.chance(0.5) ? 'starter' : 'rotation';

  return {
    id: `offer_${club.id}_${index}`,
    club,
    reputationDelta,
    wageMultiplier,
    yearsContract,
    expectedRole,
  };
}

/* ── API pública ─────────────────────────────────────────────────── */

/**
 * Evalúa el cierre de temporada y devuelve el estado de transferencias
 * listo para persistir. `retirement` no genera ofertas: `retirement.ts`
 * toma el control (ADR §4, fila final).
 */
export function evaluateTransfer(input: TransferInput, rng: Rng): TransferState {
  const verdict = evaluateVerdict(input);
  const count = offerCountFor(verdict, rng);

  const excluded = new Set<string>(input.currentClubId ? [input.currentClubId] : []);
  const offers: TransferOffer[] = [];
  for (let i = 0; i < count; i += 1) {
    const club = pickOfferClub(rng, REPUTATION_BAND[verdict], excluded);
    if (!club) break;
    excluded.add(club.id);
    offers.push(buildOffer(club, i, verdict, rng));
  }

  return {
    verdict,
    offers,
    forcedTransfer: verdict === 'descent_risk',
    decisionDeadline: input.seasonEndWeek + DECISION_WINDOW_WEEKS,
    season: input.season,
    acceptedOfferId: null,
    resolved: false,
  };
}

/**
 * Acepta una oferta. Devuelve el estado resuelto (no muta el original).
 *
 * MGC-1730 (MEDIUM-2 review CTO) — antes, con un `offerId` inexistente,
 * retornaba **la misma referencia** sin clonar; el test que verifica
 * "no cambia nada" usaba `toEqual` que pasa por igualdad estructural
 * indistinguible del mismo objeto. Riesgo concreto: si el caller hacía
 * `acceptOffer(state, badId) ?? state` y luego seguía usando `state`,
 * un cambio futuro a esta función (p.ej. bumpear `resolved` o agregar
 * un campo nuevo al resolver) entraba en colisión silenciosa con el
 * estado original. Ahora clonamos siempre — si la oferta existe,
 * marcamos `resolved: true` + `acceptedOfferId`; si NO existe,
 * devolvemos un clon con `resolved: false` y `acceptedOfferId: null`
 * (señal explícita de "no se pudo aceptar" sin riesgo de aliasing).
 */
export function acceptOffer(state: TransferState, offerId: string): TransferState {
  const offer = state.offers.find((o) => o.id === offerId);
  if (!offer) {
    return { ...state, acceptedOfferId: null, resolved: false };
  }
  return { ...state, acceptedOfferId: offerId, resolved: true };
}

/** Rechaza todas las ofertas: `no_movement` explícito. */
export function declineAllOffers(state: TransferState): TransferState {
  return { ...state, acceptedOfferId: null, resolved: true };
}

/**
 * ADR §4: sin decisión al cruzar el deadline se aplica `no_movement`.
 * Idempotente — si ya estaba resuelto lo devuelve tal cual.
 */
export function expireIfPastDeadline(state: TransferState, currentWeek: number): TransferState {
  if (state.resolved) return state;
  if (currentWeek < state.decisionDeadline) return state;
  return declineAllOffers(state);
}

/** True si el jugador cambió de club al resolver. */
export function acceptedClub(state: TransferState): Club | null {
  if (!state.acceptedOfferId) return null;
  return state.offers.find((o) => o.id === state.acceptedOfferId)?.club ?? null;
}
