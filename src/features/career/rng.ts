/**
 * RNG determinista con seed (Mulberry32).
 *
 * Acceptance bar de strategies.md §7: "No hay decisiones de UI en el motor".
 * Para que QA pueda validar feedback estable a través de 10 partidas con
 * seed fijo, el motor no usa Math.random: pide un `Rng` por invocación.
 */

export type Rng = {
  /** Devuelve un número uniforme en [0, 1). */
  next(): number;
  /** Entero uniforme en [min, max] (inclusivo). */
  int(min: number, max: number): number;
  /** Test Bernoulli: ¿pasó el éxito con probabilidad `p`? */
  chance(p: number): boolean;
};

export function createRng(seed: number): Rng {
  // Mulberry32: 32-bit state, buena calidad para juegos.
  let s = seed >>> 0;
  if (s === 0) s = 0x9e3779b9; // 0 sería degenerado; desplazamos.

  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    chance: (p) => next() < p,
  };
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