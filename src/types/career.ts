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

import type { NextWeekModifiers, PostMatchEvent } from '@/features/career/events';
import type { PositionStats } from '@/features/career/position-stats';
import type { RngSnapshot } from '@/features/career/rng';
import type { TransferState } from '@/features/career/transfers';

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

/**
 * Mapeo canónico `severity ↔ kind` (MGC-1628 rev 3 §"Sistema de lesiones v2").
 *
 * Se conserva `InjuryKind` para compatibilidad con catálogos y tests
 * preexistentes (MGC-1629 AC). `severityFor(kind)` centraliza la conversión
 * a número 1..3 (1 = leve, 2 = media, 3 = grave, 0 = ninguna) para que la UI
 * pueda mostrar un progress bar sin branching repetido.
 *
 * El 'media' NO se samplea (rev 3 del code-reviewer MGC-1640): la
 * probabilidad de cada kind se decide por RNG en `injury-v2.ts#maybeRollInjury`
 * (leve 0.6 / media 0.3 / grave 0.1). Si en F3+ queremos media sampleada
 * (p.ej. media condicional a OVR < 70), se agrega acá sin tocar call sites.
 */
export function severityFor(kind: InjuryKind): 0 | 1 | 2 | 3 {
  switch (kind) {
    case 'ninguna':
      return 0;
    case 'leve':
      return 1;
    case 'media':
      return 2;
    case 'grave':
      return 3;
  }
}

/**
 * Atributo afectado por la lesión (MGC-1628 rev 3 §"affectedAttr").
 *
 * Mapeo determinístico (no se samplea):
 * - 'leve'  → 'fisico'   (muscular, recuperable con rehab).
 * - 'media' → 'mental'   (baja confianza + moral del jugador).
 * - 'grave' → 'tecnico'  (cirugía/largo plazo; el skill técnico se ve
 *                         afectado porque el jugador pierde ritmo de
 *                         competencia hasta su regreso).
 * - 'ninguna' → 'fisico' (no se usa; placeholder para shape estable).
 *
 * El atributo es un signal para `applyTrainingDelta` (L1): durante la
 * rehabilitación, los deltas al atributo afectado se dividen por 2.
 * Mantiene el `Injury` schema chico y predecible.
 */
export function affectedAttrFor(kind: InjuryKind): AttributeKey {
  switch (kind) {
    case 'leve':
      return 'fisico';
    case 'media':
      return 'mental';
    case 'grave':
      return 'tecnico';
    case 'ninguna':
      return 'fisico';
  }
}

export type Injury = {
  kind: InjuryKind;
  /** Fechas restantes para volver a jugar. 0 = sano. */
  fechasOut: number;
  /**
   * Semana (1-indexed, dentro de la temporada actual) en la que se
   * disparó la lesión. Permite que `applyTrainingDelta` decremente el
   * `attr` afectado en función del tiempo transcurrido desde el
   * disparo (regla F3+: a partir de la semana 4 sin rehab, el delta
   * negativo se acumula 1.5×). `0` para lesiones en `initialProfile`
   * o en fixtures de tests sin week.
   */
  startedAtWeek: number;
  /** Atributo del player afectado durante la rehabilitación (ver `affectedAttrFor`). */
  affectedAttr: AttributeKey;
};

/**
 * Plan anual elegido al cierre de cada temporada (MGC-1017).
 *
 * Modifica el `drift` de OVR y la chance de lesión para el año
 * siguiente. El default es `'mantener'` (1.0× drift, baseline).
 * Persistido dentro de `CareerStats` para que QA pueda validar que
 * dos carreras con planes distintos produzcan timelines distintas.
 */
export type YearlyPlan = 'agresivo' | 'mantener' | 'cuidarse';

/** Multiplicadores de drift + injury asociados al plan anual. */
export const YEARLY_PLAN_MODIFIERS: Record<
  YearlyPlan,
  { drift: number; injury: number; label: string; copy: string }
> = {
  agresivo: {
    drift: 1.25,
    injury: 1.4,
    label: 'PLAN AGRESIVO',
    copy: '+25% drift OVR · +40% chance de lesión',
  },
  mantener: {
    drift: 1.0,
    injury: 1.0,
    label: 'MANTENER RITMO',
    copy: 'baseline · equilibrio drift/lesión',
  },
  cuidarse: {
    drift: 0.8,
    injury: 0.6,
    label: 'PLAN CUIDADOS',
    copy: '-20% drift OVR · -40% chance de lesión',
  },
};

/**
 * MGC-1505 — Rasgos opt-in del jugador que modifican eventos / drift OVR.
 * Lista cerrada: por ahora `Magneto mediático` y `Trotamundos`. UI lo
 * expone como multi-select (cap 2) en `temporada.tsx`.
 */
export type EstiloRasgo = 'magneto-mediatico' | 'trotamundos';

/** Catálogo canónico de etiquetas que se persisten y se renderean. */
export const ESTILO_RASGOS: readonly EstiloRasgo[] = ['magneto-mediatico', 'trotamundos'] as const;

/** Stats globales del jugador (MGC-439 §sistema de stats). */
export type CareerStats = {
  presupuesto: number; // €
  moral: number; // 0..100
  fisico: number; // 0..100 (energía post-descanso)
  confianza: number; // 0..100 (momentum)
  racha: number; // victorias consecutivas (negativa = derrotas)
  lesion: Injury;
  reputation: Reputation;
  /** Plan elegido al cierre de la temporada anterior (MGC-1017). */
  yearlyPlan?: YearlyPlan;
  /** Rasgos opt-in del jugador (MGC-1505). Cap 2 enforced en UI. */
  estilo?: EstiloRasgo[];
  /** MGC-1657 — contador de semanas consecutivas de doble turno. Se
   * persiste junto al career porque `injury-v2.maybeRollInjury` lo
   * consume para modular la chance de lesión. Lo resetea el `descanso`
   * semanal y el switch a otras opciones distintas a `doble_turno`. */
  doubleShiftStreak?: number;
  /** MGC-1657 — flag emitido por `applyWeeklyChoice` cuando la semana
   * en curso disparó una lesión v2. La UI lo lee para mostrar feedback
   * inline en el weekly screen. Se drena con `clearWeeklyInjury` al
   * mostrar la rehabilitación. */
  weeklyInjuryFlipped?: boolean;
  /** MGC-1657 — goles y asist por club en la matchweek actual. El
   * motor `resolveMatch()` los escribe y el `advanceWeek` los vuelca
   * a `profile.stats` acumulado. Estructura por clubId permite agregar
   * por temporada cuando hay cambios de club. */
  matchweekStats?: {
    clubId: string;
    goals: number;
    ast: number;
    apps: number;
  };
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

/** MGC-955: liga de origen del jugador (opcional en identidad). */
export type League = {
  /** Código estable usado por el store y los flows downstream. */
  code: string;
  /** Nombre legible en UI (es-AR). */
  name: string;
  /** ISO alpha-2 del país rector. Útil para filtrar por nacionalidad. */
  countryCode: string;
};

export type PlayerProfile = {
  name: string;
  number: number;
  position: Position;
  nationalityCode: string;
  /** MGC-955: código de liga ('' si sin selección). */
  leagueCode: string;
  preferredFoot: Foot;
  age: number;
  club: Club | null;
  value: number; // valor de mercado en M EUR (placeholder OK)
  ovr: number; // overall rating
  stats: PlayerStats;
  attrs: Attributes;
  career: CareerStats;
  /** MGC-1657 (F2.3) — 4 stats específicos por línea (GK/DEF/MID/FWD)
   * consumidos por el árbol semanal V2 y `resolveMatch`. Opcional para
   * back-compat con saves v:1; la migración `migrateV1ToV2` lo hidrata
   * con `STAT_INIT` (50 en cada slot). */
  positionStats?: PositionStats;
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
  /** Cursor persistible del stream RNG; se completa al serializar. */
  rng?: RngSnapshot;
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

/** Estado de la partida entre etapas (MGC-208 §5 persistencia).
 *
 * Versión 2 (MGC-1657 / F2.3): suma `profile.positionStats` para
 * persistir las stats posicionales V2. El loader de persistencia
 * detecta v:1 y aplica `migrateV1ToV2` antes de hidratar. */
export type CareerSaveState = {
  v: 1 | 2;
  stage: CareerStage;
  profile: PlayerProfile;
  draft: DraftBoard | null;
  card: PlayerCard | null;
  clubId: string | null;
  log: SeasonLog;
  seed: number;
  /** Cursor determinista; v1 legacy puede no incluirlo. */
  rng?: RngSnapshot;
  /**
   * F3.2 / ADR-0017 §6 — campos nuevos, **opcionales con default**. Un
   * save de F2.x que no los traiga se hidrata con `null` /
   * `NO_MODIFIERS` sin migración ni bump de versión: por eso son
   * opcionales y no entran en el discriminador `v`.
   */
  /** Evento post-partido pendiente de mostrar. `loadState` reabre el modal. */
  postMatchPending?: PostMatchEvent | null;
  /** Modificadores que el evento dejó para la semana siguiente. */
  nextWeekModifiers?: NextWeekModifiers;
  /** Estado del transfer system al cierre de temporada. */
  transferState?: TransferState | null;
};

/**
 * MGC-1628 rev 3 §L2 — `CareerSaveV2`.
 *
 * Mismo shape que `CareerSaveState` (`v: 1`) pero con `v: 2` para
 * reflejar la extensión del tipo `Injury` (M1: `affectedAttr`,
 * `startedAtWeek`). El bump de versión obliga a:
 *
 * 1. `loadCareerSave` rechaza `v: 1` legacy y delega a `migrateV1ToV2`
 *    antes de devolver el snapshot hidratado.
 * 2. `getSnapshot()` (en `careerStore.ts`) emite SIEMPRE `v: 2`.
 * 3. La rama de F3+ que introduzca nuevos campos persistibles (p.ej.
 *    `currentFatigue`, `lastAction`) agrega el discriminador `v: 3` y
 *    un `migrateV2ToV3`. Ver `arquitectura-motor.md` rev 3 §"Upgrade
 *    path F3+".
 *
 * Hoy la migración V1→V2 sólo normaliza los `Injury` saves legacy
 * (rellena `affectedAttr` desde el `kind` vía `affectedAttrFor` y
 * `startedAtWeek` a `0` para los disparos sin week persistido).
 */
export type CareerSaveV2 = Omit<CareerSaveState, 'v'> & { v: 2 };

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