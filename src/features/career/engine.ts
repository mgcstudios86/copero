import type { CareerSnapshot, Club, Foot, PlayerProfile, Position } from '@/types/career';

/**
 * Reducer puro para el state machine del simulador de carrera (MGC-430).
 *
 * Cadena mínima: identity -> dashboard -> academy -> clubStart.
 * Mantenemos el reducer fuera del store para poder testearlo sin
 * inicializar zustand ni AsyncStorage.
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