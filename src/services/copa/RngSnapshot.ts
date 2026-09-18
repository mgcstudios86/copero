/**
 * RngSnapshot — Mulberry32 determinista con persistencia opaca (MGC-497 / AC8).
 *
 * Wrapper sobre `src/engine/rng.ts` (Mulberry32 ADR-0016). Expone un objeto
 * "snapshot" que registra cada transición de estado para que:
 *
 *   1. Reproducir un draw a partir de la misma seed dé bracket byte-equal
 *      (100 iteraciones con misma seed → mismo fingerprint JSON).
 *   2. Persistir el snapshot en AsyncStorage (key `copero.copa.v1`) sin
 *      tener que exponer el estado interno: `serialize()` / `deserialize()`
 *      producen un string JSON estable (claves ordenadas, sin `undefined`).
 *   3. Restaurar a mitad de draw para "save/resume" de ronda de copa.
 *
 * AC8 — test `__tests__/bracket.test.ts`: 100 corridas con misma seed →
 * el `fingerprint(snapshot)` final debe ser byte-equal.
 */

import {
  nextRng,
  pickOne,
  randomInt,
  seedToState,
} from '@/engine/rng';

/** Estado opaco del snapshot. NO se debe mutar desde afuera. */
export type RngSnapshot = {
  readonly seed: string;
  state: number;
  draws: number;
};

/** Versión del esquema persistido (debe matchear la key `copero.copa.v1`). */
export const SNAPSHOT_VERSION = 1 as const;

export type SerializedSnapshot = {
  v: typeof SNAPSHOT_VERSION;
  seed: string;
  state: number;
  draws: number;
};

/** Crea un snapshot fresco a partir de una seed. */
export function create(seed: string): RngSnapshot {
  if (!seed || typeof seed !== 'string') {
    throw new Error('RngSnapshot.create: seed debe ser string no vacío');
  }
  return {
    seed,
    state: seedToState(seed),
    draws: 0,
  };
}

/** Entero en [min, max] inclusivo, avanzando el estado. */
export function nextInt(
  snap: RngSnapshot,
  min: number,
  max: number,
): { snap: RngSnapshot; value: number } {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new Error(
      `RngSnapshot.nextInt: rango inválido [${min}, ${max}]`,
    );
  }
  const r = randomInt(snap.state, min, max);
  return {
    snap: { seed: snap.seed, state: r.state, draws: snap.draws + 1 },
    value: r.value,
  };
}

/** Float en [0, 1), avanzando el estado. */
export function nextFloat(snap: RngSnapshot): {
  snap: RngSnapshot;
  value: number;
} {
  const r = nextRng(snap.state);
  return {
    snap: { seed: snap.seed, state: r.state, draws: snap.draws + 1 },
    value: r.value,
  };
}

/** Pick determinista de un elemento. Lanza si el array está vacío. */
export function nextPick<T>(
  snap: RngSnapshot,
  items: readonly T[],
): { snap: RngSnapshot; value: T } {
  if (items.length === 0) {
    throw new Error('RngSnapshot.nextPick: array vacío');
  }
  const r = pickOne(snap.state, items as T[]);
  return {
    snap: { seed: snap.seed, state: r.state, draws: snap.draws + 1 },
    value: r.item,
  };
}

/**
 * Serializa a JSON **estable** (claves en orden determinístico).
 * Importante: NO usar `JSON.stringify` directo sobre el objeto — el orden
 * de claves es estable para objetos literales, pero si más adelante se
 * agrega un campo nuevo (e.g. `auditLog`) el orden importa para AC8.
 */
export function serialize(snap: RngSnapshot): string {
  const ordered: SerializedSnapshot = {
    v: SNAPSHOT_VERSION,
    seed: snap.seed,
    state: snap.state,
    draws: snap.draws,
  };
  return JSON.stringify(ordered);
}

/** Hidrata un snapshot desde su forma serializada. Lanza si la versión no matchea. */
export function deserialize(raw: string): RngSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `RngSnapshot.deserialize: JSON inválido (${(err as Error).message})`,
    );
  }
  if (!isSerializedSnapshot(parsed)) {
    throw new Error('RngSnapshot.deserialize: shape inválido');
  }
  if (parsed.v !== SNAPSHOT_VERSION) {
    throw new Error(
      `RngSnapshot.deserialize: versión ${parsed.v} no soportada (esperado ${SNAPSHOT_VERSION})`,
    );
  }
  return {
    seed: parsed.seed,
    state: parsed.state >>> 0,
    draws: parsed.draws,
  };
}

/**
 * Fingerprint canónico para el test AC8.
 * Mismo seed → mismo fingerprint byte-equal aún después de 100 iteraciones.
 */
export function fingerprint(snap: RngSnapshot): string {
  // Concatenar seed + state + draws con separador estable. Hex para el state
  // (así no hay decimales con coma vs punto que difieran entre runtimes).
  const stateHex = (snap.state >>> 0).toString(16).padStart(8, '0');
  return `${snap.seed}|${stateHex}|${snap.draws}`;
}

function isSerializedSnapshot(value: unknown): value is SerializedSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  // Aceptamos cualquier v numérico entero para que el mensaje "versión X
  // no soportada" sea el que ve el caller, no un genérico "shape inválido".
  return (
    typeof v.v === 'number' &&
    Number.isInteger(v.v) &&
    typeof v.seed === 'string' &&
    typeof v.state === 'number' &&
    Number.isFinite(v.state) &&
    typeof v.draws === 'number' &&
    Number.isInteger(v.draws) &&
    v.draws >= 0
  );
}
