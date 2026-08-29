/**
 * Tipos del simulador de carrera (MGC-430 → MGC-442 + MGC-208).
 *
 * State machine: identity -> dashboard -> academy -> clubStart -> draft ->
 * club -> season* -> retirement. El motor puro vive en
 * `src/features/career/engine.ts` (FSM reducer) + `simulation.ts`
 * (decisiones semanales) + `draft.ts` (8 rondas) + `season.ts` (loop
 * anual) + `retirement.ts` (resumen). Los strings de copy los resuelve
 * la UI desde `src/design/copy/es-AR/simulador-carrera.ts`.
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

/** Etapas de la carrera. `draft`, `club`, `season` y `retirement` se agregaron en MGC-208. */
export type CareerStage =
  | 'identity'
  | 'dashboard'
  | 'academy'
  | 'clubStart'
  | 'draft'
  | 'club'
  | 'season'
  | 'retirement';

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
  /** Arquetipo (MGC-208 §2). Default 'EQUILIBRIO' para compat con MGC-430. */
  archetype?: ClubArchetype;
  /** Reputación 1..5 (MGC-208 §2). Default 3. */
  reputation?: number;
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
  /** Draft de 8 rondas (MGC-208 §1). Null hasta `startDraft`. */
  draft?: DraftBoard | null;
  /** PlayerCard final cuando el draft termina. */
  card?: PlayerCard | null;
  /** Log temporada-a-temporada (MGC-208 §3 + §4). */
  log?: SeasonLog;
  /** Seed determinista para reproducibilidad (MGC-208 §5). */
  seed?: number;
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

/* ───────────────────────── MGC-208: draft + season + retirement ──────────────── */

/** Atributos de los 6 stats clásicos de FIFA. */
export type AttrKey = 'PAC' | 'SHO' | 'PAS' | 'DRI' | 'DEF' | 'PHY';

/** Skills (1-5 estrellas). */
export type SkillKey = 'SKL' | 'WF';

/** Valor de un atributo o skill en la carta final del jugador. */
export type PlayerCardEntry = { key: AttrKey | SkillKey; value: number; label: string };

/** Arquetipos de club (MGC-208 §2): Desarrollo / Equilibrio / Ambición. */
export type ClubArchetype = 'DESARROLLO' | 'EQUILIBRIO' | 'AMBICIÓN';

/** Leyenda del draft (MGC-208 §1): Cruyff, Raúl, Drogba, etc. */
export type Legend = {
  id: string;
  name: string;
  country: string;
  years: string;
  positions: Position[];
  attributes: { key: AttrKey; value: number; label: string }[];
  skills: { key: SkillKey; value: number; label: string }[];
  /** El mejor atributo que aporta al draft. */
  best: { key: AttrKey | SkillKey; value: number };
  initials: string;
  badgeColor: 'amber' | 'rose' | 'accent';
};

/** Pick del draft: slot (PAC/SHO/.../WF) <- nombre de la leyenda. */
export type DraftPick = {
  slot: AttrKey | SkillKey;
  legendId: string;
  legendName: string;
  value: number;
};

/** Tablero del draft: hasta 8 picks. */
export type DraftBoard = {
  round: number; // 1..8
  legendIdx: number; // índice en LEGENDS que se está mostrando
  swapsLeft: number; // cuántas leyendas puede cambiar el jugador
  picks: DraftPick[];
};

/** Carta final del jugador tras las 8 rondas. */
export type PlayerCard = {
  attrs: Record<AttrKey, number>;
  skills: Record<SkillKey, number>;
  /** OVR inicial calculado desde los 6 attrs (MGC-208 §1). */
  ovrInicial: number;
  /** Potencial: techo de crecimiento durante la carrera (MGC-208 §1). */
  potencial: number;
};

/** Fila de la timeline temporada-a-temporada (MGC-208 §3 + §4). */
export type TimelineSeason = {
  season: number;
  age: number;
  clubId: string;
  clubName: string;
  ovr: number;
  apps: number;
  goals: number;
  assists: number;
};

/** Eventos que el loop anual puede disparar (MGC-208 §3). */
export type CareerEventKind =
  | 'match'
  | 'injury'
  | 'offer'
  | 'seleccion'
  | 'prensa'
  | 'titulo';

export type CareerEvent = {
  season: number;
  kind: CareerEventKind;
  copyId: string;
  values?: Record<string, string | number>;
};

/** Bitácora temporada-a-temporada: timeline + eventos. */
export type SeasonLog = {
  timeline: TimelineSeason[];
  events: CareerEvent[];
};

/** Estado de la partida entre etapas (MGC-208 §5 persistencia). */
export type CareerSaveState = {
  v: 1;
  stage: CareerStage;
  profile: PlayerProfile;
  draft: DraftBoard | null;
  card: PlayerCard | null;
  clubId: string | null;
  log: SeasonLog;
  seed: number;
};

/** Resumen del fin de carrera (MGC-208 §4). */
export type RetirementSummary = {
  retirementAge: number;
  finalOvr: number;
  totalApps: number;
  totalGoals: number;
  totalAssists: number;
  vitrina: string[];
  legado: string;
  timeline: TimelineSeason[];
  events: CareerEvent[];
};