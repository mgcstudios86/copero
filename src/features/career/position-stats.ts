/**
 * F2.2 — Stats por posición (MGC-1629).
 *
 * Complementa `attrs: tecnico/fisico/mental/portero` del motor V1 con
 * 4 stats específicos por línea (GK · DEF · MID · FWD). El motor V2
 * los usa para el árbol semanal posicional y la resolución del partido.
 *
 * Spec MGC-1628 §alcance (referencia, aún no publicada como doc):
 * - GK : reflejos · posicionamiento · salida · manos
 * - DEF: marcaje  · cabeceo     · anticipación · salida
 * - MID: visión   · pase        · dribling · resistencia
 * - FWD: definición· velocidad   · regate    · juego aéreo
 *
 * Cada stat es 0..99. Inicio en 50 (mediano) para todos los slots.
 */

import type { Position, PositionGroup } from '@/types/career';

export type StatKey =
  // GK
  | 'reflejos' | 'posicionamiento' | 'salida' | 'manos'
  // DEF
  | 'marcaje' | 'cabeceo' | 'anticipacion'
  // MID
  | 'vision' | 'pase' | 'dribling' | 'resistencia'
  // FWD
  | 'definicion' | 'velocidad' | 'regate' | 'juegoAereo';

export type PositionStats = Record<StatKey, number>;

export const STAT_INIT: PositionStats = {
  reflejos: 50, posicionamiento: 50, salida: 50, manos: 50,
  marcaje: 50, cabeceo: 50, anticipacion: 50,
  vision: 50, pase: 50, dribling: 50, resistencia: 50,
  definicion: 50, velocidad: 50, regate: 50, juegoAereo: 50,
};

export const STAT_MAX = 99;
export const STAT_MIN = 0;

export const GK_STATS: StatKey[] = ['reflejos', 'posicionamiento', 'salida', 'manos'];
export const DEF_STATS: StatKey[] = ['marcaje', 'cabeceo', 'anticipacion', 'salida'];
export const MID_STATS: StatKey[] = ['vision', 'pase', 'dribling', 'resistencia'];
export const FWD_STATS: StatKey[] = ['definicion', 'velocidad', 'regate', 'juegoAereo'];

export const STATS_BY_GROUP: Record<PositionGroup, StatKey[]> = {
  goalkeeper: GK_STATS,
  defense: DEF_STATS,
  midfield: MID_STATS,
  attack: FWD_STATS,
};

/** Devuelve los 4 stats que aplican a una posición. */
export function statsForPosition(position: Position): StatKey[] {
  switch (position) {
    case 'GK': return GK_STATS;
    case 'CB':
    case 'LB':
    case 'RB': return DEF_STATS;
    case 'CDM':
    case 'CM':
    case 'CAM':
    case 'LM':
    case 'RM': return MID_STATS;
    case 'ST':
    case 'LW':
    case 'RW': return FWD_STATS;
  }
}

export const clampStat = (n: number) => Math.max(STAT_MIN, Math.min(STAT_MAX, n));

export function applyStatDeltas(
  stats: PositionStats,
  deltas: Partial<Record<StatKey, number>>,
): PositionStats {
  const next = { ...stats };
  for (const [k, d] of Object.entries(deltas)) {
    if (d === undefined) continue;
    const key = k as StatKey;
    next[key] = clampStat((next[key] ?? STAT_INIT[key]) + d);
  }
  return next;
}

/** Suma de los 4 stats de la posición (0..396). Útil para OVR-match. */
export function statsSumForPosition(stats: PositionStats, position: Position): number {
  const keys = statsForPosition(position);
  return keys.reduce((acc, k) => acc + (stats[k] ?? STAT_INIT[k]), 0);
}
