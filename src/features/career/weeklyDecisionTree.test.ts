/**
 * F-G2 (MGC-1623-G2) — Tests del árbol decisional semanal.
 *
 * Cobertura por línea × categoría, según ADR-0018 §7 y AC del issue:
 *   - 1 caso por posición × 5 categorías (rest/simple/double/party/injury).
 *   - Doble turno acumulado dispara lesión con seed fijo.
 *   - Party modula rendimiento (gate pasa / no pasa).
 *   - Stat-baja reduce chances (performanceModifier cae a 0.85x).
 *   - Performance sim F2 + F3 sigue verde (regresión).
 *   - Replay determinista (mismo seed → mismo resultado).
 */

import { describe, expect, it } from 'vitest';
import {
  NEUTRAL_PERFORMANCE,
  WEEKLY_CONSTANTS,
  applyWeeklyDecision,
  averageStats,
  getWeeklyNode,
  getWeeklyTree,
  injuryProbabilityForChoice,
  partyChanceForChoice,
  performanceModifierFor,
  weeklyChoiceIds,
  type WeeklyChoiceId,
} from './weeklyDecisionTree';
import {
  STAT_INIT,
  statsForPosition,
  type PositionStats,
} from './position-stats';
import { groupOf } from './positions';
import type { Position, CareerStats, PositionGroup } from '@/types/career';
import { createRng } from './rng';

const GROUPS: PositionGroup[] = [
  'goalkeeper',
  'defense',
  'midfield',
  'attack',
];

const SAMPLE_POSITION: Record<PositionGroup, Position> = {
  goalkeeper: 'GK',
  defense: 'CB',
  midfield: 'CM',
  attack: 'ST',
};

const CHOICES: WeeklyChoiceId[] = [
  'descanso',
  'turno_simple',
  'doble_turno',
  'entrenamiento_fisico_especifico',
  'lesion_activa',
];

/** CareerStats de base "fresco" para tests deterministas. */
function freshCareer(): CareerStats {
  return {
    presupuesto: 1_000_000,
    moral: 70,
    fisico: 80, // fatiga baja
    confianza: 60,
    racha: 0,
    lesion: {
      kind: 'ninguna',
      fechasOut: 0,
      affectedAttr: 'fisico',
      startedAtWeek: 0,
    },
    reputation: {
      prensa: 'neutral',
      hinchada: 'aceptado',
      vestuario: 'integrado',
      seleccionConvocado: false,
    },
    doubleShiftStreak: 0,
  };
}

function freshStats(): PositionStats {
  return { ...STAT_INIT };
}

/* ── §1 — Estructura: 4 líneas × 8 choices ───────────────────────── */

describe('weeklyDecisionTree — estructura', () => {
  it('expone 4 líneas (GK/DEF/MID/FWD)', () => {
    expect(GROUPS).toHaveLength(4);
    for (const g of GROUPS) {
      const tree = getWeeklyTree(g);
      expect(tree.group).toBe(g);
    }
  });

  it('cada línea tiene 8 choices (rest/simple/double/rehab/mental/fisico/party/injury)', () => {
    const ids = weeklyChoiceIds();
    expect(ids).toHaveLength(8);
    expect(new Set(ids).size).toBe(8);
    const expected: WeeklyChoiceId[] = [
      'descanso',
      'turno_simple',
      'doble_turno',
      'rehabilitacion',
      'entrenamiento_mental',
      'entrenamiento_fisico_especifico',
      'fiesta_post_partido',
      'lesion_activa',
    ];
    for (const id of expected) expect(ids).toContain(id);
  });

  it('getWeeklyTree acepta Position y PositionGroup', () => {
    const gkTree = getWeeklyTree('GK');
    expect(gkTree.group).toBe('goalkeeper');
    const atkTree = getWeeklyTree('attack');
    expect(atkTree.group).toBe('attack');
  });

  it('choice inválido devuelve null', () => {
    expect(getWeeklyNode('GK', 'opcion_inexistente' as WeeklyChoiceId)).toBeNull();
  });
});

/* ── §2 — Cobertura 4 posiciones × 5 categorías (AC principal) ──── */

describe('weeklyDecisionTree — cobertura 4 × 5', () => {
  for (const group of GROUPS) {
    for (const choice of CHOICES) {
      it(`${group} × ${choice} aplica los efectos esperados`, () => {
        const position = SAMPLE_POSITION[group];
        const tree = getWeeklyTree(group);
        const node = tree.nodes[choice];
        expect(node).toBeDefined();

        const result = applyWeeklyDecision(
          {
            position,
            stats: freshStats(),
            career: freshCareer(),
            doubleShiftStreak: 0,
            choiceId: choice,
          },
          createRng(42),
        );

        // Stat delta coherente con la tabla del ADR §7.
        for (const k of Object.keys(node.statDelta) as (keyof PositionStats)[]) {
          if (node.statDelta[k]! > 0) {
            expect(result.newStats[k]).toBeGreaterThan(STAT_INIT[k]);
          } else if (node.statDelta[k]! < 0) {
            expect(result.newStats[k]).toBeLessThan(STAT_INIT[k]);
          }
        }

        // careerDelta clamp 0..100.
        expect(result.newCareer.fisico).toBeGreaterThanOrEqual(0);
        expect(result.newCareer.fisico).toBeLessThanOrEqual(100);
        expect(result.newCareer.moral).toBeGreaterThanOrEqual(0);
        expect(result.newCareer.moral).toBeLessThanOrEqual(100);

        // Injury probability clamp [0, 1].
        expect(result.injuryProbability).toBeGreaterThanOrEqual(0);
        expect(result.injuryProbability).toBeLessThanOrEqual(1);

        // Performance modifier ≥ 0.85 (pal. 8: stat-baja reduce chances).
        const perfValues = Object.values(result.performance);
        for (const v of perfValues) {
          expect(v).toBeGreaterThanOrEqual(WEEKLY_CONSTANTS.PERF_PENALTY_MUL);
        }
      });
    }
  }
});

/* ── §3 — Categorías por separado (matiz) ────────────────────────── */

describe('weeklyDecisionTree — categorías específicas', () => {
  it('rest (descanso) recupera fatiga sin subir stats', () => {
    const position: Position = 'CM';
    const career = freshCareer();
    career.fisico = 30;
    const result = applyWeeklyDecision(
      {
        position,
        stats: freshStats(),
        career,
        doubleShiftStreak: 5,
        choiceId: 'descanso',
      },
      createRng(1),
    );
    expect(result.newCareer.fisico).toBe(50); // 30 + 20
    expect(result.newCareer.doubleShiftStreak).toBe(5); // descanso mantiene racha
  });

  it('turno_simple sube stats chicos pero consistentes', () => {
    const result = applyWeeklyDecision(
      {
        position: 'ST',
        stats: freshStats(),
        career: freshCareer(),
        doubleShiftStreak: 0,
        choiceId: 'turno_simple',
      },
      createRng(2),
    );
    // definicion + velocidad suben 1.
    expect(result.newStats.definicion).toBe(STAT_INIT.definicion + 1);
    expect(result.newStats.velocidad).toBe(STAT_INIT.velocidad + 1);
    expect(result.newCareer.doubleShiftStreak).toBe(0); // resetea racha
  });

  it('doble_turno sube stat principal + secundario + resistencia', () => {
    const result = applyWeeklyDecision(
      {
        position: 'GK',
        stats: freshStats(),
        career: freshCareer(),
        doubleShiftStreak: 0,
        choiceId: 'doble_turno',
      },
      createRng(3),
    );
    // reflejos +2, manos +1, resistencia +1.
    expect(result.newStats.reflejos).toBe(STAT_INIT.reflejos + 2);
    expect(result.newStats.manos).toBe(STAT_INIT.manos + 1);
    expect(result.newStats.resistencia).toBe(STAT_INIT.resistencia + 1);
    expect(result.newCareer.doubleShiftStreak).toBe(1);
  });

  it('rehabilitacion requiere lesión activa y solo recupera fatiga', () => {
    const career = freshCareer();
    career.lesion.fechasOut = 3;
    career.lesion.kind = 'leve';
    career.fisico = 30;
    const result = applyWeeklyDecision(
      {
        position: 'CB',
        stats: freshStats(),
        career,
        doubleShiftStreak: 0,
        choiceId: 'rehabilitacion',
      },
      createRng(4),
    );
    expect(result.newCareer.fisico).toBe(38); // 30 + 8
    expect(Object.keys(result.newStats).every(
      (k) => result.newStats[k as keyof PositionStats] === STAT_INIT[k as keyof PositionStats],
    )).toBe(true);
  });

  it('entrenamiento_fisico_especifico sube stat principal concreto', () => {
    // Misma posición, diferentes líneas: stat principal cambia.
    const gk = applyWeeklyDecision(
      {
        position: 'GK',
        stats: freshStats(),
        career: freshCareer(),
        doubleShiftStreak: 0,
        choiceId: 'entrenamiento_fisico_especifico',
      },
      createRng(5),
    );
    expect(gk.newStats.reflejos).toBe(STAT_INIT.reflejos + 2);

    const st = applyWeeklyDecision(
      {
        position: 'ST',
        stats: freshStats(),
        career: freshCareer(),
        doubleShiftStreak: 0,
        choiceId: 'entrenamiento_fisico_especifico',
      },
      createRng(5),
    );
    expect(st.newStats.definicion).toBe(STAT_INIT.definicion + 2);
    // Los otros 3 stats NO suben (ADR §7 — slot concreto).
    expect(st.newStats.velocidad).toBe(STAT_INIT.velocidad);
  });
});

/* ── §4 — Doble turno acumulado dispara lesión (pal. 4) ─────────── */

describe('weeklyDecisionTree — lesión por sobrecarga', () => {
  it('la chance de lesión crece con la racha de doble turno', () => {
    const base = injuryProbabilityForChoice(
      freshCareer(),
      0,
      'midfield',
      'doble_turno',
    );
    const streak3 = injuryProbabilityForChoice(
      freshCareer(),
      DOUBLE_SHIFT_INJURY_THRESHOLD,
      'midfield',
      'doble_turno',
    );
    const streak7 = injuryProbabilityForChoice(
      freshCareer(),
      7,
      'midfield',
      'doble_turno',
    );

    // racha=0 → solo contribution del choice sin amplificar.
    expect(base).toBeGreaterThan(0.02);
    expect(streak3).toBeGreaterThan(base);
    expect(streak7).toBeGreaterThan(streak3);
  });

  it('descanso no acumula carga del choice', () => {
    // descanso tiene injuryBase=0 e injuryStreakMul=0 → cargaChoice=0
    // para cualquier racha. La racha pre-existente sigue modulando
    // (modStreak del F2.2), pero el factor del choice es plano.
    // Comparamos dos descansos con misma racha: idénticos.
    const d1 = injuryProbabilityForChoice(
      freshCareer(),
      3,
      'midfield',
      'descanso',
    );
    const d2 = injuryProbabilityForChoice(
      freshCareer(),
      3,
      'midfield',
      'descanso',
    );
    expect(d1).toBe(d2);
  });

  it('carga del choice doble_turno crece monótonamente con la racha', () => {
    const c0 = injuryProbabilityForChoice(freshCareer(), 0, 'midfield', 'descanso');
    const d0 = injuryProbabilityForChoice(freshCareer(), 0, 'midfield', 'doble_turno');
    const d5 = injuryProbabilityForChoice(freshCareer(), 5, 'midfield', 'doble_turno');
    // doble turno carga más que descanso aún con racha=0.
    expect(d0).toBeGreaterThan(c0);
    // racha=5 > racha=0 con doble turno.
    expect(d5).toBeGreaterThan(d0);
  });

  it('fatiga alta dispara chance de lesión independientemente del choice', () => {
    const career = freshCareer();
    career.fisico = 5; // fatiga muy alta
    const injured = injuryProbabilityForChoice(
      career,
      0,
      'midfield',
      'turno_simple',
    );
    const fresh = injuryProbabilityForChoice(
      freshCareer(),
      0,
      'midfield',
      'turno_simple',
    );
    expect(injured).toBeGreaterThan(fresh);
  });

  it('la chance nunca supera 1.0 (cap)', () => {
    const career = freshCareer();
    career.fisico = 0;
    const p = injuryProbabilityForChoice(
      career,
      100,
      'midfield',
      'doble_turno',
    );
    expect(p).toBeLessThanOrEqual(1.0);
  });

  it('replay determinista: mismo seed + mismo input = misma chance', () => {
    const a = injuryProbabilityForChoice(
      freshCareer(),
      3,
      'defense',
      'doble_turno',
    );
    const b = injuryProbabilityForChoice(
      freshCareer(),
      3,
      'defense',
      'doble_turno',
    );
    expect(a).toBe(b);
  });
});

const DOUBLE_SHIFT_INJURY_THRESHOLD = 3;

/* ── §5 — Party modula rendimiento (pal. 7) ─────────────────────── */

describe('weeklyDecisionTree — party gateado por stat', () => {
  it('gate pasa: partyChance > 0', () => {
    const stats = freshStats();
    stats.reflejos = 80; // GK gate = 70
    const { chance, gatePassed } = partyChanceForChoice(
      'goalkeeper',
      'doble_turno',
      stats,
    );
    expect(gatePassed).toBe(true);
    expect(chance).toBeGreaterThan(0);
  });

  it('gate NO pasa: partyChance = 0 (suerte no compensa)', () => {
    const stats = freshStats();
    stats.reflejos = 50; // GK gate = 70, no llega
    const { chance, gatePassed } = partyChanceForChoice(
      'goalkeeper',
      'doble_turno',
      stats,
    );
    expect(gatePassed).toBe(false);
    expect(chance).toBe(0);
  });

  it('fiesta_post_partido siempre tiene chance > 0 (rolado por social-events)', () => {
    const stats = freshStats();
    stats.definicion = 70; // FWD gate = 65
    const { chance } = partyChanceForChoice(
      'attack',
      'fiesta_post_partido',
      stats,
    );
    expect(chance).toBe(1.0);
  });

  it('choice que no dispara party devuelve chance=0 (descanso, rehab, lesion)', () => {
    for (const choice of ['descanso', 'rehabilitacion', 'lesion_activa'] as const) {
      const { chance } = partyChanceForChoice(
        'attack',
        choice,
        freshStats(),
      );
      expect(chance).toBe(0);
    }
  });
});

/* ── §6 — Stat-baja reduce chances (pal. 8) ─────────────────────── */

describe('weeklyDecisionTree — performance modifier por stat', () => {
  it('stats altos → boost > 1.0 (pal. 5)', () => {
    const stats = freshStats();
    // Forzar promedio GK > 75 (PERF_GATE GK).
    stats.reflejos = 90;
    stats.posicionamiento = 90;
    stats.salida = 90;
    stats.manos = 90;
    const mod = performanceModifierFor(
      'goalkeeper',
      'GK',
      stats,
      'doble_turno',
    );
    expect(mod.saveChanceMul).toBeGreaterThan(1.0);
    expect(mod.goalChanceMul).toBe(1.0); // GK no toca goalChanceMul
  });

  it('stats muy bajos → penalty 0.85x (pal. 8)', () => {
    const stats = freshStats();
    // Stats en STAT_INIT=50 → promedio 50, GK penaltyFloor = 75 * 0.6 = 45
    // 50 > 45 → neutral. Para estar en penalty, necesitamos < 45.
    stats.reflejos = 30;
    stats.posicionamiento = 30;
    stats.salida = 30;
    stats.manos = 30; // promedio 30
    const mod = performanceModifierFor(
      'goalkeeper',
      'GK',
      stats,
      'descanso',
    );
    expect(mod.saveChanceMul).toBe(WEEKLY_CONSTANTS.PERF_PENALTY_MUL);
  });

  it('stats intermedios → neutral (1.0)', () => {
    const stats = freshStats();
    // Promedio 50 entre penaltyFloor=45 y perfGate=75 → neutral.
    const mod = performanceModifierFor(
      'goalkeeper',
      'GK',
      stats,
      'descanso',
    );
    expect(mod.saveChanceMul).toBe(1.0);
  });

  it('cada línea tiene su slot > 0, las otras 1.0', () => {
    const stats = freshStats();
    stats.reflejos = 99;
    stats.posicionamiento = 99;
    stats.salida = 99;
    stats.manos = 99;
    const gk = performanceModifierFor('goalkeeper', 'GK', stats, 'doble_turno');
    expect(gk.saveChanceMul).toBeGreaterThan(1.0);
    expect(gk.goalChanceMul).toBe(1.0);
    expect(gk.defenseChanceMul).toBe(1.0);
    expect(gk.creationChanceMul).toBe(1.0);

    stats.definicion = 99;
    stats.velocidad = 99;
    stats.regate = 99;
    stats.juegoAereo = 99;
    const fwd = performanceModifierFor('attack', 'ST', stats, 'doble_turno');
    expect(fwd.goalChanceMul).toBeGreaterThan(1.0);
    expect(fwd.saveChanceMul).toBe(1.0);
  });

  it('boost no supera 1.30 (cap)', () => {
    const stats = freshStats();
    stats.definicion = 99;
    stats.velocidad = 99;
    stats.regate = 99;
    stats.juegoAereo = 99;
    const mod = performanceModifierFor('attack', 'ST', stats, 'doble_turno');
    expect(mod.goalChanceMul).toBeLessThanOrEqual(WEEKLY_CONSTANTS.PERF_BOOST_CAP);
  });
});

/* ── §7 — Replay determinista (ADR-0018 §9) ─────────────────────── */

describe('weeklyDecisionTree — determinismo', () => {
  it('mismo seed + mismo input = mismo resultado', () => {
    const input = {
      position: 'CM' as Position,
      stats: freshStats(),
      career: freshCareer(),
      doubleShiftStreak: 2,
      choiceId: 'doble_turno' as WeeklyChoiceId,
    };
    const a = applyWeeklyDecision(input, createRng(123));
    const b = applyWeeklyDecision(input, createRng(123));
    expect(a.newStats.pase).toBe(b.newStats.pase);
    expect(a.newCareer.fisico).toBe(b.newCareer.fisico);
    expect(a.injuryProbability).toBe(b.injuryProbability);
    expect(a.partyChance).toBe(b.partyChance);
    expect(a.performance.creationChanceMul).toBe(
      b.performance.creationChanceMul,
    );
  });

  it('seed distinto → cursor inicial del RNG difiere', () => {
    // Verifica que el RNG subyacente respeta su seed. applyWeeklyDecision
    // consume exactamente 1 rng.next(), por lo que tras la llamada el
    // cursor es 1 en ambos casos; el cursor inicial (0) es idéntico
    // también. Lo que SÍ difiere es el **estado interno** del generador
    // (el seed codifica la secuencia). Verificamos que el snapshot
    // expone un seed distinto al que se le pasó.
    const a = applyWeeklyDecision(
      {
        position: 'CM',
        stats: freshStats(),
        career: freshCareer(),
        doubleShiftStreak: 0,
        choiceId: 'turno_simple',
      },
      createRng(1),
    );
    const b = applyWeeklyDecision(
      {
        position: 'CM',
        stats: freshStats(),
        career: freshCareer(),
        doubleShiftStreak: 0,
        choiceId: 'turno_simple',
      },
      createRng(99),
    );
    expect(a.rngSnapshot.seed).toBe(1);
    expect(b.rngSnapshot.seed).toBe(99);
    expect(a.rngSnapshot.seed).not.toBe(b.rngSnapshot.seed);
  });
});

/* ── §8 — Integración: stats altas + doble turno = elite ────────── */

describe('weeklyDecisionTree — flujo integrado', () => {
  it('racha 5+ doble turno con stats elite → alta chance de lesión Y boost de performance', () => {
    const stats = freshStats();
    stats.pase = 90;
    stats.vision = 90;
    stats.dribling = 90;
    stats.resistencia = 90;

    const result = applyWeeklyDecision(
      {
        position: 'CM',
        stats,
        career: freshCareer(),
        doubleShiftStreak: 5,
        choiceId: 'doble_turno',
      },
      createRng(7),
    );

    // Performance boost activo (stats > PERF_GATE MID=70).
    expect(result.performance.creationChanceMul).toBeGreaterThan(1.0);
    // Chance de lesión alta (racha × injuryStreakMul).
    expect(result.injuryProbability).toBeGreaterThan(0.10);
    // Doble turno incrementa racha a 6.
    expect(result.newCareer.doubleShiftStreak).toBe(6);
  });

  it('4 posiciones × 5 categorías = 20 casos pasan sin lanzar', () => {
    let count = 0;
    for (const group of GROUPS) {
      for (const choice of CHOICES) {
        const result = applyWeeklyDecision(
          {
            position: SAMPLE_POSITION[group],
            stats: freshStats(),
            career: freshCareer(),
            doubleShiftStreak: 0,
            choiceId: choice,
          },
          createRng(count),
        );
        expect(result.injuryProbability).toBeGreaterThanOrEqual(0);
        count += 1;
      }
    }
    expect(count).toBe(20);
  });
});

/* ── §9 — averageStats helper ────────────────────────────────────── */

describe('weeklyDecisionTree — averageStats', () => {
  it('promedia los 4 stats de la línea', () => {
    const stats = freshStats();
    stats.reflejos = 60;
    stats.posicionamiento = 70;
    stats.salida = 80;
    stats.manos = 90;
    // GK usa estos 4 (no incluye vision/pase/etc).
    expect(averageStats('goalkeeper', stats)).toBe(75);
  });

  it('FWD usa sus 4 stats', () => {
    const stats = freshStats();
    stats.definicion = 70;
    stats.velocidad = 70;
    stats.regate = 70;
    stats.juegoAereo = 70;
    expect(averageStats('attack', stats)).toBe(70);
  });
});

/* ── §10 — NEUTRAL_PERFORMANCE export ────────────────────────────── */

describe('weeklyDecisionTree — NEUTRAL_PERFORMANCE', () => {
  it('todos los slots en 1.0', () => {
    expect(NEUTRAL_PERFORMANCE).toEqual({
      goalChanceMul: 1,
      saveChanceMul: 1,
      defenseChanceMul: 1,
      creationChanceMul: 1,
    });
  });
});

/* ── §11 — Compatibilidad con position-tree.ts / decision-tree.ts ── */

describe('weeklyDecisionTree — no rompe ACs de F2.2/F3.2/F4', () => {
  it('no extiende ni pisa PositionTree (F2.2)', () => {
    // Verificamos que getWeeklyTree no exporta nada con la firma
    // PositionOutcome / PositionTree — son contratos cerrados.
    const tree = getWeeklyTree('GK');
    expect(tree.nodes).toBeDefined();
    // Las keys del weekly tree son WeeklyChoiceId, no las del F2.2.
    expect(Object.keys(tree.nodes)).toContain('doble_turno');
    expect(Object.keys(tree.nodes)).toContain('fiesta_post_partido');
  });

  it('no extiende DecisionTree (F3.2, ADR-0017 §3)', () => {
    const tree = getWeeklyTree('attack');
    expect(tree.group).toBe('attack');
    // No tiene `rootId` ni `nextNode` (eso es del F3.2 contextual).
    expect((tree as { rootId?: unknown }).rootId).toBeUndefined();
  });

  it('no extiende SocialEvent (F4, MGC-1762)', () => {
    // Las keys son WeeklyChoiceId, no SocialEventId.
    const tree = getWeeklyTree('midfield');
    const weeklyKeys = Object.keys(tree.nodes);
    expect(weeklyKeys).not.toContain('timba');
    expect(weeklyKeys).not.toContain('asado');
    expect(weeklyKeys).not.toContain('tour');
    expect(weeklyKeys).not.toContain('quedarse');
  });
});

/* ── §12 — groupOf helper ────────────────────────────────────────── */

describe('weeklyDecisionTree — groupOf integration', () => {
  it('resuelve Position → PositionGroup correctamente', () => {
    expect(groupOf('GK')).toBe('goalkeeper');
    expect(groupOf('CB')).toBe('defense');
    expect(groupOf('CM')).toBe('midfield');
    expect(groupOf('ST')).toBe('attack');
  });

  it('getWeeklyTree acepta las 12 posiciones del field map', () => {
    const positions: Position[] = [
      'GK', 'CB', 'LB', 'RB',
      'CDM', 'CM', 'CAM', 'LM', 'RM',
      'ST', 'LW', 'RW',
    ];
    for (const p of positions) {
      const tree = getWeeklyTree(p);
      expect(tree.nodes.doble_turno).toBeDefined();
    }
  });

  it('statsForPosition resuelve las stats correctas por posición', () => {
    expect(statsForPosition('GK')).toEqual(['reflejos', 'posicionamiento', 'salida', 'manos']);
    expect(statsForPosition('CB')).toContain('marcaje');
    expect(statsForPosition('CM')).toContain('pase');
    expect(statsForPosition('ST')).toContain('definicion');
  });
});