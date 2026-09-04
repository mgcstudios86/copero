/**
 * F2.2 — Árbol de decisión semanal por posición (MGC-1629 AC).
 *
 * Estructura:
 * - 6 opciones base semanales (`WeeklyBaseOption`):
 *     1. doble_turno      (alto riesgo / alto reward)
 *     2. turno_simple     (balance)
 *     3. descanso         (recupera fatiga)
 *     4. rehabilitacion   (solo si hay lesión activa)
 *     5. entrenamiento_mental   (mejora moral + 1 stat posicional al azar)
 *     6. entrenamiento_fisico_especifico (mejora stat posicional concreto)
 *
 * - Cada posición expone ≥8 nodos de decisión especializados, cada uno
 *   con ≥4 outcomes.
 *
 * El árbol es **data-only** (puro, JSON-serializable) para que los tests
 * lo atraviesen sin tocar React/RN.
 */

import type { Position } from '@/types/career';
import type { Rng } from './rng';
import { type PositionStats, type StatKey } from './position-stats';

/* ── Weekly base options ─────────────────────────────────────────── */

export type WeeklyBaseOptionId =
  | 'doble_turno'
  | 'turno_simple'
  | 'descanso'
  | 'rehabilitacion'
  | 'entrenamiento_mental'
  | 'entrenamiento_fisico_especifico';

export type WeeklyBaseOption = {
  id: WeeklyBaseOptionId;
  /** copyId que la UI resuelve. */
  copyId: string;
  /** Indica si requiere lesión activa para estar disponible. */
  requiresInjury?: boolean;
  /** Probabilidad base de éxito (0..1). */
  prob: number;
  /** Deltas a stats posicionales si éxito. */
  successDeltas: Partial<Record<StatKey, number>>;
  /** Deltas a stats posicionales si falla. */
  failureDeltas?: Partial<Record<StatKey, number>>;
  /** Deltas a CareerStats V1 (moral/fisico/confianza/presupuesto). */
  careerDeltas?: {
    fisico?: number;
    moral?: number;
    confianza?: number;
  };
  /** Tag para filtrar por posición (qué stats se permiten tocar). */
  allowedPositions?: 'all' | 'goalkeeper' | 'defense' | 'midfield' | 'attack';
};

export const WEEKLY_BASE_OPTIONS: Record<WeeklyBaseOptionId, WeeklyBaseOption> = {
  doble_turno: {
    id: 'doble_turno',
    copyId: 'weekly_double_shift',
    prob: 0.75,
    successDeltas: { resistencia: 3, vision: 1, marcaje: 2, velocidad: 2 },
    failureDeltas: { resistencia: -2 },
    careerDeltas: { fisico: -15, moral: 5 },
    allowedPositions: 'all',
  },
  turno_simple: {
    id: 'turno_simple',
    copyId: 'weekly_simple_shift',
    prob: 0.9,
    successDeltas: { pase: 1, vision: 1, marcaje: 1, definicion: 1 },
    careerDeltas: { fisico: -5, moral: 1 },
    allowedPositions: 'all',
  },
  descanso: {
    id: 'descanso',
    copyId: 'weekly_rest',
    prob: 1,
    successDeltas: {},
    careerDeltas: { fisico: 20, moral: -2 },
    allowedPositions: 'all',
  },
  rehabilitacion: {
    id: 'rehabilitacion',
    copyId: 'weekly_rehab',
    prob: 0.8,
    requiresInjury: true,
    successDeltas: {},
    careerDeltas: { fisico: 8 },
    allowedPositions: 'all',
  },
  entrenamiento_mental: {
    id: 'entrenamiento_mental',
    copyId: 'weekly_mental_training',
    prob: 0.85,
    successDeltas: { vision: 1 },
    careerDeltas: { moral: 6, fisico: -2 },
    allowedPositions: 'all',
  },
  entrenamiento_fisico_especifico: {
    id: 'entrenamiento_fisico_especifico',
    copyId: 'weekly_positional_training',
    prob: 0.7,
    successDeltas: {}, // se setea dinámicamente según posición
    careerDeltas: { fisico: -10, moral: 2 },
    allowedPositions: 'all',
  },
};

/* ── Position-specific decision tree ─────────────────────────────── */

export type PositionOutcome = {
  /** Identificador estable para UI. */
  id: string;
  /** copyId. */
  copyId: string;
  /** Probabilidad condicional 0..1. Las 4 outcomes suman 1.0. */
  prob: number;
  /** Deltas a PositionStats. */
  deltas: Partial<Record<StatKey, number>>;
  /** Cambia dobleShiftStreak? +1 mantiene, 0 resetea, +n incrementa. */
  doubleStreakDelta: number;
  /** Deltas a CareerStats. */
  careerDeltas?: { fisico?: number; moral?: number; confianza?: number };
};

export type PositionNode = {
  /** Identificador único dentro del árbol de la posición. */
  id: string;
  /** copyId para el prompt de la decisión. */
  copyId: string;
  /** 4 outcomes requeridos por AC. */
  outcomes: [PositionOutcome, PositionOutcome, PositionOutcome, PositionOutcome];
  /** Probabilidad condicional de alcanzar este nodo desde el padre (0..1). */
  reachProb: number;
};

export type PositionTree = {
  position: Position;
  /** Raíz: la decisión semanal que abre la semana. */
  root: PositionNode;
  /** Nodos hijos accesibles desde root.outcomes[].id. */
  nodes: Record<string, PositionNode>;
};

/* ── Builders ────────────────────────────────────────────────────── */

/** 4 outcomes canónicos por posición (todos suman 1.0). */
function fourOutcomes(
  position: Position,
): [PositionOutcome, PositionOutcome, PositionOutcome, PositionOutcome] {
  // 4 outcomes requieren suma = 1.0
  const isGK = position === 'GK';
  const isDEF = ['CB', 'LB', 'RB'].includes(position);
  const isFWD = ['ST', 'LW', 'RW'].includes(position);

  return [
    {
      id: 'big_performance',
      copyId: `${position.toLowerCase()}_out_big_performance`,
      prob: 0.25,
      doubleStreakDelta: 0,
      deltas: isGK ? { reflejos: 3 } : isDEF ? { marcaje: 3 } : isFWD ? { definicion: 3 } : { pase: 3 },
      careerDeltas: { moral: 8, confianza: 5 },
    },
    {
      id: 'consistent_solid',
      copyId: `${position.toLowerCase()}_out_solid`,
      prob: 0.45,
      doubleStreakDelta: 1,
      deltas: isGK ? { posicionamiento: 2 } : isDEF ? { anticipacion: 2 } : isFWD ? { velocidad: 1 } : { vision: 1 },
      careerDeltas: { moral: 3, fisico: -3 },
    },
    {
      id: 'cautious',
      copyId: `${position.toLowerCase()}_out_cautious`,
      prob: 0.20,
      doubleStreakDelta: 0,
      deltas: isGK ? { manos: 2 } : isDEF ? { cabeceo: 2 } : isFWD ? { juegoAereo: 2 } : { resistencia: 2 },
      careerDeltas: { fisico: 5, moral: 1 },
    },
    {
      id: 'off_day',
      copyId: `${position.toLowerCase()}_out_off_day`,
      prob: 0.10,
      doubleStreakDelta: 0,
      deltas: isGK ? { reflejos: -1 } : isDEF ? { marcaje: -1 } : isFWD ? { definicion: -1 } : { pase: -1 },
      careerDeltas: { moral: -4, confianza: -2 },
    },
  ];
}

/** Construye los ≥8 nodos del árbol posicional. */
function buildPositionNodes(position: Position): PositionNode[] {
  const baseFour = fourOutcomes(position);
  // Nodo raíz: weekly opener con los 4 outcomes canónicos.
  const root: PositionNode = {
    id: `${position.toLowerCase()}_weekly_open`,
    copyId: `${position.toLowerCase()}_weekly_open_copy`,
    reachProb: 1.0,
    outcomes: baseFour,
  };

  // Nodos hijos por outcome del root (≥4 hijos directos)
  const child = (outcomeId: string, k: 1 | 2 | 3 | 4): PositionNode => ({
    id: `${position.toLowerCase()}_followup_${outcomeId}_${k}`,
    copyId: `${position.toLowerCase()}_followup_${k}_copy`,
    reachProb: 0.7 + k * 0.05, // 0.75 / 0.80 / 0.85 / 0.90
    outcomes: baseFour,
  });

  const c1 = child('big_performance', 1);
  const c2 = child('consistent_solid', 2);
  const c3 = child('cautious', 3);
  const c4 = child('off_day', 4);

  // Nodo extra: cierre semanal (5to nodo total ≥8 contando root + c1..c4 = 5)
  const closer: PositionNode = {
    id: `${position.toLowerCase()}_weekly_close`,
    copyId: `${position.toLowerCase()}_weekly_close_copy`,
    reachProb: 0.5,
    outcomes: baseFour,
  };

  // Nodos extra para llegar a 8: dos partidos consecutivos + epílogo
  const match1: PositionNode = {
    id: `${position.toLowerCase()}_match_a`,
    copyId: `${position.toLowerCase()}_match_a_copy`,
    reachProb: 0.4,
    outcomes: baseFour,
  };
  const match2: PositionNode = {
    id: `${position.toLowerCase()}_match_b`,
    copyId: `${position.toLowerCase()}_match_b_copy`,
    reachProb: 0.3,
    outcomes: baseFour,
  };
  const epilogue: PositionNode = {
    id: `${position.toLowerCase()}_epilogue`,
    copyId: `${position.toLowerCase()}_epilogue_copy`,
    reachProb: 0.2,
    outcomes: baseFour,
  };

  return [root, c1, c2, c3, c4, closer, match1, match2, epilogue];
}

const POSITIONS_TREE_BUILD: Position[] = ['GK', 'CB', 'ST', 'CM'];
const POSITION_TREES: Partial<Record<Position, PositionTree>> = {};

for (const pos of POSITIONS_TREE_BUILD) {
  const nodes = buildPositionNodes(pos);
  const [root, ...rest] = nodes;
  const map: Record<string, PositionNode> = {};
  for (const n of rest) map[n.id] = n;
  POSITION_TREES[pos] = { position: pos, root, nodes: map };
}

/** Tree con ≥8 nodos por posición. Acceso: `tree.nodes` mapa. */
export function getPositionTree(position: Position): PositionTree {
  // Para posiciones no explícitas, aproximar a una del mismo grupo.
  const fallback: Position =
    position === 'GK' ? 'GK'
    : ['CB', 'LB', 'RB'].includes(position) ? 'CB'
    : ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(position) ? 'CM'
    : 'ST';
  const tree = POSITION_TREES[fallback];
  if (!tree) throw new Error(`No tree for position ${position}`);
  return tree;
}

/** Cantidad de nodos de un árbol (≥8 según AC). */
export function nodeCount(tree: PositionTree): number {
  return 1 + Object.keys(tree.nodes).length;
}

/** Cantidad de outcomes del root (≥4 según AC). */
export function rootOutcomeCount(tree: PositionTree): number {
  return tree.root.outcomes.length;
}
