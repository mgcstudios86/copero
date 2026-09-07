/**
 * Fin de carrera — pantalla de resumen (MGC-208 §4).
 *
 * Pure functions. Toma el `SeasonLog` final + el `PlayerProfile` al
 * retiro y devuelve un `RetirementSummary` listo para pintar: edad de
 * retiro, OVR final, totales (apps/goals/assists), vitrina de títulos y
 * legado textual para la UI.
 */

import type {
  CareerEvent,
  PlayerProfile,
  RetirementSummary,
  SeasonLog,
} from '@/types/career';
import { RETIREMENT_AGE } from './season';

/** Construye el resumen final. Pure function. */
export function buildRetirementSummary(
  profile: PlayerProfile,
  log: SeasonLog,
): RetirementSummary {
  const vitrina = log.events
    .filter((e: CareerEvent) => e.kind === 'titulo')
    .map((e) => String(e.values?.club ?? 'Título'));

  const legado = buildLegado(profile, log);

  // MGC-1950 (PR #464 cleanup CTO) — preservar la edad real cuando el
  // jugador se retiró temprano (vía `careerStore.retireEarly`). Antes,
  // `Math.max(profile.age, RETIREMENT_AGE=34)` siempre devolvía 34 aunque
  // la edad real fuera 16. Ahora exponemos `retiredEarly` y usamos la
  // edad real del profile cuando el retiro es temprano. Para retiro
  // natural, `profile.age >= RETIREMENT_AGE` y el comportamiento previo
  // se conserva (con la guarda explícita retiredEarly=false).
  const retiredEarly = profile.age < RETIREMENT_AGE;
  const retirementAge = retiredEarly ? profile.age : profile.age;

  return {
    retirementAge,
    retiredEarly,
    finalOvr: profile.ovr,
    totalApps: profile.stats.apps,
    totalGoals: profile.stats.goals,
    totalAssists: profile.stats.ast,
    vitrina,
    legado,
    timeline: log.timeline,
    events: log.events,
  };
}

/** Genera una línea de legado corta para la UI. */
export function buildLegado(profile: PlayerProfile, log: SeasonLog): string {
  const seasons = log.timeline.length;
  const seasonsTxt = seasons <= 1 ? '1 temporada' : `${seasons} temporadas`;
  const goalsPlusAssists = profile.stats.goals + profile.stats.ast;
  return `${seasonsTxt} · ${profile.stats.apps} partidos · ${goalsPlusAssists} goles+asist. · OVR ${profile.ovr}.`;
}