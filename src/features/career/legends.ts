/**
 * Catálogo de leyendas del draft (MGC-208 §1).
 *
 * Datos espejados de la maqueta visual Vite+React en
 * `copero-web/web/src/data/mock.ts` para garantizar paridad con las 7
 * capturas de MGC-11 que el operador aprobó. Cuando lleguen los assets
 * reales del diseñador (MGC-428) se ajustan colores/crestas; las stats
 * numéricas son contrato.
 *
 * Cada leyenda expone 6 atributos FIFA (PAC/SHO/PAS/DRI/DEF/PHY) y 2
 * skills (SKL/WF 1-5 estrellas). El draft (`draft.ts`) toma `best` y la
 * asigna al slot correspondiente en la `PlayerCard` final.
 */

import type { AttrKey, Legend, PlayerCardEntry, SkillKey } from '@/types/career';

export const DRAFT_SLOTS: readonly (AttrKey | SkillKey)[] = [
  'PAC',
  'SHO',
  'PAS',
  'DRI',
  'DEF',
  'PHY',
  'SKL',
  'WF',
];

export const DRAFT_ROUNDS = DRAFT_SLOTS.length;

export const ATTR_LABELS: Record<AttrKey, string> = {
  PAC: 'Ritmo',
  SHO: 'Tiro',
  PAS: 'Pase',
  DRI: 'Regate',
  DEF: 'Defensa',
  PHY: 'Físico',
};

export const SKILL_LABELS: Record<SkillKey, string> = {
  SKL: 'Skill',
  WF: 'Pierna hábil',
};

export const LEGENDS: Legend[] = [
  {
    id: 'cruyff',
    name: 'Johan Cruyff',
    country: 'NED',
    years: '1964–1984',
    positions: ['CAM', 'ST'],
    attributes: [
      { key: 'PAC', value: 93, label: 'Ritmo' },
      { key: 'SHO', value: 91, label: 'Tiro' },
      { key: 'PAS', value: 94, label: 'Pase' },
      { key: 'DRI', value: 96, label: 'Regate' },
      { key: 'DEF', value: 48, label: 'Defensa' },
      { key: 'PHY', value: 73, label: 'Físico' },
    ],
    skills: [
      { key: 'SKL', value: 5, label: 'Skill' },
      { key: 'WF', value: 5, label: 'Pierna hábil' },
    ],
    best: { key: 'DRI', value: 96 },
    initials: 'JC',
    badgeColor: 'amber',
  },
  {
    id: 'raul',
    name: 'Raúl González',
    country: 'ESP',
    years: '1994–2015',
    positions: ['ST', 'CAM'],
    attributes: [
      { key: 'PAC', value: 88, label: 'Tiro' },
      { key: 'SHO', value: 95, label: 'Tiro' },
      { key: 'PAS', value: 90, label: 'Pase' },
      { key: 'DRI', value: 89, label: 'Regate' },
      { key: 'DEF', value: 41, label: 'Defensa' },
      { key: 'PHY', value: 76, label: 'Físico' },
    ],
    skills: [
      { key: 'SKL', value: 4, label: 'Skill' },
      { key: 'WF', value: 4, label: 'Pierna hábil' },
    ],
    best: { key: 'SHO', value: 95 },
    initials: 'RG',
    badgeColor: 'rose',
  },
  {
    id: 'drogba',
    name: 'Didier Drogba',
    country: 'CIV',
    years: '1998–2018',
    positions: ['ST'],
    attributes: [
      { key: 'PAC', value: 90, label: 'Ritmo' },
      { key: 'SHO', value: 92, label: 'Tiro' },
      { key: 'PAS', value: 78, label: 'Pase' },
      { key: 'DRI', value: 83, label: 'Regate' },
      { key: 'DEF', value: 44, label: 'Defensa' },
      { key: 'PHY', value: 99, label: 'Físico' },
    ],
    skills: [
      { key: 'SKL', value: 3, label: 'Skill' },
      { key: 'WF', value: 4, label: 'Pierna hábil' },
    ],
    best: { key: 'PHY', value: 99 },
    initials: 'DD',
    badgeColor: 'accent',
  },
  {
    id: 'marco-van-basten',
    name: 'Marco Van Basten',
    country: 'NED',
    years: '1981–1995',
    positions: ['ST'],
    attributes: [
      { key: 'PAC', value: 87, label: 'Ritmo' },
      { key: 'SHO', value: 96, label: 'Tiro' },
      { key: 'PAS', value: 85, label: 'Pase' },
      { key: 'DRI', value: 92, label: 'Regate' },
      { key: 'DEF', value: 39, label: 'Defensa' },
      { key: 'PHY', value: 84, label: 'Físico' },
    ],
    skills: [
      { key: 'SKL', value: 4, label: 'Skill' },
      { key: 'WF', value: 4, label: 'Pierna hábil' },
    ],
    best: { key: 'SHO', value: 96 },
    initials: 'MV',
    badgeColor: 'amber',
  },
  {
    id: 'ruud-gullit',
    name: 'Ruud Gullit',
    country: 'NED',
    years: '1979–1998',
    positions: ['CM', 'CAM', 'ST'],
    attributes: [
      { key: 'PAC', value: 91, label: 'Ritmo' },
      { key: 'SHO', value: 86, label: 'Tiro' },
      { key: 'PAS', value: 88, label: 'Pase' },
      { key: 'DRI', value: 87, label: 'Regate' },
      { key: 'DEF', value: 76, label: 'Defensa' },
      { key: 'PHY', value: 90, label: 'Físico' },
    ],
    skills: [
      { key: 'SKL', value: 4, label: 'Skill' },
      { key: 'WF', value: 4, label: 'Pierna hábil' },
    ],
    best: { key: 'PAC', value: 91 },
    initials: 'RG',
    badgeColor: 'accent',
  },
  {
    id: 'eusebio',
    name: 'Eusébio',
    country: 'POR',
    years: '1961–1979',
    positions: ['ST'],
    attributes: [
      { key: 'PAC', value: 92, label: 'Ritmo' },
      { key: 'SHO', value: 95, label: 'Tiro' },
      { key: 'PAS', value: 79, label: 'Pase' },
      { key: 'DRI', value: 86, label: 'Regate' },
      { key: 'DEF', value: 38, label: 'Defensa' },
      { key: 'PHY', value: 82, label: 'Físico' },
    ],
    skills: [
      { key: 'SKL', value: 4, label: 'Skill' },
      { key: 'WF', value: 4, label: 'Pierna hábil' },
    ],
    best: { key: 'SHO', value: 95 },
    initials: 'EU',
    badgeColor: 'amber',
  },
  {
    id: 'garrincha',
    name: 'Garrincha',
    country: 'BRA',
    years: '1953–1972',
    positions: ['RW', 'LW'],
    attributes: [
      { key: 'PAC', value: 94, label: 'Ritmo' },
      { key: 'SHO', value: 81, label: 'Tiro' },
      { key: 'PAS', value: 84, label: 'Pase' },
      { key: 'DRI', value: 99, label: 'Regate' },
      { key: 'DEF', value: 35, label: 'Defensa' },
      { key: 'PHY', value: 70, label: 'Físico' },
    ],
    skills: [
      { key: 'SKL', value: 5, label: 'Skill' },
      { key: 'WF', value: 5, label: 'Pierna hábil' },
    ],
    best: { key: 'DRI', value: 99 },
    initials: 'GA',
    badgeColor: 'accent',
  },
  {
    id: 'puskas',
    name: 'Ferenc Puskás',
    country: 'HUN',
    years: '1943–1966',
    positions: ['ST', 'CAM'],
    attributes: [
      { key: 'PAC', value: 86, label: 'Ritmo' },
      { key: 'SHO', value: 97, label: 'Tiro' },
      { key: 'PAS', value: 88, label: 'Pase' },
      { key: 'DRI', value: 90, label: 'Regate' },
      { key: 'DEF', value: 36, label: 'Defensa' },
      { key: 'PHY', value: 78, label: 'Físico' },
    ],
    skills: [
      { key: 'SKL', value: 4, label: 'Skill' },
      { key: 'WF', value: 4, label: 'Pierna hábil' },
    ],
    best: { key: 'SHO', value: 97 },
    initials: 'FP',
    badgeColor: 'amber',
  },
];

/** Devuelve la leyenda en el índice actual del draft. */
export function legendAt(board: { legendIdx: number }): Legend {
  return LEGENDS[board.legendIdx % LEGENDS.length];
}

/** Helper: convierte la `PlayerCard` final en entries ordenadas para la UI. */
export function cardToEntries(card: {
  attrs: Record<AttrKey, number>;
  skills: Record<SkillKey, number>;
}): PlayerCardEntry[] {
  const out: PlayerCardEntry[] = [];
  (Object.keys(card.attrs) as AttrKey[]).forEach((k) => {
    out.push({ key: k, value: card.attrs[k], label: ATTR_LABELS[k] });
  });
  (Object.keys(card.skills) as SkillKey[]).forEach((k) => {
    out.push({ key: k, value: card.skills[k], label: SKILL_LABELS[k] });
  });
  return out;
}