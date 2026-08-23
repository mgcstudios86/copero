import type {
  CareerSnapshot,
  Club,
  Foot,
  PlayerProfile,
  Position,
  StrategyId,
} from '@/types/career';
import { applyChoice, advanceWeek } from './simulation';
import { createRng, seedFromString } from './rng';

/**
 * Reducer puro para el state machine del simulador de carrera (MGC-430
 * + MGC-442).
 *
 * Cadena: identity -> dashboard -> academy -> clubStart -> dashboard (loop).
 * La simulación corre con RNG determinista por (week, season) para que
 * QA pueda validar feedback estable (acceptance bar #7 de strategies.md).
 */

export type CareerAction =
  | { type: 'setName'; name: string }
  | { type: 'setNumber'; number: number }
  | { type: 'setPosition'; position: Position }
  | { type: 'setNationality'; code: string }
  | { type: 'setPreferredFoot'; foot: Foot }
  | { type: 'commitIdentity' }
  | { type: 'openAcademy' }
  | { type: 'acceptClub'; club: Club }
  | { type: 'decide'; strategyId: StrategyId; choiceId: string }
  | { type: 'advance' }
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
    case 'openAcademy':
      return { ...state, stage: 'academy' };
    case 'acceptClub':
      return {
        ...state,
        stage: 'clubStart',
        profile: { ...state.profile, club: action.club },
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
    case 'reset':
      return initialSnapshot();
    default:
      return state;
  }
}

/** Helper: ¿el profile tiene los campos mínimos para pasar de identity a dashboard? */
export function isIdentityComplete(profile: PlayerProfile): boolean {
  return profile.name.trim().length >= 2 && profile.number >= 1 && profile.number <= 99;
}