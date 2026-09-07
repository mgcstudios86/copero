/**
 * F2.2 — Helpers de "acción semanal" (MGC-1628 rev 3 §L1).
 *
 * Tres firmas puras que el motor consume cada semana. Se mantienen en
 * un módulo separado de `simulation.ts` (que es la lógica reactiva del
 * state machine) para que QA y code-reviewer puedan validar las firmas
 * antes de cablear la lógica de F2.2.
 *
 * Acceptance bar (MGC-1628 rev 3):
 * - Puras: sin side-effects.
 * - Deterministas excepto donde explícitamente reciben `rng`.
 * - Devuelven siempre un valor (nunca `undefined`).
 */
import type { AttributeKey, PlayerProfile } from '@/types/career';
import type { Rng } from './rng';

/**
 * Firma: `fatigueDeltaFor(action, rng) → number`.
 *
 * Devuelve el delta de fatiga (`0..100`) que la acción semanal genera
 * sobre el jugador. Positivo = suma cansancio; negativo = recupera.
 * Consume RNG para que las decisiones "ligeras" o "pesadas" sean
 * reproducibles (semilla determinista por `week + season`).
 *
 * Acción semanal = id de la strategy seleccionada por el jugador en
 * esa semana (E1..E5, M1..M5, T1..T4, R1..R4, O1..O4, V1..V7, L1..L3).
 * Helpers que la UI invoca pre-render se listan en
 * `strategy.ts#WEEKLY_STRATEGIES`.
 */
export type WeeklyActionId = string;

export function fatigueDeltaFor(action: WeeklyActionId, rng: Rng): number {
  // Placeholder F2.2: el delta real se calcula en F2.2+ desde la tabla
  // base de cada action. Mantenemos la firma estable para que los
  // callers (p.ej. `simulation.ts#applyChoice`) compilen.
  return rng.int(0, 0);
}

/**
 * Firma: `needsInjuryCheck(action) → boolean`.
 *
 * Determina si la acción semanal abre la ventana de chequeo de lesión
 * (delegada a `injury-v2.ts#maybeRollInjury`). Por convención MGC-1628
 * rev 3: las acciones de partido (M*) y los `E5` (entrenamiento duro)
 * abren la ventana; las decisiones de rehab (L*) NO (el jugador está
 * lesionado, no acumula riesgo).
 */
export function needsInjuryCheck(action: WeeklyActionId): boolean {
  if (!action) return false;
  if (action.startsWith('L')) return false;
  if (action.startsWith('M')) return true;
  if (action === 'E5') return true;
  return false;
}

/**
 * Firma: `applyTrainingDelta(profile, action, rng) → { profile, attrs }`.
 *
 * Aplica el delta de entrenamiento semanal sobre el `profile.attrs`.
 * Si el jugador está lesionado, el delta al `affectedAttr` se divide
 * por 2 (rehab parcial); el resto de los atributos recibe el delta
 * nominal. Si no, todos los atributos reciben el delta nominal.
 *
 * Devuelve un objeto inmutable con `profile` (clonado con `attrs`
 * actualizado) y `attrs` (referencia al nuevo record). Compatible
 * con `simulation.ts#applyDeltas` que también retorna `{ career, attrs }`.
 */
export function applyTrainingDelta(
  profile: PlayerProfile,
  action: WeeklyActionId,
  rng: Rng,
): { profile: PlayerProfile; attrs: PlayerProfile['attrs'] } {
  // Placeholder F2.2: la lógica real (tabla de deltas por acción +
  // rehab penalty) se cablea en F2.2+ cuando la firma esté validada
  // por code-reviewer. Por ahora devolvemos el profile intacto.
  rng.int(0, 0);
  return { profile, attrs: profile.attrs };
}

/**
 * Tipo exportado para que `simulation.ts` pueda declarar
 * `WeeklyActionResolver` (action → {fatigue, injuryCheck, training})
 * sin importar el módulo concreto de strategies.
 */
export type WeeklyActionResolver = {
  fatigue: (action: WeeklyActionId, rng: Rng) => number;
  injuryCheck: (action: WeeklyActionId) => boolean;
  training: (
    profile: PlayerProfile,
    action: WeeklyActionId,
    rng: Rng,
  ) => { profile: PlayerProfile; attrs: PlayerProfile['attrs'] };
};

/** Re-export del alias local para que el `AttributeKey` se pueda usar en
 *  tests que importen sólo este módulo. */
export type { AttributeKey, PlayerProfile, Rng };