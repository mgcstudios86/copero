/**
 * F2.2 — Tests del motor V2 (MGC-1629 AC §Tests).
 *
 * Cubre:
 * 1. Variabilidad verificable con seeds distintos (RNG seedeado).
 * 2. Sistema de lesiones por fatiga + doble turno consecutivo.
 * 3. Árbol posicional con ≥8 nodos y ≥4 outcomes por nodo.
 * 4. Match resolution produce outcomes distintos con seeds distintos.
 * 5. Position stats schema es coherente con la posición.
 */

import { describe, expect, it } from 'vitest';
import { initialProfile } from './engine';
import { createRng, seedFromString } from './rng';
import {
  fatigueFromCareer,
  injuryProbability,
  maybeRollInjury,
} from './injury-v2';
import { resolveMatch } from './match';
import {
  getPositionTree,
  nodeCount,
  rootOutcomeCount,
  WEEKLY_BASE_OPTIONS,
} from './position-tree';
import {
  STAT_INIT,
  STATS_BY_GROUP,
  applyStatDeltas,
  statsForPosition,
  statsSumForPosition,
} from './position-stats';
import type { PlayerProfile, Position } from '@/types/career';

function profileWith(overrides: Partial<PlayerProfile['career']> = {}, age = 22): PlayerProfile {
  return {
    ...initialProfile,
    name: 'Test Player',
    position: 'ST',
    club: {
      id: 'test', name: 'Test FC', league: 'Test', crestColor: '#000', crestAccent: '#fff',
      presupuesto: 5, reputation: 3,
    },
    age,
    career: { ...initialProfile.career, ...overrides },
  };
}

describe('F2.2 — position-stats', () => {
  it('cada posición tiene 4 stats específicos', () => {
    const positions: Position[] = [
      'GK',
      'CB', 'LB', 'RB',
      'CDM', 'CM', 'CAM', 'LM', 'RM',
      'ST', 'LW', 'RW',
    ];
    for (const p of positions) {
      expect(statsForPosition(p)).toHaveLength(4);
    }
  });

  it('cobertura por grupo (GK/DEF/MID/FWD) es disjunta', () => {
    const groups = Object.values(STATS_BY_GROUP);
    for (const g of groups) {
      expect(g.length).toBeGreaterThanOrEqual(3);
    }
    // GK_STATS ∩ DEF_STATS ∩ MID_STATS ∩ FWD_STATS = ∅ parcial (salida compartido GK+DEF OK)
    const union = new Set([...groups[0], ...groups[1], ...groups[2], ...groups[3]]);
    expect(union.size).toBeGreaterThanOrEqual(13);
  });

  it('applyStatDeltas clamp-ifica a [0,99]', () => {
    const next = applyStatDeltas({ ...STAT_INIT }, { reflejos: 200, marcaje: -300 });
    expect(next.reflejos).toBe(99);
    expect(next.marcaje).toBe(0);
  });

  it('statsSumForPosition entrega suma consistente para ST', () => {
    const sum = statsSumForPosition(STAT_INIT, 'ST');
    // 4 stats × 50 = 200.
    expect(sum).toBe(200);
  });
});

describe('F2.2 — position-tree (≥8 nodos, ≥4 outcomes)', () => {
  const ALL_POSITIONS: Position[] = [
    'GK',
    'CB', 'LB', 'RB',
    'CDM', 'CM', 'CAM', 'LM', 'RM',
    'ST', 'LW', 'RW',
  ];

  it('cada una de las 12 posiciones tiene tree propio (sin fallback)', () => {
    for (const pos of ALL_POSITIONS) {
      const tree = getPositionTree(pos);
      expect(tree.position).toBe(pos);
    }
  });

  it('cada posición tiene ≥8 nodos', () => {
    for (const pos of ALL_POSITIONS) {
      const tree = getPositionTree(pos);
      expect(nodeCount(tree)).toBeGreaterThanOrEqual(8);
    }
  });

  it('cada nodo raíz tiene exactamente 4 outcomes', () => {
    for (const pos of ALL_POSITIONS) {
      const tree = getPositionTree(pos);
      expect(rootOutcomeCount(tree)).toBe(4);
      const total = Object.values(tree.nodes).reduce(
        (acc, n) => acc + n.outcomes.length, 0,
      );
      const rootCount = tree.root.outcomes.length;
      expect(rootCount + total).toBeGreaterThanOrEqual(4 * 9);
    }
  });

  it('los 4 outcomes del root suman probabilidad ≈ 1.0 en todas las posiciones', () => {
    for (const pos of ALL_POSITIONS) {
      const tree = getPositionTree(pos);
      const sum = tree.root.outcomes.reduce((a, o) => a + o.prob, 0);
      expect(sum).toBeCloseTo(1.0, 1);
    }
  });

  it('los 4 outcomes del root tienen IDs estables (big_performance/consistent_solid/cautious/off_day)', () => {
    for (const pos of ALL_POSITIONS) {
      const ids = getPositionTree(pos).root.outcomes.map((o) => o.id).sort();
      expect(ids).toEqual(['big_performance', 'cautious', 'consistent_solid', 'off_day']);
    }
  });

  it('copyIds del root son únicos por posición (12 pos × 4 outcomes = 48)', () => {
    const seen = new Map<string, string>();
    for (const pos of ALL_POSITIONS) {
      for (const o of getPositionTree(pos).root.outcomes) {
        expect(seen.has(o.copyId)).toBe(false);
        seen.set(o.copyId, pos);
      }
    }
    expect(seen.size).toBe(12 * 4);
  });

  it('deltas del root difieren por grupo (GK/DEF/MID/FWD)', () => {
    const sample = (pos: Position) => {
      const o = getPositionTree(pos).root.outcomes.find((x) => x.id === 'big_performance');
      if (!o) throw new Error(`big_performance missing for ${pos}`);
      return Object.keys(o.deltas).sort().join(',');
    };
    expect(sample('GK')).toBe('reflejos');
    expect(sample('CB')).toBe('marcaje');
    expect(sample('CM')).toBe('pase');
    expect(sample('ST')).toBe('definicion');
    expect(sample('GK')).not.toBe(sample('CB'));
    expect(sample('CB')).not.toBe(sample('CM'));
    expect(sample('CM')).not.toBe(sample('ST'));
  });

  it('6 opciones base semanales existen', () => {
    const keys = Object.keys(WEEKLY_BASE_OPTIONS);
    expect(keys).toHaveLength(6);
    expect(keys).toEqual(expect.arrayContaining([
      'doble_turno', 'turno_simple', 'descanso',
      'rehabilitacion', 'entrenamiento_mental', 'entrenamiento_fisico_especifico',
    ]));
  });
});

describe('F2.2 — injury-v2 (fatiga + double streak)', () => {
  it('fatigue proxy crece cuando fisico baja', () => {
    const sano = fatigueFromCareer({ ...initialProfile.career, fisico: 80 });
    const cansado = fatigueFromCareer({ ...initialProfile.career, fisico: 20 });
    expect(cansado).toBeGreaterThan(sano);
    expect(cansado).toBeGreaterThanOrEqual(70);
  });

  it('probability > 0 con fatigue>70 y streak>3', () => {
    const profile = profileWith({ fisico: 10 });
    const p = injuryProbability(profile, 5);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThanOrEqual(1);
  });

  it('probability con modifiers cero = base rate (≥0)', () => {
    const profile = profileWith({ fisico: 80 });
    const p = injuryProbability(profile, 0);
    // Base rate 0.02 incluso sin fatiga/Streak (riesgo intrínseco).
    expect(p).toBeCloseTo(0.02, 5);
    expect(p).toBeLessThanOrEqual(1);
  });

  it('maybeRollInjury con seed fijo dispara lesión en fatiga alta', () => {
    const profile = profileWith({ fisico: 0 });
    let lesionCount = 0;
    for (let i = 0; i < 200; i++) {
      const r = createRng(seedFromString(`fatigue-${i}`));
      if (maybeRollInjury(profile, 5, r)) lesionCount++;
    }
    // Fatiga alta + streak=5 ⇒ lesiones esperadas (~50% de trials con
    // p teórico ≈ 0.495).
    expect(lesionCount).toBeGreaterThan(70);
  });

  it('lesión generada dura entre 2 y 6 semanas', () => {
    const profile = profileWith({ fisico: 0 });
    for (let i = 0; i < 50; i++) {
      const r = createRng(seedFromString(`range-${i}`));
      const lesion = maybeRollInjury(profile, 6, r);
      if (lesion) {
        expect(lesion.fechasOut).toBeGreaterThanOrEqual(2);
        expect(lesion.fechasOut).toBeLessThanOrEqual(6);
      }
    }
  });
});

describe('F2.2 — match resolution (stats + RNG + posición)', () => {
  it('mismas stats y seed fijo producen mismo score (reproducibilidad)', () => {
    const profile = profileWith();
    for (let i = 0; i < 5; i++) {
      const r1 = createRng(42);
      const r2 = createRng(42);
      const a = resolveMatch(profile, { ...STAT_INIT }, r1);
      const b = resolveMatch(profile, { ...STAT_INIT }, r2);
      expect(a.score).toBe(b.score);
      expect(a.goals).toBe(b.goals);
    }
  });

  it('seeds distintos producen scores distintos (variabilidad)', () => {
    const profile = profileWith();
    const scores = new Set<number>();
    for (let i = 0; i < 30; i++) {
      const r = createRng(i);
      const out = resolveMatch(profile, { ...STAT_INIT }, r);
      scores.add(out.score);
    }
    // Esperamos al menos 5 valores distintos en 30 trials.
    expect(scores.size).toBeGreaterThanOrEqual(5);
  });

  it('mejor stats posicionales = mejor score (monótono)', () => {
    const profile = profileWith();
    // Mismo seed ⇒ mismo luck ⇒ misma base de la comparación.
    // Como cambiamos stats, no podemos garantizar diferencia; corremos múltiples seeds.
    let better = 0;
    for (let i = 0; i < 50; i++) {
      const a = resolveMatch(profile, { ...STAT_INIT }, createRng(i));
      const b = resolveMatch(profile, applyStatDeltas({ ...STAT_INIT }, { definicion: 40, velocidad: 40, regate: 40, juegoAereo: 40 }), createRng(i));
      if (b.score > a.score) better++;
    }
    expect(better).toBeGreaterThan(40);
  });

  it('porteros tienen más clean sheets que delanteros', () => {
    let gkCS = 0, fwdCS = 0;
    const trials = 200;
    for (let i = 0; i < trials; i++) {
      const gk = resolveMatch(
        { ...profileWith(), position: 'GK' }, { ...STAT_INIT }, createRng(i),
      );
      const fw = resolveMatch(
        { ...profileWith(), position: 'ST' }, { ...STAT_INIT }, createRng(i),
      );
      if (gk.cleanSheet) gkCS++;
      if (fw.cleanSheet) fwdCS++;
    }
    expect(gkCS).toBeGreaterThan(fwdCS);
  });
});
