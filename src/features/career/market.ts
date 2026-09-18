/**
 * MGC-475 — Flow mercado-de-pases (compra/venta de jugadores del club).
 *
 * Scope: el jugador (manager) navega un pool de jugadores disponibles
 * para fichar por su club. F3.2 (transfer-offers, MGC-1803) cubre las
 * ofertas RECIBIDAS por el jugador; este módulo cubre las ofertas que
 * el jugador HACE para reforzar su plantilla, contra presupuesto del
 * club.
 *
 * Módulo puro: sin React, sin `Math.random()`. El `Rng` lo inyecta el
 * store (`careerStore.ts`). La UI lee/escribe vía el store.
 *
 * Modelo económico (MGC-214 §3 + extensión MGC-475):
 *  - `clubBudget` parte del `club.presupuesto` al fichar (MGC-442 simulate).
 *  - El valor de mercado del jugador target se evalúa contra el OVR.
 *  - IA vende/compra: probabilidad de aceptación por reputación del club
 *    vendedor + paridad con valor de mercado. Sin re-roll infinito (lock
 *    presupuesto al ofertar — ver scope MGC-475: "NO en v1").
 *  - Al confirmar: budget -= monto, jugador.target → roster, oferta cerrada.
 *  - Al cancelar: estado vuelve a `open` con la oferta descartada.
 *  - Al cerrar temporada: el `marketState` persiste en CareerSnapshot v:3
 *    y se rehidrata con defaults en `loadCareerSave`.
 *
 * Out of scope (v1, alineado con MGC-214):
 *  - Multi-ofertas simultáneas (sólo 1 oferta pendiente a la vez).
 *  - Lock de presupuesto al ofertar (puede quedar sobre-ofertado).
 *  - Negociación / contrapropuesta IA.
 */

import type { Club, Position, PositionGroup } from '@/types/career';
import { ACADEMY_CLUBS, type ClubWithPosition } from './clubs';
import { POSITIONS, groupOf } from './positions';
import type { Rng } from './rng';

/* ── Tipos públicos ──────────────────────────────────────────────── */

/** Jugador disponible en el pool del mercado. NO es mi jugador. */
export type MarketPlayer = {
  /** Id estable `mp_<clubId>_<index>` para keys de lista en la UI. */
  id: string;
  name: string;
  position: Position;
  age: number;
  /** Overall 50..90 según reputación del club de origen. */
  ovr: number;
  /** Valor de mercado en M EUR (placeholder). */
  value: number;
  /** Club de origen (donde juega actualmente). */
  fromClub: Club;
  /** Stats genéricos de la temporada (apps/goals/ast) — placeholder. */
  seasonApps: number;
  seasonGoals: number;
  seasonAst: number;
};

export type MarketOffer = {
  /** Id estable `offer_<playerId>`. */
  id: string;
  playerId: string;
  /** Monto ofertado al club vendedor (M EUR). */
  amount: number;
  /** Veredicto IA — `pending` mientras el modal está abierto. */
  verdict: 'pending' | 'accepted' | 'rejected';
  /** Snapshot del player al ofertar (para detectar `vendido en background`). */
  playerSnapshot: MarketPlayer;
};

export type MarketStatus = 'idle' | 'open' | 'awaiting' | 'closed';

export type MarketState = {
  status: MarketStatus;
  /** Pool de jugadores disponibles en el mercado (refresca cada apertura). */
  pool: MarketPlayer[];
  /** Oferta en negociación (modal abierto). `null` cuando no hay modal. */
  pendingOffer: MarketOffer | null;
  /** Temporada en la que se abrió el mercado (para invalidar al avanzar). */
  season: number;
};

/* ── Catálogo de nombres (placeholder hasta MGC-428 designer) ────── */

const FIRST_NAMES = [
  'Mateo', 'Joaquín', 'Tomás', 'Santiago', 'Lucas', 'Benjamín', 'Dylan',
  'Thiago', 'Gianluca', 'Lautaro', 'Franco', 'Agustín', 'Bautista',
  'Valentín', 'Sebastián', 'Nicolás', 'Emmanuel', 'Ayrton', 'Maximiliano',
  'Ramiro', 'Esteban', 'Hernán', 'Federico', 'Ignacio', 'Leandro',
];

const LAST_NAMES = [
  'García', 'Martínez', 'López', 'González', 'Rodríguez', 'Pérez',
  'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Rivera', 'Gómez',
  'Díaz', 'Cruz', 'Morales', 'Reyes', 'Gutiérrez', 'Ortiz', 'Núñez',
  'Romero', 'Álvarez', 'Mendoza', 'Castro', 'Suárez', 'Vargas',
];

/* ── Generación del pool ─────────────────────────────────────────── */

const MIN_POOL = 6;
const MAX_POOL = 12;

function pickRandomName(rng: Rng): string {
  const first = FIRST_NAMES[rng.int(0, FIRST_NAMES.length - 1)];
  const last = LAST_NAMES[rng.int(0, LAST_NAMES.length - 1)];
  return `${first} ${last}`;
}

function pickPositionForGroup(rng: Rng, group: PositionGroup): Position {
  const candidates = POSITIONS.filter((p) => groupOf(p.id) === group);
  const def = candidates[rng.int(0, candidates.length - 1)];
  return def.id;
}

function bandForReputation(rep: number): [number, number] {
  // Reputación 1..5 → OVR 50..90 con jitter ±4.
  const base = 50 + (rep - 1) * 10;
  return [Math.max(50, base - 4), Math.min(90, base + 8)];
}

function valueForOvr(ovr: number): number {
  // Curva simple: value = (ovr - 50)^2 / 10 + 0.5 M EUR.
  const delta = Math.max(0, ovr - 50);
  return Math.round((delta * delta) / 10 + 0.5);
}

/**
 * Genera un pool determinista de jugadores en el mercado.
 * Excluye el club del jugador (manager) y opcionalmente un club actual.
 */
export function generateMarketPool(
  rng: Rng,
  input: {
    seed: number;
    excludeClubId?: string | null;
    count?: number;
  },
): MarketPlayer[] {
  const count = input.count ?? rng.int(MIN_POOL, MAX_POOL);
  const eligibleClubs = ACADEMY_CLUBS.filter(
    (c) => c.id !== input.excludeClubId,
  );
  const pool: MarketPlayer[] = [];
  const usedKeys = new Set<string>();

  for (let i = 0; i < count; i += 1) {
    const club = eligibleClubs[rng.int(0, eligibleClubs.length - 1)];
    const [minOv, maxOv] = bandForReputation(club.reputation ?? 3);
    const ovr = rng.int(minOv, maxOv);
    const groups: PositionGroup[] = ['attack', 'midfield', 'defense', 'goalkeeper'];
    const group = groups[rng.int(0, groups.length - 1)];
    const position = pickPositionForGroup(rng, group);
    const age = rng.int(18, 33);
    const apps = rng.int(5, 35);
    const goals = group === 'attack' ? rng.int(2, 22) : rng.int(0, 6);
    const ast = rng.int(0, 12);

    let key: string;
    let id: string;
    do {
      key = `${club.id}-${pickRandomName(rng)}-${rng.int(0, 9999)}`;
      id = `mp_${club.id}_${i}_${key.length}`;
    } while (usedKeys.has(id));
    usedKeys.add(id);

    pool.push({
      id,
      name: pickRandomName(rng),
      position,
      age,
      ovr,
      value: valueForOvr(ovr),
      fromClub: {
        id: club.id,
        name: club.name,
        league: club.league,
        crestColor: club.crestColor,
        crestAccent: club.crestAccent,
        presupuesto: club.presupuesto,
        archetype: club.archetype,
        reputation: club.reputation,
      },
      seasonApps: apps,
      seasonGoals: goals,
      seasonAst: ast,
    });
  }

  // Ordenar por OVR descendente (los mejores arriba).
  pool.sort((a, b) => b.ovr - a.ovr);
  // input.seed se acepta para que la API sea estable; el caller puede
  // persistirlo si quiere re-hidratar el mismo pool entre renderizados.
  void input.seed;
  return pool;
}

/* ── Veredicto IA (acepta/rechaza) ───────────────────────────────── */

/**
 * IA decide si acepta la oferta del manager.
 *
 * Modelo (simple, alineado con F3.2 RNG determinista):
 *  - Probabilidad base = 0.45 + (reputación vendedor / 5) * 0.25.
 *  - Bonus si oferta >= valor: +0.20.
 *  - Bonus si oferta >= 1.15x valor: +0.10.
 *  - Bonus de fit: si OVR del comprador < OVR jugador, +0.05 (club chico).
 *  - Si oferta < 0.7x valor: rechazo casi seguro (-0.40).
 *  - Si oferta > 2x valor: rechazo por "poco serio" (-0.30).
 *
 * Devuelve `true` si la IA acepta.
 */
export function evaluatePurchaseOffer(input: {
  offeredAmount: number;
  marketValue: number;
  sellingClubReputation: number;
  buyerClubOvr: number;
  playerOvr: number;
  rng: Rng;
}): boolean {
  const { offeredAmount, marketValue, sellingClubReputation, buyerClubOvr, playerOvr, rng } = input;
  let p = 0.45 + (sellingClubReputation / 5) * 0.25;
  const ratio = offeredAmount / Math.max(0.1, marketValue);
  if (ratio >= 1) p += 0.2;
  if (ratio >= 1.15) p += 0.1;
  if (ratio < 0.7) p -= 0.4;
  if (ratio > 2) p -= 0.3;
  if (buyerClubOvr < playerOvr) p += 0.05;

  // Clamp a [0.05, 0.95] — nunca certeza absoluta.
  p = Math.max(0.05, Math.min(0.95, p));
  return rng.chance(p);
}

/**
 * Verifica si un jugador del pool sigue disponible (no fue vendido en
 * background por otra oferta del manager al refrescar el pool).
 */
export function isPlayerStillAvailable(
  player: MarketPlayer,
  pool: MarketPlayer[],
): boolean {
  return pool.some((p) => p.id === player.id);
}

/**
 * Aplica la oferta aceptada: descuenta presupuesto, devuelve el jugador
 * para añadir al roster. NO muta el store — eso lo hace el caller.
 */
export type PurchaseResult =
  | { ok: true; player: MarketPlayer; newBudget: number; amountPaid: number }
  | { ok: false; reason: 'insufficient_budget' | 'player_unavailable'; newBudget: number };

export function applyAcceptedPurchase(input: {
  offer: MarketOffer;
  currentBudget: number;
  currentPool: MarketPlayer[];
}): PurchaseResult {
  const { offer, currentBudget, currentPool } = input;
  if (!isPlayerStillAvailable(offer.playerSnapshot, currentPool)) {
    return { ok: false, reason: 'player_unavailable', newBudget: currentBudget };
  }
  if (currentBudget < offer.amount) {
    return { ok: false, reason: 'insufficient_budget', newBudget: currentBudget };
  }
  return {
    ok: true,
    player: offer.playerSnapshot,
    newBudget: currentBudget - offer.amount,
    amountPaid: offer.amount,
  };
}

/* ── Defaults / hidratación ──────────────────────────────────────── */

export const EMPTY_MARKET_STATE: MarketState = {
  status: 'idle',
  pool: [],
  pendingOffer: null,
  season: 0,
};

/* ── Helpers de UI ──────────────────────────────────────────────── */

export type FilterCriteria = {
  position?: Position | null;
  maxPrice?: number;
  maxAge?: number;
  clubId?: string | null;
};

export function filterMarketPool(pool: MarketPlayer[], criteria: FilterCriteria): MarketPlayer[] {
  return pool.filter((p) => {
    if (criteria.position && p.position !== criteria.position) return false;
    if (criteria.maxPrice !== undefined && p.value > criteria.maxPrice) return false;
    if (criteria.maxAge !== undefined && p.age > criteria.maxAge) return false;
    if (criteria.clubId && p.fromClub.id !== criteria.clubId) return false;
    return true;
  });
}

/**
 * Construye el `MarketState` inicial al entrar al flow (mirror of the same
 * shape the store creates).
 */
export function openMarketState(
  rng: Rng,
  input: { season: number; excludeClubId?: string | null },
): MarketState {
  return {
    status: 'open',
    pool: generateMarketPool(rng, { seed: rng.snapshot().seed, excludeClubId: input.excludeClubId }),
    pendingOffer: null,
    season: input.season,
  };
}

/**
 * Detalle-jugador con datos crudos del pool (read-only).
 */
export function findMarketPlayer(pool: MarketPlayer[], playerId: string): MarketPlayer | null {
  return pool.find((p) => p.id === playerId) ?? null;
}

/**
 * Suma el valor del pool para mostrar en UI (placeholder — total ofertado).
 */
export function totalOfferedInPool(pool: MarketPlayer[]): number {
  return pool.reduce((sum, p) => sum + p.value, 0);
}

// Re-export para que la UI no importe de dos lugares.
export type { ClubWithPosition };