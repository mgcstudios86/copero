/**
 * F4 — Tests del módulo de eventos sociales (MGC-1738 / MGC-1762).
 *
 * Verifica la design rev 2 de MGC-1738:
 *
 * 1. Los 4 outcomes disjuntos (timba / asado / tour / quedarse) son
 *    alcanzables y se excluyen correctamente por gates.
 * 2. Misma seed + mismo snapshot → mismo evento (replay determinista).
 * 3. Clamp `injuryRiskMul ≤ 2.5` y `luckBonus ∈ [0, 0.30]`.
 * 4. Regresión: `position-tree.ts` sigue con exactamente 4 outcomes (AC
 *    de F2.2) y `decision-tree.ts` con ≥6 outcomes (AC de F3.2). El
 *    módulo nuevo **no extiende** ni uno ni otro.
 * 5. `mergeModifiers` aplica MAX / producto / suma / MIN y los clamps
 *    correctos.
 * 6. RNG snapshot v2: `runSocialEvent` acepta `RngSnapshot` y devuelve
 *    cursor avanzado (mismo patrón que `applyWeeklyChoice`).
 * 7. Sin RNG → no-op determinista con `NO_MODIFIERS`.
 * 8. `quedarse` no colisiona con `descanso` (WeeklyBaseOptionId).
 * 9. RNG consumido: el cursor avanzado es > cursor de entrada.
 */

import { describe, expect, it } from 'vitest';
import type { Position } from '@/types/career';
import {
  mergeModifiers,
  runSocialEvent,
  type SocialEventId,
  type SocialEventInput,
} from './social-events';
import { NO_MODIFIERS, type NextWeekModifiers } from './events';
import { STAT_INIT, type PositionStats } from './position-stats';
import { groupOf } from './positions';
import { KEY_STAT_BY_GROUP, SUERTE_GATE } from './events';
import {
  getPositionTree,
  WEEKLY_BASE_OPTIONS,
} from './position-tree';
import {
  decisionNodeCount,
  getDecisionTree,
  pickOutcome,
} from './decision-tree';
import {
  createRng,
  createRngSnapshot,
  type Rng,
} from './rng';

const ALL_POSITIONS: Position[] = [
  'GK',
  'CB', 'LB', 'RB',
  'CDM', 'CM', 'CAM', 'LM', 'RM',
  'ST', 'LW', 'RW',
];

const SOCIAL_IDS: readonly SocialEventId[] = [
  'timba',
  'asado',
  'tour',
  'quedarse',
];

function statsWithKey(position: Position, value: number): PositionStats {
  const key = KEY_STAT_BY_GROUP[groupOf(position)];
  return { ...STAT_INIT, [key]: value };
}

function baseInput(position: Position = 'ST'): SocialEventInput {
  return {
    position,
    positionStats: STAT_INIT,
    rating: 7.5,
    week: 10,
  };
}

/* ── 1. Outcomes disjuntos y alcanzables ─────────────────────────── */

describe('F4 — eventos sociales (MGC-1738 / MGC-1762)', () => {
  it('los 4 outcomes son alcanzables dado un pool suficientemente grande', () => {
    // Sweep 2000 seeds con rating alto + stats altos para que todos los
    // gates pasen. Garantiza que los 4 IDs aparecen al menos una vez.
    const seen = new Set<SocialEventId>();
    for (let s = 1; s <= 2000 && seen.size < SOCIAL_IDS.length; s += 1) {
      const rng = createRng(s);
      const result = runSocialEvent(
        { ...baseInput('ST'), positionStats: statsWithKey('ST', 99) },
        rng,
      );
      if (result.event) seen.add(result.event.id);
    }
    for (const id of SOCIAL_IDS) {
      expect(seen.has(id), `outcome ${id} nunca apareció en 2000 seeds`).toBe(true);
    }
  });

  it('los outcomes son disjuntos (un solo evento por invocación)', () => {
    for (let s = 1; s <= 200; s += 1) {
      const rng = createRng(s);
      const result = runSocialEvent(baseInput('CM'), rng);
      expect(result.event).not.toBeNull();
      if (result.event) {
        expect(SOCIAL_IDS).toContain(result.event.id);
      }
    }
  });

  it('gate `tour` exige rating ≥ 7.0', () => {
    // Sweep con rating 6.9 → tour nunca debe salir (sólo timba/asado/quedarse).
    const seen = new Set<SocialEventId>();
    for (let s = 1; s <= 500; s += 1) {
      const rng = createRng(s);
      const result = runSocialEvent({ ...baseInput('ST'), rating: 6.9 }, rng);
      if (result.event) seen.add(result.event.id);
    }
    expect(seen.has('tour')).toBe(false);
  });

  it('gate `timba` exige stat principal ≥ SUERTE_GATE', () => {
    // ST con stat principal (=definicion) por debajo del umbral (65).
    // timba nunca debe salir.
    const seen = new Set<SocialEventId>();
    const lowKeyStats: PositionStats = { ...STAT_INIT, definicion: 30 };
    for (let s = 1; s <= 500; s += 1) {
      const rng = createRng(s);
      const result = runSocialEvent(
        { ...baseInput('ST'), positionStats: lowKeyStats },
        rng,
      );
      if (result.event) seen.add(result.event.id);
    }
    expect(seen.has('timba')).toBe(false);
  });

  it('gate `timba` deja pasar cuando stat principal supera SUERTE_GATE', () => {
    const seen = new Set<SocialEventId>();
    const highKeyStats: PositionStats = { ...STAT_INIT, definicion: 90 };
    for (let s = 1; s <= 500 && !seen.has('timba'); s += 1) {
      const rng = createRng(s);
      const result = runSocialEvent(
        { ...baseInput('ST'), positionStats: highKeyStats },
        rng,
      );
      if (result.event) seen.add(result.event.id);
    }
    expect(seen.has('timba')).toBe(true);
  });
});

/* ── 2. Replay determinista ─────────────────────────────────────── */

describe('F4 — replay determinista', () => {
  it('misma seed produce mismo evento (sin snapshot)', () => {
    const a = runSocialEvent(baseInput('ST'), createRng(42));
    const b = runSocialEvent(baseInput('ST'), createRng(42));
    expect(a.event?.id).toBe(b.event?.id);
    expect(a.modifiers).toEqual(b.modifiers);
  });

  it('mismo snapshot produce mismo evento (RNG snapshot v2)', () => {
    const snap = createRngSnapshot(12345);
    const a = runSocialEvent(baseInput('CM'), snap);
    const b = runSocialEvent(baseInput('CM'), snap);
    expect(a.event?.id).toBe(b.event?.id);
    expect(a.rngSnapshot).toEqual(b.rngSnapshot);
    expect(a.modifiers).toEqual(b.modifiers);
  });

  it('replay post force-stop: restaurar snapshot y repetir da igual resultado', () => {
    const snap = createRngSnapshot(7777);
    const first = runSocialEvent(baseInput('CB'), snap);
    // Force-stop: descartamos first.event pero conservamos el snapshot
    // avanzado como si fuera lo último persistido.
    const replay = runSocialEvent(baseInput('CB'), first.rngSnapshot);
    // Tras avanzar el cursor, el siguiente evento difiere (el stream
    // consumió draws del primero).
    expect(replay.rngSnapshot.cursor).toBeGreaterThan(first.rngSnapshot.cursor);
    // Pero la **secuencia** es determinista: misma seed + mismo punto
    // de partida → mismo evento. Repetimos desde el mismo snap inicial
    // y consumimos la misma cantidad.
    const replay2 = runSocialEvent(baseInput('CB'), snap);
    expect(replay2.event?.id).toBe(first.event?.id);
  });
});

/* ── 3. Clamps ──────────────────────────────────────────────────── */

describe('F4 — clamps de modificadores', () => {
  it('injuryRiskMul ≤ 2.5 aún en el caso peor (timba repetido)', () => {
    let maxMul = 0;
    for (let s = 1; s <= 1000; s += 1) {
      const rng = createRng(s);
      const result = runSocialEvent(
        { ...baseInput('ST'), positionStats: statsWithKey('ST', 99) },
        rng,
      );
      maxMul = Math.max(maxMul, result.modifiers.injuryRiskMul);
    }
    expect(maxMul).toBeLessThanOrEqual(2.5);
  });

  it('luckBonus ≤ 0.30 (cota superior del tour)', () => {
    let maxLuck = 0;
    for (let s = 1; s <= 1000; s += 1) {
      const rng = createRng(s);
      const result = runSocialEvent(
        { ...baseInput('ST'), positionStats: statsWithKey('ST', 99) },
        rng,
      );
      maxLuck = Math.max(maxLuck, result.modifiers.luckBonus);
    }
    expect(maxLuck).toBeLessThanOrEqual(0.30);
  });

  it('luckBonus = 0 cuando no se pasa el gate de suerte', () => {
    const lowKeyStats: PositionStats = { ...STAT_INIT, definicion: 30 };
    for (let s = 1; s <= 200; s += 1) {
      const rng = createRng(s);
      const result = runSocialEvent(
        { ...baseInput('ST'), positionStats: lowKeyStats },
        rng,
      );
      // Sin gate: luckBonus siempre 0 aunque el evento sorteado sea
      // tour (que podría haber amplificado).
      expect(result.modifiers.luckBonus).toBe(0);
    }
  });

  it('mergeModifiers clampea injuryRiskMul ≤ 2.5 post-producto', () => {
    const a: NextWeekModifiers = {
      ...NO_MODIFIERS,
      injuryRiskMul: 2.0,
    };
    const b: NextWeekModifiers = {
      ...NO_MODIFIERS,
      injuryRiskMul: 2.0,
    };
    const merged = mergeModifiers(a, b);
    expect(merged.injuryRiskMul).toBeLessThanOrEqual(2.5);
    expect(merged.injuryRiskMul).toBeGreaterThanOrEqual(1.0);
  });
});

/* ── 4. Regresión: position-tree 4-outcomes / decision-tree ≥6 ─── */

describe('F4 — regresión sobre árboles existentes', () => {
  it('position-tree sigue con 4 outcomes exactos (AC F2.2 intacto)', () => {
    for (const pos of ALL_POSITIONS) {
      const tree = getPositionTree(pos);
      expect(tree.root.outcomes).toHaveLength(4);
      const sum = tree.root.outcomes.reduce((s, o) => s + o.prob, 0);
      expect(Math.abs(sum - 1.0)).toBeLessThan(1e-9);
    }
  });

  it('decision-tree sigue con ≥6 outcomes y ≥20 nodos por posición (AC F3.2 intacto)', () => {
    for (const pos of ALL_POSITIONS) {
      const tree = getDecisionTree(pos);
      expect(decisionNodeCount(tree)).toBeGreaterThanOrEqual(20);
      for (const node of Object.values(tree.nodes)) {
        expect(node.outcomes.length).toBeGreaterThanOrEqual(6);
        const sum = node.outcomes.reduce((s, o) => s + o.weight, 0);
        expect(Math.abs(sum - 1.0)).toBeLessThan(1e-9);
      }
    }
  });

  it('decision-tree.pickOutcome sigue consumiendo 1 draw (replay determinista)', () => {
    const tree = getDecisionTree('ST');
    const root = tree.nodes[tree.rootId];
    const a = pickOutcome(createRng(99), root);
    const b = pickOutcome(createRng(99), root);
    expect(a.id).toBe(b.id);
  });
});

/* ── 5. mergeModifiers composición ──────────────────────────────── */

describe('F4 — mergeModifiers', () => {
  it('luckBonus = MAX(a, b)', () => {
    const merged = mergeModifiers(
      { ...NO_MODIFIERS, luckBonus: 0.05 },
      { ...NO_MODIFIERS, luckBonus: 0.20 },
    );
    expect(merged.luckBonus).toBe(0.20);
  });

  it('injuryRiskMul = producto (clamp ≤ 2.5)', () => {
    const merged = mergeModifiers(
      { ...NO_MODIFIERS, injuryRiskMul: 2.0 },
      { ...NO_MODIFIERS, injuryRiskMul: 2.0 },
    );
    expect(merged.injuryRiskMul).toBeCloseTo(2.5, 5);
  });

  it('fatigue / moral / confianza = suma', () => {
    const merged = mergeModifiers(
      {
        ...NO_MODIFIERS,
        moralDelta: 4,
        fatigueDelta: -6,
        confianzaDelta: 2,
      },
      {
        ...NO_MODIFIERS,
        moralDelta: 6,
        fatigueDelta: -12,
        confianzaDelta: -3,
      },
    );
    expect(merged.moralDelta).toBe(10);
    expect(merged.fatigueDelta).toBe(-18);
    expect(merged.confianzaDelta).toBe(-1);
  });

  it('trainingBoost = MIN(a, b)', () => {
    const merged = mergeModifiers(
      { ...NO_MODIFIERS, trainingBoost: 1.0 },
      { ...NO_MODIFIERS, trainingBoost: 0.85 },
    );
    expect(merged.trainingBoost).toBe(0.85);
  });

  it('mergeModifiers(NO_MODIFIERS, x) === x para todos los campos', () => {
    const x: NextWeekModifiers = {
      luckBonus: 0.12,
      trainingBoost: 0.9,
      injuryRiskMul: 1.6,
      moralDelta: 4,
      fatigueDelta: -10,
      confianzaDelta: 1,
    };
    expect(mergeModifiers(NO_MODIFIERS, x)).toEqual(x);
    expect(mergeModifiers(x, NO_MODIFIERS)).toEqual(x);
  });
});

/* ── 6. RNG snapshot v2 ────────────────────────────────────────── */

describe('F4 — RNG snapshot v2 wiring', () => {
  it('acepta RngSnapshot y devuelve cursor avanzado', () => {
    const start = createRngSnapshot(12345);
    const result = runSocialEvent(baseInput('ST'), start);
    expect(result.rngSnapshot.cursor).toBeGreaterThan(start.cursor);
    expect(result.rngSnapshot.seed).toBe(start.seed);
    expect(result.rngSnapshot.algorithm).toBe('mulberry32');
  });

  it('acepta Rng directamente y devuelve snapshot del cursor', () => {
    const rng: Rng = createRng(99);
    const before = rng.snapshot();
    const result = runSocialEvent(baseInput('ST'), rng);
    expect(result.rngSnapshot.cursor).toBeGreaterThan(before.cursor);
  });

  it('dos invocaciones consecutivas desde el mismo snapshot avanzan distinto', () => {
    const start = createRngSnapshot(2024);
    const a = runSocialEvent(baseInput('CM'), start);
    const b = runSocialEvent(baseInput('CM'), a.rngSnapshot);
    expect(b.rngSnapshot.cursor).toBeGreaterThan(a.rngSnapshot.cursor);
  });
});

/* ── 7. Sin RNG → no-op ─────────────────────────────────────────── */

describe('F4 — fallback sin RNG', () => {
  it('devuelve null event + NO_MODIFIERS si no se pasa RNG', () => {
    const result = runSocialEvent(baseInput('ST'), undefined);
    expect(result.event).toBeNull();
    expect(result.modifiers).toEqual(NO_MODIFIERS);
  });

  it('devuelve snapshot v1 cursor=0 (no avanza)', () => {
    const result = runSocialEvent(baseInput('ST'), undefined);
    expect(result.rngSnapshot.cursor).toBe(0);
    expect(result.rngSnapshot.algorithm).toBe('mulberry32');
  });
});

/* ── 8. No-colisión quedarse vs descanso ────────────────────────── */

describe('F4 — no-colisión con WeeklyBaseOptionId (design rev 2 §C1)', () => {
  it('`quedarse` (SocialEventId) no aparece como WeeklyBaseOptionId', () => {
    const ids = Object.keys(WEEKLY_BASE_OPTIONS);
    expect(ids).not.toContain('quedarse');
    // El colisionador histórico era `descanso`, que sí existe como
    // WeeklyBaseOptionId. Confirmamos que sigue ahí (regresión AC).
    expect(ids).toContain('descanso');
  });

  it('SUERTE_GATE expone los 4 grupos (sin cambios colaterales)', () => {
    expect(SUERTE_GATE.goalkeeper).toBe(70);
    expect(SUERTE_GATE.defense).toBe(68);
    expect(SUERTE_GATE.midfield).toBe(66);
    expect(SUERTE_GATE.attack).toBe(65);
  });
});
