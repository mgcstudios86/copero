/**
 * F3.2 — Tests del motor de Fase 3 (MGC-1632).
 *
 * Verifica literalmente los AC del issue y las invariantes de ADR-0017:
 *
 * 1. Árbol de decisión: ≥20 nodos por posición, ≥6 outcomes por nodo,
 *    `sum(weight) == 1.0 ± 1e-9` (§3).
 * 2. Eventos post-partido: tabla de probabilidades (§1) y gate de suerte
 *    por posición (§2) — "sin stats la suerte no compensa".
 * 3. Transfer system: tabla de veredictos (§4), incluido el bucket
 *    `hold_low` `[6.0, 7.0)` que MGC-1654 agregó.
 * 4. Replay determinista por seed (§5).
 * 5. i18n: paridad de claves es/en/zh-CN en todo el copy nuevo.
 */

import { describe, expect, it } from 'vitest';
import { COPY, SUPPORTED_LOCALES, type Locale } from '@/i18n/copy';
import type { Position } from '@/types/career';
import {
  decisionNodeCount,
  getDecisionTree,
  NODE_CONTEXT_IDS,
  pickOutcome,
  walkTree,
} from './decision-tree';
import {
  KEY_STAT_BY_GROUP,
  NO_MODIFIERS,
  passesLuckGate,
  ratingFromScore,
  resolvePostMatch,
  rollPostMatchEvent,
  runPostMatch,
  SUERTE_GATE,
  type PostMatchInput,
} from './events';
import { STAT_INIT, statsForPosition, type PositionStats } from './position-stats';
import { groupOf } from './positions';
import { createRng } from './rng';
import {
  acceptedClub,
  acceptOffer,
  DECISION_WINDOW_WEEKS,
  declineAllOffers,
  evaluateTransfer,
  evaluateVerdict,
  expireIfPastDeadline,
  type TransferInput,
} from './transfers';

const ALL_POSITIONS: Position[] = [
  'GK',
  'CB', 'LB', 'RB',
  'CDM', 'CM', 'CAM', 'LM', 'RM',
  'ST', 'LW', 'RW',
];

/** Stats con el stat principal de la posición forzado a un valor. */
function statsWithKey(position: Position, value: number): PositionStats {
  const key = KEY_STAT_BY_GROUP[groupOf(position)];
  return { ...STAT_INIT, [key]: value };
}

/* ── §3 — Árbol de decisión completo ─────────────────────────────── */

describe('F3.2 — árbol de decisión (≥20 nodos × ≥6 outcomes)', () => {
  it('las 12 posiciones tienen árbol propio', () => {
    for (const pos of ALL_POSITIONS) {
      expect(() => getDecisionTree(pos)).not.toThrow();
      expect(getDecisionTree(pos).position).toBe(pos);
    }
  });

  it('cada posición expone ≥20 nodos', () => {
    for (const pos of ALL_POSITIONS) {
      expect(decisionNodeCount(getDecisionTree(pos))).toBeGreaterThanOrEqual(20);
    }
  });

  it('cada nodo expone ≥6 outcomes', () => {
    for (const pos of ALL_POSITIONS) {
      for (const node of Object.values(getDecisionTree(pos).nodes)) {
        expect(node.outcomes.length).toBeGreaterThanOrEqual(6);
      }
    }
  });

  it('los weights de cada nodo suman 1.0 ± 1e-9 (ADR §3)', () => {
    for (const pos of ALL_POSITIONS) {
      for (const node of Object.values(getDecisionTree(pos).nodes)) {
        const sum = node.outcomes.reduce((a, o) => a + o.weight, 0);
        expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
      }
    }
  });

  it('ningún weight es negativo (el `spread` no puede vaciar `correcto`)', () => {
    for (const pos of ALL_POSITIONS) {
      for (const node of Object.values(getDecisionTree(pos).nodes)) {
        for (const o of node.outcomes) expect(o.weight).toBeGreaterThan(0);
      }
    }
  });

  it('los ids de nodo son únicos dentro del árbol y estables entre posiciones', () => {
    for (const pos of ALL_POSITIONS) {
      const tree = getDecisionTree(pos);
      const ids = Object.keys(tree.nodes);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length).toBe(NODE_CONTEXT_IDS.length);
      expect(tree.nodes[tree.rootId]).toBeDefined();
    }
  });

  it('`nextNode` apunta siempre a un nodo existente o a null', () => {
    for (const pos of ALL_POSITIONS) {
      const tree = getDecisionTree(pos);
      for (const node of Object.values(tree.nodes)) {
        for (const o of node.outcomes) {
          if (o.nextNode === null) continue;
          expect(tree.nodes[o.nextNode]).toBeDefined();
        }
      }
    }
  });

  it('los statDelta sólo tocan los 4 stats de la posición', () => {
    for (const pos of ALL_POSITIONS) {
      const allowed = new Set<string>(statsForPosition(pos));
      for (const node of Object.values(getDecisionTree(pos).nodes)) {
        for (const o of node.outcomes) {
          for (const key of Object.keys(o.statDelta)) {
            expect(allowed.has(key), `${pos} → ${node.id} toca ${key}`).toBe(true);
          }
        }
      }
    }
  });

  it('`pickOutcome` es determinista con el mismo seed y diverge con otro', () => {
    const node = getDecisionTree('ST').nodes[getDecisionTree('ST').rootId];
    const a = pickOutcome(createRng(1234), node);
    const b = pickOutcome(createRng(1234), node);
    expect(a.id).toBe(b.id);

    const ids = new Set<string>();
    for (let seed = 1; seed <= 60; seed += 1) {
      ids.add(pickOutcome(createRng(seed), node).id);
    }
    // Con 60 seeds distintos deberían salir al menos 3 outcomes distintos.
    expect(ids.size).toBeGreaterThanOrEqual(3);
  });

  it('`walkTree` produce historias divergentes con seeds distintos (AC F3.3)', () => {
    const traceA = walkTree('CM', createRng(7)).map((s) => s.outcome.id).join('|');
    const traceB = walkTree('CM', createRng(7)).map((s) => s.outcome.id).join('|');
    const traceC = walkTree('CM', createRng(99991)).map((s) => s.outcome.id).join('|');
    expect(traceA).toBe(traceB); // replay exacto por seed (ADR §5)
    expect(traceA).not.toBe(traceC);
  });

  it('`walkTree` termina (no cicla en `manejo_molestia`)', () => {
    for (const pos of ALL_POSITIONS) {
      const trace = walkTree(pos, createRng(pos.length * 31 + 5));
      expect(trace.length).toBeGreaterThan(0);
      expect(trace.length).toBeLessThanOrEqual(NODE_CONTEXT_IDS.length);
    }
  });
});

/* ── §1/§2 — Eventos post-partido ────────────────────────────────── */

describe('F3.2 — eventos post-partido (ADR-0017 §1)', () => {
  const baseInput = (over: Partial<PostMatchInput> = {}): PostMatchInput => ({
    position: 'ST',
    positionStats: statsWithKey('ST', 80),
    rating: 7.5,
    form: 70,
    week: 3,
    ...over,
  });

  it('rating < 6.0 no dispara ningún evento', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const ev = rollPostMatchEvent(baseInput({ rating: 5.9 }), createRng(seed));
      expect(ev).toBeNull();
    }
  });

  it('rating ∈ [6.0, 7.0) siempre cae en `descanso`', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const ev = rollPostMatchEvent(baseInput({ rating: 6.5 }), createRng(seed));
      expect(ev?.id).toBe('descanso');
    }
  });

  it('rating ≥ 7.0 produce fiesta/gambling/compra en ~50% de los seeds', () => {
    let salio = 0;
    const N = 400;
    for (let seed = 1; seed <= N; seed += 1) {
      const ev = rollPostMatchEvent(baseInput({ rating: 7.5 }), createRng(seed));
      if (ev && ev.id !== 'descanso') salio += 1;
    }
    const ratio = salio / N;
    expect(ratio).toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(0.6);
  });

  it('`gambling` requiere form ≥ 60', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const ev = rollPostMatchEvent(baseInput({ form: 59, rating: 8.5 }), createRng(seed));
      expect(ev?.id).not.toBe('gambling');
    }
  });

  it('`compra_lujosa` requiere rating ≥ 8.0', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const ev = rollPostMatchEvent(baseInput({ rating: 7.5 }), createRng(seed));
      expect(ev?.id).not.toBe('compra_lujosa');
    }
  });

  it('`premiacion_individual` sólo aparece con rating ≥ 9.0', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const bajo = rollPostMatchEvent(baseInput({ rating: 8.9 }), createRng(seed));
      expect(bajo?.id).not.toBe('premiacion_individual');
    }
    const altos = new Set<string>();
    for (let seed = 1; seed <= 300; seed += 1) {
      const ev = rollPostMatchEvent(baseInput({ rating: 9.5 }), createRng(seed));
      if (ev) altos.add(ev.id);
    }
    expect(altos.has('premiacion_individual')).toBe(true);
  });

  it('`ratingFromScore` mapea el score 0..100 de resolveMatch a 0..10', () => {
    expect(ratingFromScore(0)).toBe(0);
    expect(ratingFromScore(75)).toBe(7.5);
    expect(ratingFromScore(120)).toBe(10);
    expect(ratingFromScore(-5)).toBe(0);
  });
});

describe('F3.2 — gate de suerte por posición (ADR-0017 §2)', () => {
  it('el umbral por línea es el del ADR', () => {
    expect(SUERTE_GATE.goalkeeper).toBe(70);
    expect(SUERTE_GATE.defense).toBe(68);
    expect(SUERTE_GATE.midfield).toBe(66);
    expect(SUERTE_GATE.attack).toBe(65);
  });

  it('`passesLuckGate` compara contra el stat principal de la posición', () => {
    for (const pos of ALL_POSITIONS) {
      const gate = SUERTE_GATE[groupOf(pos)];
      expect(passesLuckGate(pos, statsWithKey(pos, gate - 1))).toBe(false);
      expect(passesLuckGate(pos, statsWithKey(pos, gate))).toBe(true);
    }
  });

  it('sin stats la suerte NO compensa: luckBonus = 0 pero el costo se aplica igual', () => {
    const input: PostMatchInput = {
      position: 'GK',
      positionStats: statsWithKey('GK', 40), // muy por debajo del gate 70
      rating: 7.5,
      form: 80,
      week: 5,
    };
    let vistos = 0;
    for (let seed = 1; seed <= 120; seed += 1) {
      const { event, modifiers } = runPostMatch(input, createRng(seed));
      if (!event) continue;
      vistos += 1;
      expect(event.luckGatePassed).toBe(false);
      expect(modifiers.luckBonus).toBe(0);
      // El costo (fatiga / moral) se sigue aplicando: el evento no es inocuo.
      const tieneCosto =
        modifiers.fatigueDelta !== 0 || modifiers.moralDelta !== 0 || modifiers.confianzaDelta !== 0;
      expect(tieneCosto).toBe(true);
    }
    expect(vistos).toBeGreaterThan(0);
  });

  it('con stats sobre el gate el luckBonus cae en [0.10, 0.15)', () => {
    const input: PostMatchInput = {
      position: 'ST',
      positionStats: statsWithKey('ST', 90),
      rating: 7.5,
      form: 80,
      week: 5,
    };
    let vistos = 0;
    for (let seed = 1; seed <= 120; seed += 1) {
      const { event, modifiers } = runPostMatch(input, createRng(seed));
      if (!event) continue;
      vistos += 1;
      expect(modifiers.luckBonus).toBeGreaterThanOrEqual(0.1);
      expect(modifiers.luckBonus).toBeLessThan(0.15);
    }
    expect(vistos).toBeGreaterThan(0);
  });

  it('`gambling` multiplica el riesgo de lesión por 1.5..2.0', () => {
    const gambling = {
      id: 'gambling' as const,
      copyId: 'post_match_gambling',
      rating: 8.5,
      week: 4,
      luckGatePassed: true,
    };
    for (let seed = 1; seed <= 50; seed += 1) {
      const mods = resolvePostMatch(gambling, createRng(seed));
      expect(mods.injuryRiskMul).toBeGreaterThanOrEqual(1.5);
      expect(mods.injuryRiskMul).toBeLessThan(2.0);
    }
  });

  it('`compra_lujosa` baja el trainingBoost a 0.9; el resto queda en 1.0', () => {
    const mk = (id: 'compra_lujosa' | 'fiesta' | 'descanso') => ({
      id,
      copyId: `post_match_${id}`,
      rating: 8.5,
      week: 4,
      luckGatePassed: true,
    });
    expect(resolvePostMatch(mk('compra_lujosa'), createRng(1)).trainingBoost).toBe(0.9);
    expect(resolvePostMatch(mk('fiesta'), createRng(1)).trainingBoost).toBe(1);
    expect(resolvePostMatch(mk('descanso'), createRng(1)).trainingBoost).toBe(1);
  });

  it('sin evento, `runPostMatch` devuelve los modificadores neutros', () => {
    const { event, modifiers } = runPostMatch(
      { position: 'CB', positionStats: STAT_INIT, rating: 4, form: 50, week: 1 },
      createRng(3),
    );
    expect(event).toBeNull();
    expect(modifiers).toEqual(NO_MODIFIERS);
  });
});

/* ── §4 — Transfer system ────────────────────────────────────────── */

describe('F3.2 — transfer system (ADR-0017 §4)', () => {
  const base = (over: Partial<TransferInput> = {}): TransferInput => ({
    avgRating: 7.2,
    goals: 5,
    tablePos: 10,
    position: 'CM',
    age: 24,
    season: 2,
    seasonEndWeek: 38,
    currentClubId: 'velez',
    ...over,
  });

  it('`retirement` gana a todo con age ≥ 35', () => {
    expect(evaluateVerdict(base({ age: 35, avgRating: 9.5, goals: 40, tablePos: 1 }))).toBe(
      'retirement',
    );
  });

  it('`elite_offers` para no-delantero: avgRating ≥ 8.0 y tablePos ≤ 4', () => {
    expect(evaluateVerdict(base({ avgRating: 8.0, tablePos: 4 }))).toBe('elite_offers');
    expect(evaluateVerdict(base({ avgRating: 8.0, tablePos: 5 }))).not.toBe('elite_offers');
  });

  it('`elite_offers` para delantero se mide por goles ≥ 15, no por tabla', () => {
    expect(evaluateVerdict(base({ position: 'ST', avgRating: 8.2, goals: 15, tablePos: 14 }))).toBe(
      'elite_offers',
    );
    expect(
      evaluateVerdict(base({ position: 'ST', avgRating: 8.2, goals: 14, tablePos: 1 })),
    ).not.toBe('elite_offers');
  });

  it('`strong_offers`: avgRating ≥ 7.4 y tablePos ≤ 8', () => {
    expect(evaluateVerdict(base({ avgRating: 7.4, tablePos: 8 }))).toBe('strong_offers');
  });

  it('`hold`: 7.0 ≤ avgRating < 7.4 con tablePos < 16', () => {
    expect(evaluateVerdict(base({ avgRating: 7.0, tablePos: 15 }))).toBe('hold');
    expect(evaluateVerdict(base({ avgRating: 7.39, tablePos: 15 }))).toBe('hold');
  });

  it('MGC-1654 — `hold_low` cubre el bucket [6.0, 7.0) con tablePos < 16', () => {
    expect(evaluateVerdict(base({ avgRating: 6.5, tablePos: 10 }))).toBe('hold_low');
    expect(evaluateVerdict(base({ avgRating: 6.0, tablePos: 15 }))).toBe('hold_low');
    expect(evaluateVerdict(base({ avgRating: 6.99, tablePos: 1 }))).toBe('hold_low');
    // El borde inferior sale del bucket.
    expect(evaluateVerdict(base({ avgRating: 5.99, tablePos: 10 }))).toBe('descent_risk');
  });

  it('`descent_risk`: avgRating < 6.0 ó tablePos ≥ 16', () => {
    expect(evaluateVerdict(base({ avgRating: 5.5, tablePos: 3 }))).toBe('descent_risk');
    expect(evaluateVerdict(base({ avgRating: 8.5, tablePos: 16 }))).toBe('descent_risk');
  });

  it('el bucket [6.0, 7.0) no queda sin veredicto para ninguna combinación', () => {
    // Se itera en centésimos enteros: `r += 0.05` acumula error de coma
    // flotante y el último paso cae en 7.00, que ya es `hold`.
    for (let c = 600; c < 700; c += 5) {
      for (const tablePos of [1, 8, 15, 16, 20]) {
        const v = evaluateVerdict(base({ avgRating: c / 100, tablePos }));
        expect(['hold_low', 'descent_risk']).toContain(v);
      }
    }
  });

  it('cantidad de ofertas por veredicto: elite 3, strong 2, descent 1, hold 0-1', () => {
    const elite = evaluateTransfer(base({ avgRating: 8.5, tablePos: 2 }), createRng(11));
    expect(elite.verdict).toBe('elite_offers');
    expect(elite.offers).toHaveLength(3);

    const strong = evaluateTransfer(base({ avgRating: 7.5, tablePos: 6 }), createRng(11));
    expect(strong.offers).toHaveLength(2);

    const descent = evaluateTransfer(base({ avgRating: 4, tablePos: 18 }), createRng(11));
    expect(descent.offers).toHaveLength(1);
    expect(descent.forcedTransfer).toBe(true);

    for (let seed = 1; seed <= 20; seed += 1) {
      const hold = evaluateTransfer(base({ avgRating: 7.1, tablePos: 12 }), createRng(seed));
      expect(hold.offers.length).toBeLessThanOrEqual(1);
    }
  });

  it('`retirement` no genera ofertas', () => {
    const st = evaluateTransfer(base({ age: 36 }), createRng(5));
    expect(st.verdict).toBe('retirement');
    expect(st.offers).toHaveLength(0);
    expect(st.forcedTransfer).toBe(false);
  });

  it('las ofertas nunca repiten club ni incluyen el club actual', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const st = evaluateTransfer(base({ avgRating: 8.5, tablePos: 1 }), createRng(seed));
      const ids = st.offers.map((o) => o.club.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).not.toContain('velez');
    }
  });

  it('los parámetros de oferta caen en los rangos del ADR', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const st = evaluateTransfer(base({ avgRating: 8.5, tablePos: 1 }), createRng(seed));
      for (const o of st.offers) {
        expect(o.reputationDelta).toBeGreaterThanOrEqual(10);
        expect(o.reputationDelta).toBeLessThanOrEqual(25);
        expect(o.wageMultiplier).toBeGreaterThanOrEqual(1.0);
        expect(o.wageMultiplier).toBeLessThanOrEqual(3.0);
        expect(o.yearsContract).toBeGreaterThanOrEqual(2);
        expect(o.yearsContract).toBeLessThanOrEqual(5);
        // Elite fuerza titularidad (ADR §4).
        expect(o.expectedRole).toBe('starter');
      }
    }
  });

  it('`decisionDeadline` = seasonEndWeek + 4', () => {
    const st = evaluateTransfer(base({ seasonEndWeek: 38 }), createRng(3));
    expect(st.decisionDeadline).toBe(38 + DECISION_WINDOW_WEEKS);
  });

  it('cruzar el deadline sin decidir aplica `no_movement`', () => {
    const st = evaluateTransfer(base({ avgRating: 8.5, tablePos: 1, seasonEndWeek: 38 }), createRng(3));
    expect(st.resolved).toBe(false);

    const antes = expireIfPastDeadline(st, 41);
    expect(antes.resolved).toBe(false);

    const despues = expireIfPastDeadline(st, 42);
    expect(despues.resolved).toBe(true);
    expect(despues.acceptedOfferId).toBeNull();
    expect(acceptedClub(despues)).toBeNull();

    // Idempotente.
    expect(expireIfPastDeadline(despues, 99)).toEqual(despues);
  });

  it('aceptar una oferta la marca resuelta y expone el club', () => {
    const st = evaluateTransfer(base({ avgRating: 8.5, tablePos: 1 }), createRng(3));
    const target = st.offers[0];
    const next = acceptOffer(st, target.id);
    expect(next.resolved).toBe(true);
    expect(next.acceptedOfferId).toBe(target.id);
    expect(acceptedClub(next)?.id).toBe(target.club.id);
    // No muta el original.
    expect(st.resolved).toBe(false);
  });

  it('aceptar un id inexistente no cambia nada', () => {
    const st = evaluateTransfer(base({ avgRating: 8.5, tablePos: 1 }), createRng(3));
    expect(acceptOffer(st, 'offer_inexistente_9')).toEqual(st);
  });

  it('rechazar todo resuelve sin club', () => {
    const st = declineAllOffers(evaluateTransfer(base({ avgRating: 8.5, tablePos: 1 }), createRng(3)));
    expect(st.resolved).toBe(true);
    expect(acceptedClub(st)).toBeNull();
  });

  it('replay exacto: mismo seed → mismas ofertas (ADR §5)', () => {
    const a = evaluateTransfer(base({ avgRating: 8.5, tablePos: 1 }), createRng(4242));
    const b = evaluateTransfer(base({ avgRating: 8.5, tablePos: 1 }), createRng(4242));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));

    const c = evaluateTransfer(base({ avgRating: 8.5, tablePos: 1 }), createRng(999));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });
});

/* ── i18n ────────────────────────────────────────────────────────── */

describe('F3.2 — i18n 100% en el copy nuevo', () => {
  const sections = ['postMatch', 'transfers', 'decisionTree'] as const;

  it.each(sections)('la sección %s tiene las mismas claves en los 3 locales', (section) => {
    const esKeys = Object.keys(COPY.es[section]).sort();
    for (const locale of SUPPORTED_LOCALES as readonly Locale[]) {
      expect(Object.keys(COPY[locale][section]).sort()).toEqual(esKeys);
    }
  });

  it.each(sections)('la sección %s no tiene strings vacíos en ningún locale', (section) => {
    for (const locale of SUPPORTED_LOCALES as readonly Locale[]) {
      for (const [key, value] of Object.entries(COPY[locale][section])) {
        expect(typeof value, `${locale}.${section}.${key}`).toBe('string');
        expect((value as string).trim().length, `${locale}.${section}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('el copy de zh-CN no es un fallback en español', () => {
    for (const section of sections) {
      for (const key of Object.keys(COPY.es[section])) {
        const es = (COPY.es[section] as Record<string, string>)[key];
        const zh = (COPY['zh-CN'][section] as Record<string, string>)[key];
        expect(zh, `zh-CN.${section}.${key} quedó igual al español`).not.toBe(es);
      }
    }
  });

  it('hay una clave de copy por cada contexto de nodo del árbol', () => {
    // `tree_node_<context>` ↔ `decisionTree.node<Context>` en camelCase.
    const camel = (id: string) =>
      'node' + id.split('_').map((p) => p[0].toUpperCase() + p.slice(1)).join('');
    for (const ctx of NODE_CONTEXT_IDS) {
      expect(COPY.es.decisionTree).toHaveProperty(camel(ctx));
      expect(COPY.en.decisionTree).toHaveProperty(camel(ctx));
      expect(COPY['zh-CN'].decisionTree).toHaveProperty(camel(ctx));
    }
  });
});
