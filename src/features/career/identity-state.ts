// src/features/career/identity-state.ts — Copero (MGC-543 code-split)
//
// Helpers LIVIANOS de la pantalla de identidad del simulador de carrera.
// NO importan `engine.ts` ni `simulation.ts` (que arrastran `strategy.ts`
// 378 líneas + `reputation.ts`). Esto permite que el chunk inicial de
// /simulador-carrera/identity sólo descargue la lógica necesaria para
// la primera pantalla: profile por defecto, validación de campos y
// setters de los 5 atributos de identidad (name/number/position/nationality/foot).
//
// Acciones pesadas (`commitIdentity`, `openAcademy`, `acceptClub`, `decide`,
// `advance`, `reset`) siguen requiriendo `engine.step` y se importan vía
// dynamic import desde el store. Ver `src/shared/store/careerStore.ts`.
//
// Acceptance criteria MGC-543: transfer /identity <= 415 KB (delta <= 10 KB
// sobre local g4 408 KB). Reducir el entry chunk separa strategy.ts (~120 KB
// sospechados) del primer paint.

import type {
  CareerSnapshot,
  Foot,
  PlayerProfile,
  Position,
} from '@/types/career';
import { affectedAttrFor } from '@/types/career';

/** Profile por defecto. Espejo de `engine.ts#initialProfile` pero standalone. */
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
    // MGC-1657 (F2.3) — campos nuevos persistidos en v:2.
    doubleShiftStreak: 0,
    matchweekStats: { clubId: '', apps: 0, goals: 0, ast: 0 },
  },
  // MGC-1657 (F2.3) — stats posicionales V2 inicializadas en 50.
  positionStats: {
    reflejos: 50, posicionamiento: 50, salida: 50, manos: 50,
    marcaje: 50, cabeceo: 50, anticipacion: 50,
    vision: 50, pase: 50, dribling: 50, resistencia: 50,
    definicion: 50, velocidad: 50, regate: 50, juegoAereo: 50,
  },
  week: 1,
  season: 1,
  clubPresupuesto: 0,
  clubInteres: false,
};

export const initialSnapshot = (): CareerSnapshot => ({
  stage: 'identity',
  profile: initialProfile,
});

/** ¿El profile tiene los campos mínimos para pasar de identity a dashboard? */
export function isIdentityComplete(profile: PlayerProfile): boolean {
  return (
    profile.name.trim().length >= 2 && profile.number >= 1 && profile.number <= 99
  );
}

/** Setters inmutables para los 5 campos de identidad. Sin tocar `engine.ts`. */
export const setName = (state: CareerSnapshot, name: string): CareerSnapshot => ({
  ...state,
  profile: { ...state.profile, name },
});

export const setNumber = (state: CareerSnapshot, number: number): CareerSnapshot => {
  const n = Math.max(1, Math.min(99, Math.floor(number)));
  return { ...state, profile: { ...state.profile, number: n } };
};

export const setPosition = (
  state: CareerSnapshot,
  position: Position,
): CareerSnapshot => ({
  ...state,
  profile: { ...state.profile, position },
});

export const setNationality = (
  state: CareerSnapshot,
  code: string,
): CareerSnapshot => ({
  ...state,
  profile: { ...state.profile, nationalityCode: code },
});

/** MGC-955: setter puro para la liga de origen. Sin tocar motor. */
export const setLeague = (
  state: CareerSnapshot,
  code: string,
): CareerSnapshot => ({
  ...state,
  profile: { ...state.profile, leagueCode: code },
});

export const setPreferredFoot = (
  state: CareerSnapshot,
  foot: Foot,
): CareerSnapshot => ({
  ...state,
  profile: { ...state.profile, preferredFoot: foot },
});
