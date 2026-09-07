/**
 * F-G2 (MGC-1623-G2) — Árbol decisional semanal completo por línea.
 *
 * Implementa literalmente ADR-0018 §1-§10. Integra los efectos pedidos
 * por el operador:
 *
 *   1. doble turno / turno simple → suben stats (palancas 1-2 del brief)
 *   2. sobrecarga → probabilidad de lesión crece con la racha (pal. 4)
 *   3. stats altas → rinden más en partido (pal. 5)
 *   4. eventos vida social post-partido (timba) (pal. 7)
 *   5. sin entrenar → stats bajan → menos chances en partido (pal. 8)
 *
 * Módulo puro: sin React, sin `Math.random()`. El `Rng` (Mulberry32,
 * `rng.ts`) entra por invocación para que QA pueda reproducir
 * historias con seed fijo (ADR-0018 §9).
 *
 * Por qué un módulo nuevo (no extender position-tree.ts /
 * decision-tree.ts / social-events.ts): los tres módulos anteriores
 * están cerrados por contrato:
 *   - position-tree.ts (F2.2, MGC-1629): exactamente 4 outcomes por nodo.
 *   - decision-tree.ts  (F3.2, MGC-1632, ADR-0017 §3): exactamente 6 outcomes.
 *   - social-events.ts  (F4,   MGC-1762): exactamente 4 outcomes disjuntos.
 * Insertar performance modifier / carga de elección / chance de party
 * rompería cualquiera de los tres ACs. Este módulo opera a otro nivel
 * de abstracción: integra los tres como una capa semanal (ADR-0018 §6).
 */

import type { Position, PositionGroup, CareerStats } from '@/types/career';
import { groupOf } from './positions';
import {
  applyStatDeltas,
  STAT_INIT,
  statsForPosition,
  type PositionStats,
  type StatKey,
} from './position-stats';
import {
  DOUBLE_SHIFT_STREAK_INJURY_THRESHOLD,
  INJURY_BASE_RATE,
  doubleStreakInjuryMod,
  fatigueFromCareer,
  fatigueInjuryMod,
} from './injury-v2';
import { KEY_STAT_BY_GROUP, SUERTE_GATE } from './events';
import type { Rng } from './rng';

/* ── §1 — Tipos públicos ─────────────────────────────────────────── */

export type WeeklyChoiceId =
  | 'descanso'
  | 'turno_simple'
  | 'doble_turno'
  | 'rehabilitacion'
  | 'entrenamiento_mental'
  | 'entrenamiento_fisico_especifico'
  | 'fiesta_post_partido'
  | 'lesion_activa';

/**
 * Modificador de performance que el próximo partido consume. Línea
 * específica (cada línea tiene su propio multiplicador > 0; las otras
 * quedan en 1.0). Si el promedio de stats no llega al `PERF_GATE`,
 * queda en 1.0 (neutral); si cae por debajo del umbral de
 * penalización, baja a 0.85 (pal. 8).
 */
export type PerformanceModifier = {
  goalChanceMul: number;
  saveChanceMul: number;
  defenseChanceMul: number;
  creationChanceMul: number;
};

export const NEUTRAL_PERFORMANCE: PerformanceModifier = {
  goalChanceMul: 1,
  saveChanceMul: 1,
  defenseChanceMul: 1,
  creationChanceMul: 1,
};

export type WeeklyDecisionNode = {
  id: WeeklyChoiceId;
  /** copyId que la UI resuelve contra `COPY[locale].weeklyDecision`. */
  copyId: string;
  /** Stats posicionales que se mueven si éxito (clamp 0..99). */
  statDelta: Partial<Record<StatKey, number>>;
  /** Deltas V1 al `PlayerProfile.career`. */
  careerDelta: {
    fisico: number;
    moral: number;
    confianza: number;
  };
  /** Chance base 0..1 de lesión por sobrecarga (sin streak ni fatiga). */
  injuryBase: number;
  /** Multiplicador 0..1 sobre `injuryBase` por semana de racha doble. */
  injuryStreakMul: number;
  /** Chance 0..1 de disparar `fiesta_post_partido` (timba). */
  partyChance: number;
  /** Performance boost 0..1 que se aplica al próximo partido si stats
   *  pasan el `PERF_GATE` (negativo = penalización). */
  performanceBoost: number;
};

export type WeeklyDecisionTree = {
  group: PositionGroup;
  statGate: number;
  perfGate: number;
  perfPenaltyFloor: number;
  nodes: Record<WeeklyChoiceId, WeeklyDecisionNode>;
};

export type WeeklyDecisionResult = {
  group: PositionGroup;
  choiceId: WeeklyChoiceId;
  newStats: PositionStats;
  newCareer: CareerStats;
  /** Chance efectiva de lesión, combinando base + fatiga + racha + choice. */
  injuryProbability: number;
  /** Chance efectiva de disparar fiesta post-partido (timba). */
  partyChance: number;
  /** True si el gate de suerte dejó pasar el multiplicador de party. */
  partyGatePassed: boolean;
  /** Performance modifier que el próximo partido consume. */
  performance: PerformanceModifier;
  /** Snapshot del RNG tras consumir los rolls (para persistir). */
  rngSnapshot: ReturnType<Rng['snapshot']>;
};

/* ── §2 — Constantes por línea (ADR-0018 §7 + §8) ────────────────── */

const PERF_GATE: Record<PositionGroup, number> = {
  goalkeeper: 75,
  defense: 72,
  midfield: 70,
  attack: 68,
};

/** Umbral de penalización: si el promedio cae por debajo del
 *  `PERF_GATE * PERF_PENALTY_RATIO`, el modifier cae a 0.85x. */
const PERF_PENALTY_RATIO = 0.6;
const PERF_PENALTY_MUL = 0.85;
const PERF_BOOST_NEUTRAL = 1.0;

/** Performance boost final = 1 + boost. Cap 1.30 para evitar que
 *  doble turno + elite stats exploten el balance. */
const PERF_BOOST_CAP = 1.30;

/* ── §3 — Tablas por línea ───────────────────────────────────────── */

function table(group: PositionGroup): Record<WeeklyChoiceId, WeeklyDecisionNode> {
  // Estructura idéntica entre líneas: statDelta principal difiere
  // por línea; resto de campos son comunes (ADR-0018 §7). Construir
  // por línea evita la trampa de copiar 8 filas casi-idénticas.
  const principal: Record<PositionGroup, StatKey> = {
    goalkeeper: 'reflejos',
    defense: 'marcaje',
    midfield: 'pase',
    attack: 'definicion',
  };

  // Stat secundario que sube 1 con doble turno (pal. 1).
  const secundario: Record<PositionGroup, StatKey> = {
    goalkeeper: 'manos',
    defense: 'cabeceo',
    midfield: 'vision',
    attack: 'regate',
  };

  // Stat mental (entrenamiento_mental sube 1).
  const mental: Record<PositionGroup, StatKey> = {
    goalkeeper: 'posicionamiento',
    defense: 'anticipacion',
    midfield: 'vision',
    attack: 'velocidad',
  };

  // Resistencia sube 1 con doble turno (pal. 1: "suben stats").
  const resistencia: StatKey = 'resistencia';
  const p = principal[group];
  const s = secundario[group];
  const m = mental[group];

  return {
    descanso: {
      id: 'descanso',
      copyId: 'weekly_rest',
      statDelta: {},
      careerDelta: { fisico: 20, moral: -2, confianza: 0 },
      injuryBase: 0,
      injuryStreakMul: 0,
      partyChance: 0.05,
      performanceBoost: 0,
    },
    turno_simple: {
      id: 'turno_simple',
      copyId: 'weekly_simple_shift',
      statDelta: { [p]: 1, [m]: 1 },
      careerDelta: { fisico: -5, moral: 1, confianza: 0 },
      injuryBase: 0.01,
      injuryStreakMul: 0,
      partyChance: 0.10,
      performanceBoost: 0.08,
    },
    doble_turno: {
      id: 'doble_turno',
      copyId: 'weekly_double_shift',
      statDelta: { [p]: 2, [s]: 1, [resistencia]: 1 },
      careerDelta: { fisico: -15, moral: 5, confianza: 2 },
      injuryBase: 0.04,
      injuryStreakMul: 0.06,
      partyChance: 0.20,
      performanceBoost: 0.15,
    },
    rehabilitacion: {
      id: 'rehabilitacion',
      copyId: 'weekly_rehab',
      statDelta: {},
      careerDelta: { fisico: 8, moral: 0, confianza: 0 },
      injuryBase: 0,
      injuryStreakMul: 0,
      partyChance: 0,
      performanceBoost: 0,
    },
    entrenamiento_mental: {
      id: 'entrenamiento_mental',
      copyId: 'weekly_mental_training',
      statDelta: { [m]: 1 },
      careerDelta: { fisico: -2, moral: 6, confianza: 1 },
      injuryBase: 0,
      injuryStreakMul: 0,
      partyChance: 0.05,
      performanceBoost: 0.04,
    },
    entrenamiento_fisico_especifico: {
      id: 'entrenamiento_fisico_especifico',
      copyId: 'weekly_positional_training',
      statDelta: { [p]: 2 },
      careerDelta: { fisico: -10, moral: 2, confianza: 1 },
      injuryBase: 0.03,
      injuryStreakMul: 0,
      partyChance: 0.10,
      performanceBoost: 0.10,
    },
    fiesta_post_partido: {
      id: 'fiesta_post_partido',
      copyId: 'weekly_post_match_party',
      statDelta: {},
      careerDelta: { fisico: -8, moral: 6, confianza: 2 },
      injuryBase: 0.02,
      injuryStreakMul: 0,
      partyChance: 1.0, // rolado por runSocialEvent (PR-438)
      performanceBoost: 0,
    },
    lesion_activa: {
      id: 'lesion_activa',
      copyId: 'weekly_injury_active',
      statDelta: {},
      careerDelta: { fisico: -5, moral: -4, confianza: -2 },
      injuryBase: 0.06,
      injuryStreakMul: 0,
      partyChance: 0,
      performanceBoost: -0.10,
    },
  };
}

const TREES: Record<PositionGroup, WeeklyDecisionTree> = {
  goalkeeper: {
    group: 'goalkeeper',
    statGate: SUERTE_GATE.goalkeeper,
    perfGate: PERF_GATE.goalkeeper,
    perfPenaltyFloor: PERF_GATE.goalkeeper * PERF_PENALTY_RATIO,
    nodes: table('goalkeeper'),
  },
  defense: {
    group: 'defense',
    statGate: SUERTE_GATE.defense,
    perfGate: PERF_GATE.defense,
    perfPenaltyFloor: PERF_GATE.defense * PERF_PENALTY_RATIO,
    nodes: table('defense'),
  },
  midfield: {
    group: 'midfield',
    statGate: SUERTE_GATE.midfield,
    perfGate: PERF_GATE.midfield,
    perfPenaltyFloor: PERF_GATE.midfield * PERF_PENALTY_RATIO,
    nodes: table('midfield'),
  },
  attack: {
    group: 'attack',
    statGate: SUERTE_GATE.attack,
    perfGate: PERF_GATE.attack,
    perfPenaltyFloor: PERF_GATE.attack * PERF_PENALTY_RATIO,
    nodes: table('attack'),
  },
};

/* ── §4 — Lookup ─────────────────────────────────────────────────── */

export function getWeeklyTree(position: Position | PositionGroup): WeeklyDecisionTree {
  const group: PositionGroup =
    typeof position === 'string' && position in TREES
      ? (position as PositionGroup)
      : groupOf(position as Position);
  return TREES[group];
}

export function getWeeklyNode(
  position: Position | PositionGroup,
  choiceId: WeeklyChoiceId,
): WeeklyDecisionNode | null {
  return getWeeklyTree(position).nodes[choiceId] ?? null;
}

export function weeklyChoiceIds(): WeeklyChoiceId[] {
  return Object.keys(TREES.goalkeeper.nodes) as WeeklyChoiceId[];
}

/* ── §5 — Lesión: combinación base + fatiga + racha + choice ─────── */

/** ADR-0018 §3. Chance efectiva de lesión combinando:
 *  - base (INJURY_BASE_RATE — F2.2)
 *  - fatiga (fatigueInjuryMod — F2.2)
 *  - racha doble turno (doubleStreakInjuryMod — F2.2)
 *  - factor del choice (`node.injuryBase + node.injuryStreakMul * racha`)
 */
export function injuryProbabilityForChoice(
  career: CareerStats,
  doubleShiftStreak: number,
  group: PositionGroup,
  choiceId: WeeklyChoiceId,
): number {
  const node = TREES[group].nodes[choiceId];
  if (!node) return 0;

  const modFatigue = fatigueInjuryMod(fatigueFromCareer(career));
  const modStreak = doubleStreakInjuryMod(doubleShiftStreak);

  // Contribución del choice: crece con la racha de doble turno.
  const cargaChoice = Math.min(
    1,
    node.injuryBase + node.injuryStreakMul * Math.max(0, doubleShiftStreak),
  );

  return Math.min(
    1,
    INJURY_BASE_RATE + modFatigue * 0.35 + modStreak * 0.25 + cargaChoice * 0.20,
  );
}

/* ── §6 — Party: chance modulada por stat ────────────────────────── */

/**
 * ADR-0018 §5. Devuelve la chance efectiva de disparar
 * `fiesta_post_partido`. Si el stat principal no llega al
 * `SUERTE_GATE[group]`, el multiplicador es 0 — el evento se rolea
 * pero no compensa (pal. 7).
 */
export function partyChanceForChoice(
  group: PositionGroup,
  choiceId: WeeklyChoiceId,
  stats: PositionStats,
): { chance: number; gatePassed: boolean } {
  const node = TREES[group].nodes[choiceId];
  if (!node) return { chance: 0, gatePassed: false };
  const key = KEY_STAT_BY_GROUP[group];
  const value = stats[key] ?? STAT_INIT[key];
  const gatePassed = value >= SUERTE_GATE[group];
  const chance = gatePassed ? node.partyChance : 0;
  return { chance, gatePassed };
}

/* ── §7 — Performance modifier ───────────────────────────────────── */

/**
 * ADR-0018 §4. Construye el `PerformanceModifier` que el próximo
 * partido consume. Si el promedio de los 4 stats de la línea supera
 * `PERF_GATE`, se aplica el boost (1 + boost, cap 1.30). Si cae por
 * debajo del `PERF_PENALTY_FLOOR`, baja a 0.85x (pal. 8 — stat-baja
 * reduce chances). Entre medio, neutral (1.0).
 */
export function performanceModifierFor(
  group: PositionGroup,
  position: Position,
  stats: PositionStats,
  choiceId: WeeklyChoiceId,
): PerformanceModifier {
  const tree = TREES[group];
  const node = tree.nodes[choiceId];
  if (!node) return NEUTRAL_PERFORMANCE;

  const keys = statsForPosition(position);
  const avg =
    keys.reduce((acc, k) => acc + (stats[k] ?? STAT_INIT[k]), 0) / keys.length;

  // Línea-específico: cada línea tiene su slot > 0, las otras 1.0.
  const base = { ...NEUTRAL_PERFORMANCE };
  let primaryKey: keyof PerformanceModifier;
  switch (group) {
    case 'attack':      primaryKey = 'goalChanceMul'; break;
    case 'goalkeeper':  primaryKey = 'saveChanceMul'; break;
    case 'defense':     primaryKey = 'defenseChanceMul'; break;
    case 'midfield':    primaryKey = 'creationChanceMul'; break;
  }

  let mul: number;
  if (avg >= tree.perfGate) {
    mul = Math.min(PERF_BOOST_CAP, PERF_BOOST_NEUTRAL + node.performanceBoost);
  } else if (avg < tree.perfPenaltyFloor) {
    mul = PERF_PENALTY_MUL;
  } else {
    mul = PERF_BOOST_NEUTRAL;
  }

  base[primaryKey] = Number(mul.toFixed(4));
  return base;
}

/* ── §8 — applyWeeklyDecision (integrador) ───────────────────────── */

export type ApplyWeeklyInput = {
  position: Position;
  /** Stats posicionales al inicio de la semana. */
  stats: PositionStats;
  /** Career al inicio de la semana. */
  career: CareerStats;
  /** Racha actual de doble turno consecutivo (entrada). */
  doubleShiftStreak: number;
  /** Rating del último partido 0..10 (para `partyChance`). Opcional. */
  lastMatchRating?: number;
  /** Choice elegido en esta semana. */
  choiceId: WeeklyChoiceId;
};

/**
 * ADR-0018 §10. Aplica el choice sobre stats + career y devuelve el
 * delta completo. **No** rolea lesión ni dispara social event — esos
 * efectos los disparan `maybeRollInjury` y `runSocialEvent`
 * respectivamente sobre el `injuryProbability` y `partyChance`
 * retornados. La función pura devuelve los deltas para que QA
 * valide con seed fijo (replay determinista).
 *
 * Actualiza `doubleShiftStreak` siguiendo la regla F2.2
 * (`simulation.ts:521`):
 *   - `doble_turno`         → +1
 *   - `descanso`            → mantiene
 *   - cualquier otra opción → reset a 0
 */
export function applyWeeklyDecision(
  input: ApplyWeeklyInput,
  rng: Rng,
): WeeklyDecisionResult {
  const tree = getWeeklyTree(input.position);
  const node = tree.nodes[input.choiceId];
  if (!node) {
    // Choice inválido → no-op determinista. Mismo patrón que
    // `applyWeeklyChoice` en simulation.ts:471.
    return {
      group: tree.group,
      choiceId: input.choiceId,
      newStats: input.stats,
      newCareer: input.career,
      injuryProbability: 0,
      partyChance: 0,
      partyGatePassed: false,
      performance: NEUTRAL_PERFORMANCE,
      rngSnapshot: rng.snapshot(),
    };
  }

  // 1) Stats posicionales: aplicar deltas con clamp 0..99.
  const newStats = applyStatDeltas(input.stats, node.statDelta);

  // 2) Career deltas con clamp 0..100.
  const newCareer: CareerStats = {
    ...input.career,
    reputation: { ...input.career.reputation },
    lesion: { ...input.career.lesion },
  };
  newCareer.fisico = clamp(newCareer.fisico + node.careerDelta.fisico, 0, 100);
  newCareer.moral = clamp(newCareer.moral + node.careerDelta.moral, 0, 100);
  newCareer.confianza = clamp(
    newCareer.confianza + node.careerDelta.confianza,
    0,
    100,
  );

  // 3) DoubleShiftStreak (regla F2.2 simulation.ts:521).
  let newStreak: number;
  if (input.choiceId === 'doble_turno') {
    newStreak = input.doubleShiftStreak + 1;
  } else if (input.choiceId === 'descanso') {
    newStreak = input.doubleShiftStreak;
  } else {
    newStreak = 0;
  }
  newCareer.doubleShiftStreak = newStreak;

  // 4) Chance efectiva de lesión (combinada).
  const injuryProbabilityValue = injuryProbabilityForChoice(
    newCareer,
    newStreak,
    tree.group,
    input.choiceId,
  );

  // 5) Chance de fiesta (gateada por stat).
  const { chance: partyChanceValue, gatePassed } = partyChanceForChoice(
    tree.group,
    input.choiceId,
    newStats,
  );

  // 6) Performance modifier.
  const performance = performanceModifierFor(
    tree.group,
    input.position,
    newStats,
    input.choiceId,
  );

  // 7) Consumir un rng.next() por invocación (ADR-0018 §9 — replay
  // determinista). Aunque acá no roleamos nada probabilístico,
  // reservar el tick mantiene el cursor del RNG en sincronía con
  // el motor que llama a maybeRollInjury y runSocialEvent después.
  rng.next();

  return {
    group: tree.group,
    choiceId: input.choiceId,
    newStats,
    newCareer,
    injuryProbability: Number(injuryProbabilityValue.toFixed(4)),
    partyChance: Number(partyChanceValue.toFixed(4)),
    partyGatePassed: gatePassed,
    performance,
    rngSnapshot: rng.snapshot(),
  };
}

/* ── §9 — Helpers exportados ─────────────────────────────────────── */

export const WEEKLY_CONSTANTS = {
  PERF_GATE,
  PERF_PENALTY_RATIO,
  PERF_PENALTY_MUL,
  PERF_BOOST_CAP,
  PERF_BOOST_NEUTRAL,
  DOUBLE_SHIFT_STREAK_INJURY_THRESHOLD,
} as const;

export function averageStats(group: PositionGroup, stats: PositionStats): number {
  // Helper para tests: promedio de los 4 stats de la línea.
  // Usamos la primera posición del grupo como canónica para resolver
  // el set de stats (`statsForPosition` requiere Position, no Group).
  const sample: Position = (
    {
      goalkeeper: 'GK',
      defense: 'CB',
      midfield: 'CM',
      attack: 'ST',
    } as const
  )[group];
  const keys = statsForPosition(sample);
  return keys.reduce((acc, k) => acc + (stats[k] ?? STAT_INIT[k]), 0) / keys.length;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}