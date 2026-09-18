/**
 * RngSnapshot — Mulberry32 determinista con persistencia opaca (MGC-497 / AC8).
 *
 * Wrapper sobre `src/engine/rng.ts` (Mulberry32 ADR-0016). Expone un objeto
 * "snapshot" **realmente opaco**: las propiedades `seed`, `state` y `draws`
 * se sirven vía `Proxy` desde una celda de closure interna. Cualquier
 * intento de `snap.state = X` o `snap.draws = X` se ignora silenciosamente,
 * así la opacidad se enforce a nivel runtime (no sólo TypeScript). ADR-0016
 * v2 D1/D2 — la única vía para avanzar el cursor es vía los mutadores
 * nombrados (`nextInt`, `nextFloat`, `nextPick`) o la factory
 * `createRngFromSnapshot` que devuelve una instancia con cursor interno.
 *
 * AC8 — test `__tests__/bracket.test.ts`: 100 corridas con misma seed →
 * el `fingerprint(snapshot)` final debe ser byte-equal.
 *
 * Contrato ADR-0016 v2:
 *  - D1: cursor monotónico; `createRngFromSnapshot(snap)` devuelve una
 *    instancia que avanza el cursor exactamente 1 unidad por draw.
 *  - D2: `snapshotToSave` atómico; este módulo expone `serialize` /
 *    `deserialize` para persistir el snapshot opaco.
 *  - D3: `CopaBracket.generate(input, snapshot)` consume este snapshot y
 *    devuelve el snapshot actualizado (ver `CopaBracket.generate`).
 */

import {
  nextRng,
  pickOne,
  randomInt,
  seedToState,
} from '@/engine/rng';

/**
 * Snapshot opaco. La opacidad se enforce runtime vía Proxy: `state` y
 * `draws` viven en una celda de closure capturada por el handler y NO son
 * data properties del objeto. La asignación `snap.state = X` activa el
 * `set` trap del Proxy, que retorna `true` sin tocar la celda interna.
 */
export type RngSnapshot = {
  readonly seed: string;
  readonly state: number;
  readonly draws: number;
};

/** Versión del esquema persistido (debe matchear la key `copero.copa.v1`). */
export const SNAPSHOT_VERSION = 1 as const;

export type SerializedSnapshot = {
  v: typeof SNAPSHOT_VERSION;
  seed: string;
  state: number;
  draws: number;
};

interface InternalCell {
  seed: string;
  state: number;
  draws: number;
}

/**
 * Construye el Proxy opaco. Cada llamada devuelve un Proxy con su propia
 * celda de closure — `nextInt(snapA, …)` no puede afectar `snapB` aunque
 * ambos vengan de la misma `create(seed)`.
 */
function makeProxy(internal: InternalCell): RngSnapshot {
  return new Proxy({} as RngSnapshot, {
    get(_target, prop) {
      if (prop === 'seed') return internal.seed;
      if (prop === 'state') return internal.state;
      if (prop === 'draws') return internal.draws;
      return undefined;
    },
    // Opaque write: ignoramos toda escritura a `seed/state/draws`.
    // Devolvemos `true` para no lanzar TypeError en strict mode (los
    // módulos ES son strict por default; vitest jsdom también).
    set(_target, _prop, _value) {
      return true;
    },
    has(_target, prop) {
      return prop === 'seed' || prop === 'state' || prop === 'draws';
    },
    ownKeys() {
      return ['seed', 'state', 'draws'];
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (prop === 'seed' || prop === 'state' || prop === 'draws') {
        return {
          configurable: true,
          enumerable: true,
          writable: false,
          value: undefined,
        };
      }
      return undefined;
    },
  });
}

/**
 * Crea un snapshot fresco a partir de una seed.
 * Equivale a `createRngFromSnapshot`-desde-cero, pero útil cuando todavía
 * no tengo un snapshot persistido (primera ejecución / recovery).
 */
export function create(seed: string): RngSnapshot {
  if (!seed || typeof seed !== 'string') {
    throw new Error('RngSnapshot.create: seed debe ser string no vacío');
  }
  return makeProxy({ seed, state: seedToState(seed), draws: 0 });
}

/**
 * Instancia RNG con cursor interno en closure. Cada `rngInt/rngFloat/
 * rngPick` avanza el cursor exactamente 1 unidad y devuelve el snapshot
 * actualizado + el valor producido. ADR-0016 D1.
 */
export interface Rng {
  readonly rngInt: (
    min: number,
    max: number,
  ) => { snap: RngSnapshot; value: number };
  readonly rngFloat: () => { snap: RngSnapshot; value: number };
  readonly rngPick: <T>(
    items: readonly T[],
  ) => { snap: RngSnapshot; value: T };
}

/**
 * Construye una instancia RNG con cursor interno a partir de un snapshot
 * vigente. El caller propaga `result.snap` y lo reemplaza por el siguiente
 * `createRngFromSnapshot(nextSnap)` si quiere mantener viva la instancia
 * entre draws (típico: el caller guarda `result.snap` y la próxima vez
 * vuelve a llamar `createRngFromSnapshot(snap)`).
 *
 * Caso típico de CopaBracket.generate: crear la instancia al recibir el
 * snapshot, y propagar el `snap` retornado en cada draw para devolver el
 * snapshot actualizado al final de la generación.
 */
export function createRngFromSnapshot(snap: RngSnapshot): Rng {
  let current: RngSnapshot = snap;
  return {
    rngInt: (min, max) => {
      const r = nextInt(current, min, max);
      current = r.snap;
      return r;
    },
    rngFloat: () => {
      const r = nextFloat(current);
      current = r.snap;
      return r;
    },
    rngPick: <T>(items: readonly T[]) => {
      const r = nextPick<T>(current, items);
      current = r.snap;
      return r;
    },
  };
}

/**
 * Entero en [min, max] inclusivo, avanzando el estado.
 * Devuelve un NUEVO snapshot (state y draws actualizados); el snapshot
 * pasado queda intacto (es opaco vía Proxy). El caller propaga `r.snap`.
 */
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
    snap: makeProxy({
      seed: snap.seed,
      state: r.state,
      draws: snap.draws + 1,
    }),
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
    snap: makeProxy({
      seed: snap.seed,
      state: r.state,
      draws: snap.draws + 1,
    }),
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
    snap: makeProxy({
      seed: snap.seed,
      state: r.state,
      draws: snap.draws + 1,
    }),
    value: r.item,
  };
}

/**
 * Serializa a JSON **estable** (claves en orden determinístico).
 * Importante: NO usar `JSON.stringify` directo sobre el objeto — el Proxy
 * opaco serializa sus tres props (`seed`, `state`, `draws`) pero este
 * helper embebe la versión para futuras migraciones silenciosas.
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
  return makeProxy({
    seed: parsed.seed,
    state: parsed.state >>> 0,
    draws: parsed.draws,
  });
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
