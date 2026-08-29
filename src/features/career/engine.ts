import type {
  CareerSnapshot,
  CareerStage,
  Club,
  ClubArchetype,
  Foot,
  PlayerProfile,
  Position,
  StrategyId,
} from '@/types/career';
import { applyChoice, advanceWeek } from './simulation';
import { createRng, seedFromString } from './rng';
import {
  cardFromPicks,
  initialDraftBoard,
  pickCurrentLegend,
  swapLegend,
  attrsFromCard,
} from './draft';
import { advanceSeason, isRetired, runCareerLoop } from './season';

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
    lesion: { kind: 'ninguna', fechasOut: 0 },
    reputation: {
      prensa: 'neutral',
      hinchada: 'aceptado',
      vestuario: 'integrado',
      seleccionConvocado: false,
    },
  },
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
    case 'advance':
      return { ...state, profile: advanceWeek(state.profile) };
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
      const playerGroup = state.profile.position;
      const groupMap: Record<string, string> = {
        ST: 'attack',
        LW: 'attack',
        RW: 'attack',
        CAM: 'midfield',
        CM: 'midfield',
        LM: 'midfield',
        RM: 'midfield',
        CDM: 'midfield',
        CB: 'defense',
        LB: 'defense',
        RB: 'defense',
        GK: 'goalkeeper',
      };
      const playerGroupResolved = groupMap[playerGroup] ?? 'midfield';
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
      lesion: { kind: 'ninguna', fechasOut: 0 },
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