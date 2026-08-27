// Mock data for the 5 navigable screens. Numbers reflect the screenshots in MGC-11.

export type AttrKey = 'PAC' | 'SHO' | 'PAS' | 'DRI' | 'DEF' | 'PHY';
export type SkillKey = 'SKL' | 'WF';

export type Attribute = { key: AttrKey; value: number; label: string };
export type Skill = { key: SkillKey; value: number; label: string };

export const ATTER_LABELS: Record<AttrKey, string> = {
  PAC: 'Ritmo',
  SHO: 'Tiro',
  PAS: 'Pase',
  DRI: 'Regate',
  DEF: 'Defensa',
  PHY: 'Físico',
};

export type Position = 'ST' | 'CAM' | 'CM' | 'LW' | 'RW' | 'CB' | 'LB' | 'RB' | 'GK';
export const POSITION_LABEL: Record<Position, string> = {
  ST: 'ST · Delantero',
  CAM: 'CAM · Mediapunta',
  CM: 'CM · Mediocampista',
  LW: 'LW · Extremo',
  RW: 'RW · Extremo',
  CB: 'CB · Defensor',
  LB: 'LB · Lateral',
  RB: 'RB · Lateral',
  GK: 'GK · Arquero',
};

export const NATIONALITIES = [
  'Argentina',
  'Brasil',
  'España',
  'Francia',
  'Italia',
  'Inglaterra',
  'Uruguay',
  'Chile',
  'Colombia',
  'México',
  'Alemania',
  'Portugal',
];

export type Legend = {
  id: string;
  name: string;
  country: string;
  years: string;
  positions: Position[];
  attributes: Attribute[];
  skills: Skill[];
  best: { key: AttrKey; value: number };
  initials: string;
  badgeColor: 'amber' | 'rose' | 'accent';
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
      { key: 'PAC', value: 88, label: 'Ritmo' },
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

// Final 8 picks reflected on the DraftComplete player card.
export const PICKS: Array<{ attr: AttrKey | SkillKey; legendName: string }> = [
  { attr: 'SHO', legendName: 'Raúl' },
  { attr: 'PHY', legendName: 'Didier Drogba' },
  { attr: 'DRI', legendName: 'Marco Van Basten' },
  { attr: 'PAC', legendName: 'Ruud Gullit' },
  { attr: 'PAS', legendName: 'Eusébio' },
  { attr: 'DEF', legendName: 'Garrincha' },
  { attr: 'SKL', legendName: 'Ferenc Puskás' },
  { attr: 'WF', legendName: 'Patrick Vieira' },
];

export const FINAL_ATTRIBUTES: Attribute[] = [
  { key: 'PAC', value: 91, label: 'Ritmo' },
  { key: 'SHO', value: 94, label: 'Tiro' },
  { key: 'PAS', value: 84, label: 'Pase' },
  { key: 'DRI', value: 92, label: 'Regate' },
  { key: 'DEF', value: 42, label: 'Defensa' },
  { key: 'PHY', value: 99, label: 'Físico' },
];

export const FINAL_SKILLS: Skill[] = [
  { key: 'SKL', value: 4, label: 'Skill' },
  { key: 'WF', value: 4, label: 'Pierna hábil' },
];

export const OVR_INICIAL = 70;
export const POTENCIAL = 91;

export type Club = {
  id: string;
  name: string;
  crestColor: string; // tailwind bg-* compatible hex
  archetype: 'DESARROLLO' | 'EQUILIBRIO' | 'AMBICIÓN';
  reputation: number; // 1..5
  minutesLabel: string;
  growthLabel: string;
  titlesLabel: string;
  riskLabel: string;
  minutesColor: 'green' | 'amber' | 'rose';
};

export const CLUBS: Club[] = [
  {
    id: 'huracan',
    name: 'Huracán',
    crestColor: '#E63946',
    archetype: 'DESARROLLO',
    reputation: 1,
    minutesLabel: 'Titularidad probable',
    growthLabel: 'Muchos minutos',
    titlesLabel: 'Probabilidad baja',
    riskLabel: 'Menor exposición',
    minutesColor: 'green',
  },
  {
    id: 'estudiantes',
    name: 'Estudiantes de La Plata',
    crestColor: '#C8102E',
    archetype: 'EQUILIBRIO',
    reputation: 2,
    minutesLabel: 'Minutos regulares',
    growthLabel: 'Desarrollo equilibrado',
    titlesLabel: 'Probabilidad media-baja',
    riskLabel: 'Progreso gradual',
    minutesColor: 'amber',
  },
  {
    id: 'boca',
    name: 'Boca Juniors',
    crestColor: '#0E2F6B',
    archetype: 'AMBICIÓN',
    reputation: 3,
    minutesLabel: 'Rotación con opciones',
    growthLabel: 'Buena escaparate',
    titlesLabel: 'Probabilidad media',
    riskLabel: 'Competencia exigente',
    minutesColor: 'rose',
  },
];

export type Season = {
  age: number;
  club: string;
  ovr: number;
  apps: number;
  goals: number;
  assists: number;
};

export const TIMELINE: Season[] = [
  { age: 16, club: 'timeline.careerDecision', ovr: 70, apps: 0, goals: 0, assists: 0 },
];