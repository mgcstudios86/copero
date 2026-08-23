/**
 * Tipos del simulador de carrera (MGC-430).
 *
 * State machine mínima: identity -> dashboard -> academy -> clubStart.
 * El state machine vive en `src/features/career/engine.ts`. Este archivo
 * solo declara tipos y enums para no acoplar consumidores.
 */

export type Foot = 'left' | 'right' | 'both';

export type Position =
  | 'ST'
  | 'CAM'
  | 'CM'
  | 'CDM'
  | 'CB'
  | 'LW'
  | 'RW'
  | 'LM'
  | 'RM'
  | 'LB'
  | 'RB'
  | 'GK';

export type PositionGroup = 'attack' | 'midfield' | 'defense' | 'goalkeeper';

export type CareerStage = 'identity' | 'dashboard' | 'academy' | 'clubStart';

export type PlayerStats = {
  apps: number;
  goals: number;
  ast: number;
};

export type Club = {
  id: string;
  name: string;
  league: string;
  /** Color primario del escudo (hex). */
  crestColor: string;
  /** Color secundario del escudo (hex). */
  crestAccent: string;
};

export type Nationality = {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  flag: string; // emoji del país (placeholder hasta que lleguen assets reales)
};

export type PlayerProfile = {
  name: string;
  number: number;
  position: Position;
  nationalityCode: string;
  preferredFoot: Foot;
  age: number;
  club: Club | null;
  value: number; // valor de mercado en M EUR (placeholder OK)
  ovr: number; // overall rating, empieza en 50
  stats: PlayerStats;
};

export type CareerSnapshot = {
  stage: CareerStage;
  profile: PlayerProfile;
};