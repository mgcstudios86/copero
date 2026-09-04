/**
 * Loop temporada-a-temporada (MGC-208 §3).
 *
 * El corazón de la carrera. Una temporada es determinista y se calcula
 * desde el `Rng` + el arquetipo del club + el OVR/potencial del jugador.
 *
 * Por temporada:
 * - Edad +1.
 * - OVR drift hacia el potencial: si actual < potencial → +Δ según
 *   arquetipo del club (DESARROLLO > EQUILIBRIO > AMBICIÓN en minutos).
 * - Estadísticas de partido (apps/goals/assists) según OVR y arquetipo.
 * - Eventos: lesión probabilística, oferta de club mejor, convocatoria
 *   a selección, prensa positiva/negativa, título del club.
 *
 * Pure functions: no muta el profile, devuelve un nuevo profile + la fila
 * de timeline + los eventos disparados.
 */

import type {
  CareerEvent,
  CareerStats,
  Club,
  ClubArchetype,
  PlayerProfile,
  SeasonLog,
  TimelineSeason,
  YearlyPlan,
} from '@/types/career';
import { YEARLY_PLAN_MODIFIERS } from '@/types/career';
import { recomputeReputation } from './reputation';
import type { Rng } from './rng';

/** Edad de retiro (alineada con la maqueta Vite+React, MGC-11 §FinCarrera). */
export const RETIREMENT_AGE = 34;

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

/** Pesos de crecimiento según arquetipo de club (MGC-208 §2). */
const GROWTH_PER_ARCHETYPE: Record<ClubArchetype, number> = {
  DESARROLLO: 3.5, // muchos minutos, mucho growth
  EQUILIBRIO: 2.5,
  AMBICIÓN: 1.5, // banca dura, menos minutos, growth más lento
};

/** Probabilidad de lesión grave por temporada según edad. */
function injuryChanceForAge(age: number, _rng: Rng): number {
  // Picos a los 18 (crecimiento) y a partir de los 30.
  let p = 0.08;
  if (age >= 30) p += (age - 29) * 0.04;
  if (age <= 18) p += 0.03;
  return p;
}

/** Multiplicador de drift OVR + lesión según el `yearlyPlan` elegido (MGC-1017). */
function yearlyPlanModifiers(profile: PlayerProfile): {
  drift: number;
  injury: number;
} {
  const plan: YearlyPlan | undefined = profile.career.yearlyPlan;
  if (!plan) return { drift: 1, injury: 1 };
  const m = YEARLY_PLAN_MODIFIERS[plan];
  return { drift: m.drift, injury: m.injury };
}

/** Stats de partido por temporada según OVR y minutos disponibles. */
function seasonMatchStats(
  profile: PlayerProfile,
  archetype: ClubArchetype,
  rng: Rng,
): { apps: number; goals: number; assists: number } {
  const minutesFactor =
    archetype === 'DESARROLLO' ? 0.9 : archetype === 'EQUILIBRIO' ? 0.65 : 0.4;
  const baseApps = Math.round(38 * minutesFactor);
  const apps = clamp(baseApps + rng.int(-4, 4), 8, 42);
  // Goles: dependen de OVR y posición. ST/CAM/LW/RW convierten más.
  const shooter =
    profile.position === 'ST' ||
    profile.position === 'CAM' ||
    profile.position === 'LW' ||
    profile.position === 'RW';
  const goalRate = shooter ? profile.ovr / 220 : profile.ovr / 380;
  const goals = Math.max(0, Math.round(apps * goalRate * rng.next()));
  // Asistencias: PAS / DRI pesan más.
  const assistRate = profile.attrs.tecnico / 240;
  const assists = Math.max(0, Math.round(apps * assistRate * rng.next()));
  return { apps, goals, assists };
}

/** Probabilidad de que el club gane un título en la temporada (proxy). */
function titleChanceForClub(club: Club): number {
  const rep = club.reputation ?? 3;
  return rep >= 4 ? 0.4 : rep >= 3 ? 0.2 : 0.08;
}

/** Probabilidad de oferta de un club mejor por temporada. */
function offerChance(age: number, ovr: number): number {
  if (ovr < 70) return 0;
  if (age >= 30) return 0.05;
  if (ovr >= 85) return 0.4;
  if (ovr >= 75) return 0.2;
  return 0.1;
}

/** Probabilidad de convocatoria a la selección (MGC-208 §3). */
function seleccionChance(ovr: number, age: number): boolean {
  return ovr >= 80 && age >= 18 && age <= 33;
}

/**
 * Avanza una temporada completa. Devuelve:
 * - profile nuevo (edad +1, stats actualizadas, OVR drift, lesión posible)
 * - la fila de timeline correspondiente
 * - los eventos disparados durante la temporada
 */
export function advanceSeason(
  profile: PlayerProfile,
  club: Club,
  rng: Rng,
): { profile: PlayerProfile; row: TimelineSeason; events: CareerEvent[] } {
  const season = profile.season;
  const age = profile.age + 1;
  const archetype: ClubArchetype = club.archetype ?? 'EQUILIBRIO';

  // 1) OVR drift hacia el potencial (MGC-208 §3): el techo está guardado
  //    en `profile.value` por `applyCardToProfile` (engine.ts). Si no
  //    hay valor guardado (carrera legacy), usa el OVR actual como techo.
  const potencial = profile.value > 0 ? profile.value : profile.ovr;
  const headroom = Math.max(0, potencial - profile.ovr);
  // Drift base depende del arquetipo; se reduce si ya casi tocamos techo.
  const baseDrift = GROWTH_PER_ARCHETYPE[archetype] * rng.next();
  // MGC-1017: el plan anual elegido al cierre de la temporada pasada
  // modifica el drift. 'agresivo' lo boostea; 'cuidarse' lo reduce.
  const planMod = yearlyPlanModifiers(profile);
  const drift = baseDrift * Math.min(1, headroom / 6 + 0.3) * planMod.drift;
  // Drift decae con la edad: a partir de 30 cuesta subir.
  const ageDamp = age >= 30 ? Math.max(0.3, 1 - (age - 29) * 0.15) : 1;
  const baseOvr = profile.ovr;
  const nextOvr = clamp(
    Math.round(baseOvr + drift * ageDamp),
    Math.max(40, baseOvr - 2),
    Math.min(99, baseOvr + 6),
  );

  // 2) Stats de partido.
  const { apps, goals, assists } = seasonMatchStats(
    { ...profile, ovr: nextOvr },
    archetype,
    rng,
  );

  // 3) Lesión probabilística.
  const events: CareerEvent[] = [];
  let career: CareerStats = {
    ...profile.career,
    lesion: { kind: 'ninguna', fechasOut: 0, startedAtWeek: 0, affectedAttr: 'fisico' },
  };
  // MGC-1017: el plan anual también afecta la chance de lesión.
  const injuryChance = injuryChanceForAge(age, rng) * planMod.injury;
  if (rng.chance(injuryChance)) {
    const kind = rng.chance(0.7) ? 'leve' : rng.chance(0.6) ? 'media' : 'grave';
    const fechasOut = kind === 'leve' ? rng.int(2, 4) : kind === 'media' ? rng.int(6, 10) : rng.int(14, 24);
    // MGC-1628 rev 3 §M1 — `affectedAttr` se mapea via `affectedAttrFor`
    // (mismo helper canónico que `injury-v2.ts` y `simulation.ts`).
    // `startedAtWeek` queda en 0 porque el loop anual agrega la fila al
    // `timeline` al cierre, no al disparo semanal.
    const affectedAttr: 'tecnico' | 'mental' | 'fisico' =
      kind === 'leve' ? 'fisico' : kind === 'media' ? 'mental' : 'tecnico';
    career = {
      ...career,
      lesion: { kind, fechasOut, startedAtWeek: 0, affectedAttr },
    };
    events.push({
      season,
      kind: 'injury',
      copyId: 'event_injury',
      values: { kind, fechas: fechasOut },
    });
  }

  // 4) Eventos: oferta, selección, prensa, título.
  if (rng.chance(offerChance(age, nextOvr))) {
    events.push({
      season,
      kind: 'offer',
      copyId: 'event_offer',
      values: { age, ovr: nextOvr },
    });
  }
  if (seleccionChance(nextOvr, age)) {
    events.push({
      season,
      kind: 'seleccion',
      copyId: 'event_seleccion',
      values: { age, ovr: nextOvr },
    });
  }
  if (rng.chance(0.4)) {
    events.push({
      season,
      kind: 'prensa',
      copyId: rng.chance(0.6) ? 'event_prensa_pos' : 'event_prensa_neg',
      values: { age, ovr: nextOvr },
    });
  }
  if (rng.chance(titleChanceForClub(club))) {
    events.push({
      season,
      kind: 'titulo',
      copyId: 'event_titulo',
      values: { club: club.name },
    });
  }

  // 5) Reputación recalculada como pure function (consistente con `reputation.ts`).
  const reputation = recomputeReputation(
    career,
    { ovr: nextOvr, age, week: 38 },
  );

  // 6) Stats acumuladas.
  const stats = {
    apps: profile.stats.apps + apps,
    goals: profile.stats.goals + goals,
    ast: profile.stats.ast + assists,
  };

  const nextProfile: PlayerProfile = {
    ...profile,
    age,
    ovr: nextOvr,
    season: season + 1,
    week: 1,
    stats,
    attrs: { ...profile.attrs },
    // MGC-1017: tras aplicar el plan anual, lo reseteamos para que el
    // usuario elija uno nuevo en cada cierre de temporada. Sin esto, el
    // primer plan persistiría para siempre y el loop se volvería
    // determinista entre temporadas (no habría decisiones anuales).
    career: { ...career, reputation, yearlyPlan: undefined },
    club,
  };

  const row: TimelineSeason = {
    season,
    age,
    clubId: club.id,
    clubName: club.name,
    ovr: nextOvr,
    apps,
    goals,
    assists,
  };

  return { profile: nextProfile, row, events };
}

/**
 * Loop principal: corre temporadas hasta el retiro y devuelve el log
 * completo. Se usa desde el test headless y desde el botón "Pasar
 * temporada" de la UI Expo.
 */
export function runCareerLoop(
  profile: PlayerProfile,
  club: Club,
  rng: Rng,
): { profile: PlayerProfile; log: SeasonLog } {
  const timeline: TimelineSeason[] = [];
  const events: CareerEvent[] = [];
  let current = profile;

  // Fila inicial de la timeline (la temporada 0, pre-debut).
  timeline.push({
    season: 0,
    age: current.age,
    clubId: club.id,
    clubName: club.name,
    ovr: current.ovr,
    apps: 0,
    goals: 0,
    assists: 0,
  });

  while (current.age < RETIREMENT_AGE) {
    const result = advanceSeason(current, club, rng);
    current = result.profile;
    timeline.push(result.row);
    events.push(...result.events);
  }

  return { profile: current, log: { timeline, events } };
}

/** Helper: ¿el jugador llegó al retiro? */
export function isRetired(profile: PlayerProfile): boolean {
  return profile.age >= RETIREMENT_AGE;
}