import type {
  CareerSnapshot,
  CareerStage,
  Club,
  ClubArchetype,
  EstiloRasgo,
  Foot,
  PlayerProfile,
  Position,
  StrategyId,
  YearlyPlan,
} from '@/types/career';
import { affectedAttrFor } from '@/types/career';
import {
  applyChoice,
  applyWeeklyChoice,
  advanceWeek,
  resolveWeeklyMatch,
} from './simulation';
import { createRng, seedFromString, type RngSnapshot } from './rng';
import {
  cardFromPicks,
  initialDraftBoard,
  pickCurrentLegend,
  swapLegend,
  attrsFromCard,
} from './draft';
import { advanceSeason, isRetired, runCareerLoop } from './season';
import { STAT_INIT } from './position-stats';
import type { WeeklyBaseOptionId } from './position-tree';
import { groupOf } from './positions';

/**
 * Reducer puro para el state machine del simulador de carrera (MGC-430
 * + MGC-442 + MGC-208).
 *
 * Cadena: identity -> dashboard -> academy -> clubStart -> draft ->
 * club -> season* -> retirement.
 *
 * La simulación semanal corre con RNG determinista por (week, season)
 * para que QA valide feedback estable (acceptance bar #7 de
 * strategies.md). El draft y el loop anual usan el mismo `seed`
 * guardado en el snapshot para que la carrera sea reproducible.
 */

export type CareerAction =
  | { type: 'setName'; name: string }
  | { type: 'setNumber'; number: number }
  | { type: 'setPosition'; position: Position }
  | { type: 'setNationality'; code: string }
  | { type: 'setPreferredFoot'; foot: Foot }
  | { type: 'commitIdentity' }
  | { type: 'commitIdentityAndDraft'; seed?: number }
  | { type: 'openAcademy' }
  | { type: 'acceptClub'; club: Club }
  | { type: 'decide'; strategyId: StrategyId; choiceId: string }
  /** MGC-1657 (F2.3) — decisión semanal V2. Reemplaza al flujo V1 para
   * el weekly screen; persiste `positionStats` y dispara `maybeRollInjury`
   * post-choice. Idempotente en lesión activa: la única opción válida
   * es `rehabilitacion`. */
  | { type: 'weeklyChoice'; optionId: WeeklyBaseOptionId }
  /** MGC-1657 (F2.3) — invocación de `resolveMatch` al cierre de la
   * matchweek. Suma goals+apps al `profile.stats` y deja el resultado
   * en `career.matchweekStats`. */
  | { type: 'resolveMatchweek' }
  | { type: 'setYearlyPlan'; plan: YearlyPlan }
  /** MGC-1505 — toggle de rasgo (multi-select hasta 2). El reducer hace
   * toggle on/off + dedupe + cap 2; la UI no necesita enforced logic. */
  | { type: 'setEstilo'; rasgos: EstiloRasgo[] }
  | { type: 'advance' }
  | { type: 'startDraft'; seed?: number }
  | { type: 'swapLegend' }
  | { type: 'pickLegend' }
  | { type: 'pickClub'; club: Club }
  | { type: 'advanceSeason' }
  | { type: 'runCareerToRetirement' }
  | { type: 'reset' };

export const initialProfile: PlayerProfile = {
  name: '',
  number: 9,
  position: 'ST',
  nationalityCode: 'AR',
  leagueCode: '',
  preferredFoot: 'right',
  age: 16,
  club: null,
  value: 0,
  ovr: 50,
  stats: { apps: 0, goals: 0, ast: 0 },
  attrs: { tecnico: 60, fisico: 60, mental: 60, portero: 50 },
  career: {
    presupuesto: 0,
    moral: 70,
    fisico: 80,
    confianza: 60,
    racha: 0,
    lesion: { kind: 'ninguna', fechasOut: 0, startedAtWeek: 0, affectedAttr: affectedAttrFor('ninguna') },
    reputation: {
      prensa: 'neutral',
      hinchada: 'aceptado',
      vestuario: 'integrado',
      seleccionConvocado: false,
    },
    doubleShiftStreak: 0,
    matchweekStats: { clubId: '', apps: 0, goals: 0, ast: 0 },
  },
  // MGC-1657 (F2.3) — stats posicionales V2 inicializados en 50 (mediano)
  // por slot. La migración v:1→v:2 también produce este shape.
  positionStats: { ...STAT_INIT },
  week: 1,
  season: 1,
  clubPresupuesto: 0,
  clubInteres: false,
};

export const initialSnapshot = (): CareerSnapshot => ({
  stage: 'identity',
  profile: { ...initialProfile },
  draft: null,
  card: null,
  log: { timeline: [], events: [] },
});

export function step(state: CareerSnapshot, action: CareerAction): CareerSnapshot {
  switch (action.type) {
    case 'setName':
      return { ...state, profile: { ...state.profile, name: action.name } };
    case 'setNumber': {
      const n = Math.max(1, Math.min(99, Math.floor(action.number)));
      return { ...state, profile: { ...state.profile, number: n } };
    }
    case 'setPosition':
      return { ...state, profile: { ...state.profile, position: action.position } };
    case 'setNationality':
      return { ...state, profile: { ...state.profile, nationalityCode: action.code } };
    case 'setPreferredFoot':
      return { ...state, profile: { ...state.profile, preferredFoot: action.foot } };
    case 'commitIdentity':
      return { ...state, stage: 'dashboard' };
    case 'commitIdentityAndDraft': {
      // MGC-249: el flujo "Empezar carrera" desde el home/identity enruta
      // directo al draft (sin pasar por dashboard) para no romper la cadena
      // draft → club → temporada. Inicializa board + seed determinista.
      const seed = action.seed ?? seedFromString(state.profile.name || 'copero');
      return {
        ...state,
        stage: 'draft',
        draft: initialDraftBoard(),
        card: null,
        seed,
      };
    }
    case 'openAcademy':
      return { ...state, stage: 'academy' };
    case 'acceptClub':
      return {
        ...state,
        stage: 'clubStart',
        profile: {
          ...state.profile,
          club: action.club,
          clubPresupuesto: action.club.presupuesto,
          clubInteres: true,
        },
      };
    case 'decide': {
      const seed = state.profile.week * 1009 + state.profile.season * 31 + seedFromString(action.strategyId);
      const { profile } = applyChoice(
        state.profile,
        action.strategyId,
        action.choiceId,
        createRng(seed),
      );
      return { ...state, profile };
    }
    case 'weeklyChoice': {
      // MGC-1657 (F2.3) — flujo V2 semanal. Garantiza positionStats
      // presente (hidrata STAT_INIT si el profile viene de save v:1 no
      // migrado).
      // MGC-1676 — pasa `state.rng` para que el cursor se reanude y se
      // persista tras la decisión (replay determinista post force-stop).
      const profileWithStats: PlayerProfile =
        state.profile.positionStats
          ? state.profile
          : { ...state.profile, positionStats: { ...STAT_INIT } };
      const result = applyWeeklyChoice(profileWithStats, action.optionId, state.rng as RngSnapshot | undefined);
      return { ...state, profile: result.profile, rng: result.rngSnapshot };
    }
    case 'resolveMatchweek': {
      // MGC-1657 (F2.3) — cierre de matchweek. Acumula stats y deja
      // evidencia en `career.matchweekStats`. El caller (UI semanal)
      // decide cuándo disparar (manual vs auto al cierre del weekly
      // choice de tipo partido).
      // MGC-1676 — pasa `state.rng` y persiste snapshot avanzado.
      const result = resolveWeeklyMatch(state.profile, state.rng as RngSnapshot | undefined);
      return { ...state, profile: result.profile, rng: result.rngSnapshot };
    }
    case 'setYearlyPlan': {
      // MGC-1017: el usuario elige un plan anual al cierre de cada
      // temporada. Se persiste en `profile.career.yearlyPlan` y se
      // CONSUME en el próximo `advanceSeason` (que lo resetea a
      // `undefined` después de aplicar el modifier). Esto garantiza
      // que el loop requiera decisión cada año.
      if (state.stage !== 'season' && state.stage !== 'club' && state.stage !== 'clubStart') {
        // El plan sólo aplica una vez iniciada la vida de carrera
        // profesional; antes del primer partido lo ignoramos.
        return state;
      }
      return {
        ...state,
        profile: {
          ...state.profile,
          career: { ...state.profile.career, yearlyPlan: action.plan },
        },
      };
    }
    case 'setEstilo': {
      // MGC-1505: setter idempotente. La UI ya garantiza cap 2 + dedupe,
      // pero el reducer re-sanitiza defensivamente: dedupe (Set), cap 2,
      // descartar valores que no estén en el catálogo canónico.
      const allowed = new Set<EstiloRasgo>(['magneto-mediatico', 'trotamundos']);
      const cleaned = Array.from(
        new Set(action.rasgos.filter((r): r is EstiloRasgo => allowed.has(r))),
      ).slice(0, 2);
      return {
        ...state,
        profile: {
          ...state.profile,
          career: { ...state.profile.career, estilo: cleaned },
        },
      };
    }
    case 'advance': {
      // MGC-441 / MGC-491: si la semana llega al rollover (week >= 38) y
      // hay club asignado, delegamos al helper compartido de rollover
      // (`applySeasonRollover`) para acumular OP/OG/OA y demás stats
      // anuales. Mantiene granularidad semanal fina para semanas 1..37 y
      // anual para el cierre de temporada (recomendación CTO opción 1).
      // Si no hay club, fallback a `advanceWeek` (no-op silencioso para
      // stats; el rollover cronológico de season/week/age sí ocurre, ver
      // MGC-441 causa 2).
      if (state.profile.week >= 38 && state.profile.club) {
        return applySeasonRollover(state);
      }
      return { ...state, profile: advanceWeek(state.profile) };
    }
    case 'startDraft': {
      const seed = action.seed ?? seedFromString(state.profile.name || 'copero');
      return {
        ...state,
        stage: 'draft',
        draft: initialDraftBoard(),
        card: null,
        seed,
      };
    }
    case 'swapLegend': {
      if (!state.draft) return state;
      return { ...state, draft: swapLegend(state.draft) };
    }
    case 'pickLegend': {
      if (!state.draft) return state;
      const result = pickCurrentLegend(state.draft);
      const card = result.card ?? state.card;
      const stage = result.card ? 'club' : 'draft';
      // Cuando se confirma el último pick, mezclamos la card al profile
      // y pasamos al selector de club.
      if (result.card) {
        const merged = applyCardToProfile(state.profile, result.card);
        return {
          ...state,
          stage,
          draft: result.board,
          card,
          profile: merged,
        };
      }
      return { ...state, draft: result.board, card };
    }
    case 'pickClub': {
      if (!state.card) return state;
      const archetype: ClubArchetype = action.club.archetype ?? 'EQUILIBRIO';
      // Modificadores del arquetipo: DESARROLLO +2 OVR inicial;
      // EQUILIBRIO +1; AMBICIÓN +0 pero reputación alta.
      const archetypeBonus = archetype === 'DESARROLLO' ? 2 : archetype === 'EQUILIBRIO' ? 1 : 0;
      // MGC-249: fit bonus por posición del club. Si el club declara
      // `positionGroups` y el jugador está en ese grupo, suma +1 OVR.
      // La asignación typed a `unknown` evita el ciclo entre engine y clubs.
      const fit = (action.club as unknown as { fitBonus?: number; positionGroups?: string[] })
        .fitBonus ?? 0;
      // MGC-1628 rev 3 §L4 — `groupOf` se importa desde `positions.ts`
      // (helper canónico F2.1). Antes era un `groupMap` inline; ahora
      // es un solo switch exportado, consumible también por `match.ts`
      // y `stats.ts`.
      const playerGroupResolved = groupOf(state.profile.position);
      const positionGroups = (action.club as unknown as { positionGroups?: string[] })
        .positionGroups ?? [];
      const fitBonus =
        positionGroups.includes(playerGroupResolved) ? fit : 0;
      const bonus = archetypeBonus + fitBonus;
      const profile: PlayerProfile = {
        ...state.profile,
        club: action.club,
        clubPresupuesto: action.club.presupuesto,
        clubInteres: true,
        ovr: Math.min(99, state.profile.ovr + bonus),
        season: 1,
        week: 1,
      };
      return {
        ...state,
        stage: 'season',
        profile,
      };
    }
    case 'advanceSeason': {
      // MGC-491: delega al helper compartido para garantizar que la
      // delegación desde `case 'advance'` (week >= 38 && club) y la
      // acción explícita `advanceSeason` (botón "Jugar temporada")
      // produzcan exactamente la misma transición de temporada, stats y
      // timeline. Antes esto era recursión `step(state, {type: 'advanceSeason'})`
      // — funcionaba, pero el código duplicado entre los dos paths
      // dejaba margen a drift accidental en el seed o en el merge del
      // log. Ahora es una sola función pura.
      return applySeasonRollover(state);
    }
    case 'runCareerToRetirement': {
      if (!state.profile.club) return state;
      const baseSeed = state.seed ?? seedFromString(state.profile.name || 'copero');
      const seed = baseSeed + seedFromString(state.profile.name || 'copero');
      const result = runCareerLoop(state.profile, state.profile.club, createRng(seed));
      return {
        ...state,
        stage: 'retirement',
        profile: result.profile,
        log: result.log,
      };
    }
    case 'reset':
      return initialSnapshot();
    default:
      return state;
  }
}

/**
 * Helper compartido (MGC-491) — ejecuta la transición de temporada
 * completa: corre `advanceSeason` con la semilla determinista,
 * acumula stats OP/OG/OA, agrega fila a timeline y eventos al log, y
 * actualiza `stage` a `'retirement'` si el jugador se retira.
 *
 * Es la única vía para que `advance()` (al llegar a week >= 38 con club)
 * y la acción explícita `advanceSeason` produzcan exactamente la misma
 * transición. Sin este helper compartido, los dos paths duplicaban el
 * cálculo de seed + merge del log y un drift accidental entre ellos
 * podría hacer que el botón "Siguiente semana" no acumulara stats
 * mientras "Jugar temporada" sí (ver parent MGC-488).
 *
 * Si no hay club asignado, devuelve `state` sin cambios: la temporada
 * no puede cerrarse sin club (no hay partidos que simular, no hay stats
 * que acumular).
 */
export function applySeasonRollover(state: CareerSnapshot): CareerSnapshot {
  if (!state.profile.club) return state;
  const baseSeed = state.seed ?? seedFromString(state.profile.name || 'copero');
  const seed =
    baseSeed +
    state.profile.season * 1009 +
    seedFromString(state.profile.name || 'copero');
  const result = advanceSeason(state.profile, state.profile.club, createRng(seed));
  const log = {
    timeline: [...(state.log?.timeline ?? []), result.row],
    events: [...(state.log?.events ?? []), ...result.events],
  };
  const stage: CareerStage = isRetired(result.profile) ? 'retirement' : 'season';
  return {
    ...state,
    stage,
    profile: result.profile,
    log,
  };
}

/** Mezcla la PlayerCard en el PlayerProfile (MGC-208 §1 + §3). */
function applyCardToProfile(profile: PlayerProfile, card: ReturnType<typeof cardFromPicks>): PlayerProfile {
  const attrs = attrsFromCard(card);
  return {
    ...profile,
    attrs,
    ovr: card.ovrInicial,
    value: card.potencial,
    age: 16,
    season: 1,
    week: 1,
    stats: { apps: 0, goals: 0, ast: 0 },
    career: {
      ...profile.career,
      presupuesto: 0,
      lesion: { kind: 'ninguna', fechasOut: 0, startedAtWeek: 0, affectedAttr: affectedAttrFor('ninguna') },
      reputation: {
        prensa: 'neutral',
        hinchada: 'aceptado',
        vestuario: 'integrado',
        seleccionConvocado: false,
      },
    },
  };
}

/** Helper: ¿el profile tiene los campos mínimos para pasar de identity a dashboard? */
export function isIdentityComplete(profile: PlayerProfile): boolean {
  return profile.name.trim().length >= 2 && profile.number >= 1 && profile.number <= 99;
}