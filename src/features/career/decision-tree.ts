/**
 * F3.2 — Árbol de decisión completo por posición (MGC-1632, ADR-0017 §3).
 *
 * AC de F3.2: **≥20 nodos por posición, ≥6 outcomes por nodo**, con los
 * `weight` de cada nodo sumando 1.0.
 *
 * Por qué un módulo nuevo y no una extensión de `position-tree.ts`:
 * el árbol de F2.2 (`PositionTree` / `PositionOutcome`) tiene un contrato
 * cerrado — tupla de exactamente 4 outcomes con `prob`, verificado por
 * `fase2-arbol.test.ts`. ADR-0017 §3 define una estructura distinta
 * (`weight` normalizado + `nextNode` encadenado). Mantenerlos separados
 * evita romper el AC de F2.2 y deja el árbol de F3 con la forma exacta
 * que el ADR especifica.
 *
 * Desviación declarada respecto del ADR: `statDelta` se tipa contra
 * `StatKey` (`position-stats.ts`) en lugar del `PlayerStats` genérico del
 * pseudocódigo, porque es el vocabulario real de stats que el motor
 * mueve desde F2.2.
 *
 * Módulo data-only y puro: sin React, sin `Math.random()`.
 */

import type { Position } from '@/types/career';
import { statsForPosition, type StatKey } from './position-stats';
import type { Rng } from './rng';

/* ── Tipos (ADR §3) ──────────────────────────────────────────────── */

export type DecisionNodeId = string;
export type OutcomeId =
  | 'brillante'
  | 'solido'
  | 'correcto'
  | 'irregular'
  | 'flojo'
  | 'desastre';

export type DecisionOutcome = {
  id: OutcomeId;
  /** copyId que la UI resuelve contra `COPY[locale].decisionTree.outcomes`. */
  copyId: string;
  /** Probabilidad relativa. `sum(node.outcomes[].weight) === 1.0`. */
  weight: number;
  statDelta: Partial<Record<StatKey, number>>;
  formDelta: number;
  fatigueDelta: number;
  /** 0..1, se gatea con `rng.chance()`. */
  injuryChance: number;
  nextNode: DecisionNodeId | null;
};

export type DecisionNode = {
  id: DecisionNodeId;
  /** copyId del prompt. Compartido entre posiciones (mismo contexto narrativo). */
  copyId: string;
  /** Contexto narrativo del nodo (pretemporada, derbi, rueda de prensa…). */
  context: NodeContext;
  outcomes: DecisionOutcome[];
};

export type DecisionTree = {
  position: Position;
  rootId: DecisionNodeId;
  nodes: Record<DecisionNodeId, DecisionNode>;
};

/* ── Contextos narrativos: 20 nodos por posición ─────────────────── */

export type NodeContext = (typeof NODE_CONTEXTS)[number]['id'];

/**
 * 20 contextos → 20 nodos por posición (AC ≥20). Cada uno modula:
 * - `intensity`: escala los deltas de stat (0.5 = sesión suave, 2 = derbi).
 * - `spread`:    mueve masa de `correcto` a las dos colas (alta varianza).
 * - `risk`:      escala `injuryChance` del outcome `desastre`.
 * - `fatigue`:   costo físico base del nodo.
 */
const NODE_CONTEXTS = [
  { id: 'pretemporada', intensity: 1.2, spread: 0.02, risk: 1.0, fatigue: -8 },
  { id: 'entrenamiento_base', intensity: 0.8, spread: 0.0, risk: 0.6, fatigue: -5 },
  { id: 'doble_sesion', intensity: 1.6, spread: 0.05, risk: 1.8, fatigue: -14 },
  { id: 'gimnasio', intensity: 1.0, spread: 0.01, risk: 1.2, fatigue: -10 },
  { id: 'video_analisis', intensity: 0.7, spread: 0.0, risk: 0.1, fatigue: -1 },
  { id: 'charla_tecnico', intensity: 0.6, spread: 0.03, risk: 0.0, fatigue: 0 },
  { id: 'vestuario_tension', intensity: 0.9, spread: 0.06, risk: 0.2, fatigue: -2 },
  { id: 'partido_liga', intensity: 1.4, spread: 0.03, risk: 1.4, fatigue: -12 },
  { id: 'partido_copa', intensity: 1.5, spread: 0.04, risk: 1.5, fatigue: -13 },
  { id: 'derbi', intensity: 2.0, spread: 0.06, risk: 2.0, fatigue: -16 },
  { id: 'visitante_hostil', intensity: 1.3, spread: 0.05, risk: 1.6, fatigue: -14 },
  { id: 'rueda_prensa', intensity: 0.5, spread: 0.04, risk: 0.0, fatigue: 0 },
  { id: 'redes_sociales', intensity: 0.4, spread: 0.06, risk: 0.0, fatigue: 0 },
  { id: 'oferta_agente', intensity: 0.5, spread: 0.05, risk: 0.0, fatigue: -1 },
  { id: 'convocatoria_juvenil', intensity: 1.3, spread: 0.03, risk: 1.1, fatigue: -9 },
  { id: 'amistoso_internacional', intensity: 1.1, spread: 0.02, risk: 1.0, fatigue: -11 },
  { id: 'manejo_molestia', intensity: 0.6, spread: 0.02, risk: 0.4, fatigue: 6 },
  { id: 'rotacion_banco', intensity: 0.5, spread: 0.04, risk: 0.3, fatigue: 8 },
  { id: 'cierre_mercado', intensity: 0.6, spread: 0.05, risk: 0.0, fatigue: -2 },
  { id: 'final_temporada', intensity: 1.8, spread: 0.06, risk: 1.7, fatigue: -15 },
] as const;

export const NODE_CONTEXT_IDS: readonly NodeContext[] = NODE_CONTEXTS.map((c) => c.id);

/* ── Plantilla de los 6 outcomes ─────────────────────────────────── */

/**
 * Pesos base. Suman exactamente 1.0:
 * 0.12 + 0.28 + 0.25 + 0.18 + 0.12 + 0.05.
 *
 * `spread` del nodo mueve masa de `correcto` a las dos colas
 * (`brillante` +s, `desastre` +s, `correcto` -2s), lo que preserva la
 * suma por construcción y modela nodos de alta varianza (derbi, redes)
 * frente a nodos planos (video análisis).
 */
const OUTCOME_TEMPLATE: readonly {
  id: OutcomeId;
  weight: number;
  /** Multiplicador sobre los deltas de stat de la posición. */
  statScale: number;
  formDelta: number;
  fatigueScale: number;
  /** Chance de lesión base, escalada por `risk` del nodo. */
  injuryBase: number;
}[] = [
  { id: 'brillante', weight: 0.12, statScale: 3, formDelta: 8, fatigueScale: 1.2, injuryBase: 0 },
  { id: 'solido', weight: 0.28, statScale: 2, formDelta: 4, fatigueScale: 1.0, injuryBase: 0 },
  { id: 'correcto', weight: 0.25, statScale: 1, formDelta: 1, fatigueScale: 0.9, injuryBase: 0 },
  { id: 'irregular', weight: 0.18, statScale: 0, formDelta: -2, fatigueScale: 1.0, injuryBase: 0.01 },
  { id: 'flojo', weight: 0.12, statScale: -1, formDelta: -5, fatigueScale: 1.1, injuryBase: 0.02 },
  { id: 'desastre', weight: 0.05, statScale: -2, formDelta: -9, fatigueScale: 1.4, injuryBase: 0.06 },
];

/** Índices dentro de `OUTCOME_TEMPLATE` que el `spread` mueve. */
const IDX_BRILLANTE = 0;
const IDX_CORRECTO = 2;
const IDX_DESASTRE = 5;

/* ── Builders ────────────────────────────────────────────────────── */

const nodeId = (position: Position, context: NodeContext): DecisionNodeId =>
  `${position.toLowerCase()}_${context}`;

/**
 * Reparte `statScale` entre los 4 stats de la posición. El primero (el
 * principal según `statsForPosition`) recibe el delta completo; los otros
 * tres reciben la mitad redondeada, de modo que un `brillante` en un GK
 * mueva reflejos más que manos.
 */
function statDeltaFor(
  position: Position,
  statScale: number,
  intensity: number,
): Partial<Record<StatKey, number>> {
  if (statScale === 0) return {};
  const keys = statsForPosition(position);
  const primary = Math.round(statScale * intensity);
  const secondary = Math.round(statScale * intensity * 0.5);
  const out: Partial<Record<StatKey, number>> = {};
  keys.forEach((k, i) => {
    const value = i === 0 ? primary : secondary;
    if (value !== 0) out[k] = value;
  });
  return out;
}

function buildOutcomes(
  position: Position,
  contextIndex: number,
  nextId: DecisionNodeId | null,
): DecisionOutcome[] {
  const ctx = NODE_CONTEXTS[contextIndex];

  return OUTCOME_TEMPLATE.map((tpl, i) => {
    // `spread` preserva la suma: +s / +s / -2s sobre tres slots.
    const weight =
      i === IDX_BRILLANTE
        ? tpl.weight + ctx.spread
        : i === IDX_DESASTRE
          ? tpl.weight + ctx.spread
          : i === IDX_CORRECTO
            ? tpl.weight - 2 * ctx.spread
            : tpl.weight;

    return {
      id: tpl.id,
      copyId: `tree_out_${tpl.id}`,
      weight,
      statDelta: statDeltaFor(position, tpl.statScale, ctx.intensity),
      formDelta: tpl.formDelta,
      fatigueDelta: Math.round(ctx.fatigue * tpl.fatigueScale),
      injuryChance: Number((tpl.injuryBase * ctx.risk).toFixed(4)),
      // `desastre` corta la cadena y devuelve al jugador al nodo de
      // manejo de molestia; el resto avanza al siguiente contexto.
      nextNode: tpl.id === 'desastre' ? nodeId(position, 'manejo_molestia') : nextId,
    };
  });
}

function buildTree(position: Position): DecisionTree {
  const nodes: Record<DecisionNodeId, DecisionNode> = {};

  NODE_CONTEXTS.forEach((ctx, i) => {
    const isLast = i === NODE_CONTEXTS.length - 1;
    const nextId = isLast ? null : nodeId(position, NODE_CONTEXTS[i + 1].id);
    const id = nodeId(position, ctx.id);
    nodes[id] = {
      id,
      copyId: `tree_node_${ctx.id}`,
      context: ctx.id,
      outcomes: buildOutcomes(position, i, nextId),
    };
  });

  return {
    position,
    rootId: nodeId(position, NODE_CONTEXTS[0].id),
    nodes,
  };
}

/** Las 12 posiciones del field map (mismo set que `position-tree.ts`). */
const TREE_POSITIONS = [
  'GK',
  'CB', 'LB', 'RB',
  'CDM', 'CM', 'CAM', 'LM', 'RM',
  'ST', 'LW', 'RW',
] as const satisfies readonly Position[];

const DECISION_TREES: Record<Position, DecisionTree> = TREE_POSITIONS.reduce(
  (acc, pos) => {
    acc[pos] = buildTree(pos);
    return acc;
  },
  {} as Record<Position, DecisionTree>,
);

/* ── API pública ─────────────────────────────────────────────────── */

export function getDecisionTree(position: Position): DecisionTree {
  const tree = DECISION_TREES[position];
  if (!tree) throw new Error(`No decision tree for position ${position}`);
  return tree;
}

export function getDecisionNode(position: Position, id: DecisionNodeId): DecisionNode | null {
  return getDecisionTree(position).nodes[id] ?? null;
}

export function decisionNodeCount(tree: DecisionTree): number {
  return Object.keys(tree.nodes).length;
}

/**
 * ADR-0017 §3 — selección uniforme sobre la suma de `weight`.
 * Consume exactamente un `rng.next()` por invocación, lo que hace el
 * replay por seed exacto.
 */
export function pickOutcome(rng: Rng, node: DecisionNode): DecisionOutcome {
  const total = node.outcomes.reduce((s, o) => s + o.weight, 0);
  const r = rng.next() * total;
  let acc = 0;
  for (const o of node.outcomes) {
    acc += o.weight;
    if (r < acc) return o;
  }
  return node.outcomes[node.outcomes.length - 1];
}

/**
 * Recorre el árbol desde `rootId` hasta agotar la cadena o alcanzar
 * `maxSteps`. Devuelve la traza de outcomes para que QA pueda comparar
 * historias divergentes con seeds distintos (AC de F3.3).
 */
export function walkTree(
  position: Position,
  rng: Rng,
  maxSteps = NODE_CONTEXTS.length,
): { nodeId: DecisionNodeId; outcome: DecisionOutcome }[] {
  const tree = getDecisionTree(position);
  const trace: { nodeId: DecisionNodeId; outcome: DecisionOutcome }[] = [];
  let current: DecisionNodeId | null = tree.rootId;
  const visited = new Set<DecisionNodeId>();

  for (let step = 0; step < maxSteps && current; step += 1) {
    const node: DecisionNode | undefined = tree.nodes[current];
    if (!node) break;
    // El salto a `manejo_molestia` puede reentrar; cortamos el ciclo.
    if (visited.has(current)) break;
    visited.add(current);
    const outcome = pickOutcome(rng, node);
    trace.push({ nodeId: current, outcome });
    current = outcome.nextNode;
  }

  return trace;
}
