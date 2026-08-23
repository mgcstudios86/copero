/**
 * Tipos del simulador de carrera (MGC-430 → MGC-442).
 *
 * State machine: identity -> dashboard -> academy -> clubStart.
 * Motor de simulación: `src/features/career/simulation.ts` consume `E1..V7`
 * de `design/simulador-carrera/strategies.md` (MGC-439) y devuelve
 * `{event, choices, feedback}` que la UI resuelve con
 * `src/design/copy/es-AR/simulador-carrera.ts` (sin strings en JSX).
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

/** Atributos del jugador (MGC-439 sistema de stats). 0-99 cada uno. */
export type AttributeKey = 'tecnico' | 'fisico' | 'mental' | 'portero';

export type Attributes = Record<AttributeKey, number>;

/** Estados de reputación por eje (MGC-439 §5). */
export type PrensaReputation = 'ensalzada' | 'neutral' | 'critica' | 'hostil';
export type HinchadaReputation = 'idolo' | 'aceptado' | 'discutido' | 'odiado';
export type VestuarioReputation = 'capitan_moral' | 'integrado' | 'aislado';

export type Reputation = {
  prensa: PrensaReputation;
  hinchada: HinchadaReputation;
  vestuario: VestuarioReputation;
  seleccionConvocado: boolean;
};

export type PlayerStats = {
  apps: number;
  goals: number;
  ast: number;
};

export type InjuryKind = 'ninguna' | 'leve' | 'media' | 'grave';
export type Injury = {
  kind: InjuryKind;
  /** Fechas restantes para volver a jugar. 0 = sano. */
  fechasOut: number;
};

/** Stats globales del jugador (MGC-439 §sistema de stats). */
export type CareerStats = {
  presupuesto: number; // €
  moral: number; // 0..100
  fisico: number; // 0..100 (energía post-descanso)
  confianza: number; // 0..100 (momentum)
  racha: number; // victorias consecutivas (negativa = derrotas)
  lesion: Injury;
  reputation: Reputation;
};

export type Club = {
  id: string;
  name: string;
  league: string;
  /** Color primario del escudo (hex). */
  crestColor: string;
  /** Color secundario del escudo (hex). */
  crestAccent: string;
  /** Presupuesto del club en M EUR (placeholder). */
  presupuesto: number;
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
  ovr: number; // overall rating
  stats: PlayerStats;
  attrs: Attributes;
  career: CareerStats;
  /** Semana actual dentro de la temporada (1-indexed). */
  week: number;
  /** Temporada actual (1-indexed). */
  season: number;
  /** Presupuesto del club que persigue al jugador (MGC-442 simulate). */
  clubPresupuesto: number;
  /** True cuando el club de origen mostró interés (T1 trigger). */
  clubInteres: boolean;
};

export type CareerSnapshot = {
  stage: CareerStage;
  profile: PlayerProfile;
};

/** Identificadores de decisión del catálogo de strategies.md (MGC-439). */
export type StrategyId =
  | 'E1' | 'E2' | 'E3' | 'E4' | 'E5'
  | 'M1' | 'M2' | 'M3' | 'M4' | 'M5'
  | 'T1' | 'T2' | 'T3' | 'T4'
  | 'L1' | 'L2' | 'L3'
  | 'R1' | 'R2' | 'R3' | 'R4'
  | 'O1' | 'O2' | 'O3' | 'O4'
  | 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6' | 'V7';

/** Tipos de evento que devuelve el motor. */
export type EventKind =
  | 'training'
  | 'match'
  | 'transfer'
  | 'injury'
  | 'reputation'
  | 'offer'
  | 'event';

/** Tokens visuales que mapean a feedback inline (copy-matrix.md). */
export type FeedbackTone = 'success' | 'warning' | 'danger' | 'neutral';

export type FeedbackPayload = {
  kind: FeedbackTone;
  /** ID estable para que la UI resuelva copy desde el matrix. */
  copyId: string;
  /** Placeholders a interpolar (`{x}` en copy-matrix.md). */
  values: Record<string, string | number>;
};

export type Choice = {
  id: string;
  copyId: string;
  values?: Record<string, string | number>;
};

/** Output del motor: lo que la UI debe renderizar. */
export type SimulationEvent = {
  kind: EventKind;
  strategyId: StrategyId;
  title: string; // copyId
  body?: string; // copyId
  feedback: FeedbackPayload;
  choices: Choice[];
  /** Consecuencias a aplicar cuando la UI emite la choice al motor. */
  consequences: Consequence[];
};

export type Consequence =
  | { type: 'stat'; field: keyof PlayerStats | keyof CareerStats | keyof Attributes; delta: number }
  | { type: 'feedback'; payload: FeedbackPayload }
  | { type: 'injury'; kind: InjuryKind; fechasOut: number }
  | { type: 'reputation'; patch: Partial<Reputation> }
  | { type: 'transition'; stage: CareerStage };