/**
 * MGC-487 — Temporada loop 5+ semanas + playoffs + fin de año.
 *
 * Helper puro de rollover de fin de temporada (Step 6 de la spec).
 * Encapsula la lógica que `simulation.ts#advanceWeek` aplica
 * implícitamente cuando `profile.week >= 38`: bumpea `season`,
 * resetea `week = 1`, incrementa `age +1` y archiva la temporada
 * cerrada en `history[]`.
 *
 * Esta función existe como API explícita para:
 *  - tests unitarios del contrato (semana 38 → semana 1, season+1)
 *  - la pantalla `season-summary.tsx` que necesita archivar antes de
 *    persistir (MGC-363 `lastSnapshot`).
 *
 * NO toca AsyncStorage directamente: el caller debe invocar
 * `flushPendingSave()` (`careerStore.ts`) después.
 */

import { SEASON_LENGTH } from './phase';

export type RolloverInput = {
  season: number;
  week: number;
  age: number;
  /** Nombre del campeón de la temporada cerrada (opcional). */
  champion?: string | null;
};

export type ArchivedSeason = {
  season: number;
  champion: string | null;
  closedAt: 'rollover';
};

export type RolloverResult = {
  season: number;
  week: number;
  age: number;
  archived: ArchivedSeason;
};

/**
 * Determina si el estado actual debe disparar rollover (semana 38 cerrada).
 */
export function shouldRollover(input: RolloverInput): boolean {
  return input.week >= SEASON_LENGTH;
}

/**
 * Aplica el rollover a un input y devuelve el estado siguiente + el
 * registro de la temporada cerrada. Pure function: no muta.
 */
export function applySeasonRollover(input: RolloverInput): RolloverResult {
  if (!shouldRollover(input)) {
    throw new Error(
      `applySeasonRollover: week=${input.week} no es rollover (debe ser ≥ ${SEASON_LENGTH}).`,
    );
  }
  return {
    season: input.season + 1,
    week: 1,
    age: input.age + 1,
    archived: {
      season: input.season,
      champion: input.champion ?? null,
      closedAt: 'rollover',
    },
  };
}
