/**
 * F2.2 — Stats engine (MGC-1629 AC §"Sistema de stats" + MGC-1628 rev 3 M2).
 *
 * Helpers puros sobre `Position` y `ClubArchetype` que parametrizan el
 * cómputo de OVR y la resolución de partido. Se mantienen en un módulo
 * separado del motor (`engine.ts`) y del catálogo (`strategy.ts`) para
 * evitar el ciclo que ya tenía MGC-249 entre `engine.ts` y `clubs.ts`.
 *
 * Acceptance bar:
 * - Deterministas (sin RNG).
 * - Sin estado mutable.
 * - Devuelven siempre un número (nunca `undefined`); los pares sin dato
 *   caen al default `1.0` para no romper `recomputeOvrForPosition`.
 */
import type { ClubArchetype, Position } from '@/types/career';

/**
 * MGC-1628 rev 3 §"positionFactor" — multiplicador de OVR por par
 * `(position, opponentArchetype)`.
 *
 * Modela el "fit" posicional en un contexto táctico: un ST rinde 1.05×
 * su OVR contra un rival DESARROLLO (arquero chico, marcador bajo) y
 * 0.95× contra AMBICIÓN (defensa alta). Inversamente, un CB rinde 1.02×
 * contra AMBICIÓN y 0.97× contra DESARROLLO.
 *
 * El compuesto 1.05 × 1.02 = 1.071 (F2.1 §5) representa el caso límite
 * "ST vs DESARROLLO + arquero AMBICIÓN rival", y es el techo que
 * `recomputeOvrForPosition` puede aplicar al OVR base antes del clamp.
 *
 * Default: 1.0 (sin modificador) para pares sin entrada explícita.
 */
export const POSITION_FACTOR_TABLE: Record<
  Position,
  Partial<Record<ClubArchetype, number>>
> = {
  // Ataque: rinden mejor contra DESARROLLO (defensa baja), peor contra AMBICIÓN.
  ST: { DESARROLLO: 1.05, EQUILIBRIO: 1.0, AMBICIÓN: 0.95 },
  LW: { DESARROLLO: 1.04, EQUILIBRIO: 1.0, AMBICIÓN: 0.96 },
  RW: { DESARROLLO: 1.04, EQUILIBRIO: 1.0, AMBICIÓN: 0.96 },
  CAM: { DESARROLLO: 1.03, EQUILIBRIO: 1.0, AMBICIÓN: 0.97 },
  // Mediocampo: ajuste simétrico, amplitud chica.
  CM: { DESARROLLO: 1.01, EQUILIBRIO: 1.0, AMBICIÓN: 0.99 },
  CDM: { DESARROLLO: 0.99, EQUILIBRIO: 1.0, AMBICIÓN: 1.01 },
  LM: { DESARROLLO: 1.02, EQUILIBRIO: 1.0, AMBICIÓN: 0.98 },
  RM: { DESARROLLO: 1.02, EQUILIBRIO: 1.0, AMBICIÓN: 0.98 },
  // Defensa: rinden mejor contra AMBICIÓN (delantera alta rival), peor contra DESARROLLO.
  CB: { DESARROLLO: 0.97, EQUILIBRIO: 1.0, AMBICIÓN: 1.02 },
  LB: { DESARROLLO: 0.98, EQUILIBRIO: 1.0, AMBICIÓN: 1.01 },
  RB: { DESARROLLO: 0.98, EQUILIBRIO: 1.0, AMBICIÓN: 1.01 },
  // Arquero: el OVR ya está sobre `portero`, no se beneficia del arquetipo rival.
  GK: { DESARROLLO: 1.0, EQUILIBRIO: 1.0, AMBICIÓN: 1.0 },
};

/**
 * Resuelve el factor de posición para el par `(position, opponentArchetype)`.
 * Si el par no tiene entrada explícita en la tabla, devuelve 1.0 (neutro).
 *
 * Pure function. Determinista. Sin RNG.
 */
export function positionFactor(
  position: Position,
  opponentArchetype?: ClubArchetype,
): number {
  if (!opponentArchetype) return 1.0;
  return POSITION_FACTOR_TABLE[position]?.[opponentArchetype] ?? 1.0;
}