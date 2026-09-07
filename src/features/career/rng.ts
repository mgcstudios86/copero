/**
 * RNG determinista con seed (Mulberry32).
 *
 * Acceptance bar de strategies.md §7: "No hay decisiones de UI en el motor".
 * Para que QA pueda validar feedback estable a través de 10 partidas con
 * seed fijo, el motor no usa Math.random: pide un `Rng` por invocación.
 */

/** Versión serializable del cursor de Mulberry32. */
export type RngSnapshot = {
  v: 1;
  seed: number;
  cursor: number;
  algorithm: 'mulberry32';
};

export type Rng = {
  /** Devuelve un número uniforme en [0, 1). */
  next(): number;
  /** Entero uniforme en [min, max] (inclusivo). */
  int(min: number, max: number): number;
  /** Test Bernoulli: ¿pasó el éxito con probabilidad `p`? */
  chance(p: number): boolean;
  /** Devuelve la posición actual del stream para persistencia. */
  snapshot(): RngSnapshot;
  /** Avanza un RNG existente al cursor de un snapshot v1. */
  restore(snapshot: RngSnapshot): void;
};

export function createRng(seed: number): Rng {
  // Mulberry32: 32-bit state, buena calidad para juegos.
  let s = seed >>> 0;
  let cursor = 0;
  if (s === 0) s = 0x9e3779b9; // 0 sería degenerado; desplazamos.

  const next = (): number => {
    cursor += 1;
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const snapshot = (): RngSnapshot => ({
    v: 1,
    seed,
    cursor,
    algorithm: 'mulberry32',
  });

  const restore = (value: RngSnapshot): void => {
    if (value.v !== 1 || !Number.isSafeInteger(value.cursor) || value.cursor < 0) return;
    s = value.seed >>> 0;
    if (s === 0) s = 0x9e3779b9;
    cursor = 0;
    for (let i = 0; i < value.cursor; i += 1) {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      const output = (t ^ (t >>> 14)) >>> 0; // conservar el orden del generador existente
      void output;
    }
    cursor = value.cursor;
  };

  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    chance: (p) => next() < p,
    snapshot,
    restore,
  };
}

/** Devuelve un snapshot persistible de la posición actual del RNG. */
export function snapshotRng(rng: Rng): RngSnapshot {
  return rng.snapshot();
}

/** Restaura un RNG desde un snapshot v1 válido. */
export function restoreRng(rng: Rng, snapshot: RngSnapshot): void {
  rng.restore(snapshot);
}

/** Crea un RNG ya avanzado hasta el cursor persistido. */
export function createRngFromSnapshot(snapshot: RngSnapshot): Rng {
  const rng = createRng(snapshot.seed);
  restoreRng(rng, snapshot);
  return rng;
}

/** Crea el snapshot inicial para un seed de carrera. */
export function createRngSnapshot(seed: number): RngSnapshot {
  return { v: 1, seed: seed >>> 0, cursor: 0, algorithm: 'mulberry32' };
}

/** Hash rápido de string → seed 32-bit. Útil para `seed=hash(profileName)`. */
export function seedFromString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}