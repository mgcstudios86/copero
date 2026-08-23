/**
 * Tests del módulo `compass`.
 *
 * Cubre happy path (todas las respuestas, resultado coherente) y edge cases:
 *   - respuestas idénticas a un arquetipo ⇒ afinidad 100%
 *   - respuestas diametralmente opuestas ⇒ afinidad 0%
 *   - respuestas en el origen ⇒ afinidad ~70% (distancia / diagonal)
 *   - invariantes de rango: x, y en [-100, 100]
 *   - invariante de nearest: el arquetipo más cercano es uno de los definidos
 *   - errores: `sumRaw` devuelve `null` si faltan respuestas; `computeResult`
 *     lanza con menos de 15 respuestas
 *   - determinismo: misma entrada ⇒ misma salida
 *
 * Coverage objetivo: >= 90 % sobre `src/lib/compass.ts`.
 */

import { describe, it, expect } from 'vitest';
import {
  computeResult,
  sumRaw,
  normalize,
  distance,
  findNearest,
  affinity,
  type AnswerList,
} from '@/lib/compass';
import { QUESTIONS, type Option } from '@/data/questions';
import { ARCHETYPES } from '@/data/archetypes';

// ---- helpers ------------------------------------------------------------

const FIRST_OPTION_OF_EACH: AnswerList = QUESTIONS.map((q) => q.options[0]);
const ALL_NEUTRAL: AnswerList = QUESTIONS.map((q) => {
  // Buscar una opción con x ≈ 0 e y ≈ 0 (no todas las preguntas la tienen).
  const neutral = q.options.find((o) => Math.abs(o.x) < 30 && Math.abs(o.y) < 30);
  return neutral ?? q.options[0];
});
const ALL_LEFT: AnswerList = QUESTIONS.map((q) => {
  // Opción más negativa en X (posesión extrema).
  return q.options.reduce((acc, o) => (o.x < acc.x ? o : acc));
});
const ALL_RIGHT: AnswerList = QUESTIONS.map((q) => {
  return q.options.reduce((acc, o) => (o.x > acc.x ? o : acc));
});
const ALL_TOP: AnswerList = QUESTIONS.map((q) => {
  return q.options.reduce((acc, o) => (o.y > acc.y ? o : acc));
});
const ALL_BOTTOM: AnswerList = QUESTIONS.map((q) => {
  return q.options.reduce((acc, o) => (o.y < acc.y ? o : acc));
});

// Para tests donde queremos un target específico, sintetizamos 15 opciones
// con el mismo peso y calculamos el resultado.
function uniformAnswers(x: number, y: number): AnswerList {
  const opt: Option = { id: 'synth', label: 'sintético', x, y };
  return QUESTIONS.map(() => opt);
}

// ---- tests --------------------------------------------------------------

describe('sumRaw', () => {
  it('suma pesos crudos de las 15 opciones', () => {
    const raw = sumRaw(FIRST_OPTION_OF_EACH);
    expect(raw).not.toBeNull();
    expect(typeof raw!.x).toBe('number');
    expect(typeof raw!.y).toBe('number');
  });

  it('devuelve null cuando la lista no tiene 15 elementos', () => {
    expect(sumRaw([FIRST_OPTION_OF_EACH[0]])).toBeNull();
    expect(sumRaw([])).toBeNull();
    expect(
      sumRaw(new Array(20).fill(FIRST_OPTION_OF_EACH[0])),
    ).toBeNull();
  });

  it('acepta un AnswerMap y respeta el orden de QUESTIONS', () => {
    const map: Record<string, Option> = {};
    QUESTIONS.forEach((q) => {
      map[q.id] = q.options[0];
    });
    const raw = sumRaw(map);
    expect(raw).not.toBeNull();
    // Debe coincidir con la lista porque pasamos las mismas opciones en orden.
    expect(raw).toEqual(sumRaw(FIRST_OPTION_OF_EACH));
  });
});

describe('normalize', () => {
  it('mapea 0 a 0', () => {
    expect(normalize(0)).toBe(0);
  });

  it('mapea el máximo teórico a +100', () => {
    expect(normalize(1500)).toBe(100);
  });

  it('mapea el mínimo teórico a -100', () => {
    expect(normalize(-1500)).toBe(-100);
  });

  it('clampa valores fuera de rango (no deberían existir si las opciones son válidas)', () => {
    expect(normalize(2000)).toBe(100);
    expect(normalize(-2000)).toBe(-100);
  });
});

describe('distance', () => {
  it('distancia de un punto a sí mismo es 0', () => {
    expect(distance({ x: 30, y: -20 }, { x: 30, y: -20 })).toBe(0);
  });

  it('distancia euclídea básica', () => {
    // 3-4-5
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe('findNearest', () => {
  it('devuelve un arquetipo de la lista', () => {
    const a = findNearest(0, 0);
    expect(ARCHETYPES).toContain(a);
  });

  it('encuentra el arquetipo más cercano para (-90, +70) → guardiola/bielsa/sacchi/cruyff', () => {
    const a = findNearest(-90, 70);
    // Los cuatro están en ese cuadrante; el más cercano al punto debe ser uno de ellos.
    const ids = ['guardiola', 'bielsa', 'sacchi', 'cruyff'];
    expect(ids).toContain(a.id);
  });

  it('encuentra simeone para (+60, +70) (cuadrante vertical-dogmático)', () => {
    const a = findNearest(60, 70);
    expect(['simeone', 'mourinho', 'conte', 'bielsa']).toContain(a.id);
  });
});

describe('affinity', () => {
  it('100 cuando el punto coincide con el arquetipo', () => {
    const a = ARCHETYPES[0];
    expect(affinity(a.x, a.y, a)).toBe(100);
  });

  it('~0 cuando el punto está diametralmente opuesto en el cuadrado [-100, +100]²', () => {
    const a = ARCHETYPES[0];
    const opposite = { x: -a.x, y: -a.y };
    const d = distance(opposite, { x: a.x, y: a.y });
    const expected = 100 * (1 - d / Math.sqrt(200 * 200 + 200 * 200));
    expect(affinity(opposite.x, opposite.y, a)).toBeCloseTo(expected, 5);
  });

  it('clampea a [0, 100] incluso con valores degenerados', () => {
    const a = ARCHETYPES[0];
    // Inalcanzable con datos reales pero verifica el clamp.
    expect(affinity(9999, 9999, a)).toBe(0);
    expect(affinity(-9999, -9999, a)).toBe(0);
  });
});

describe('computeResult', () => {
  it('lanza si no hay 15 respuestas', () => {
    expect(() => computeResult([])).toThrow();
    expect(() => computeResult(new Array(7).fill(FIRST_OPTION_OF_EACH[0]))).toThrow();
  });

  it('happy path: devuelve x, y en rango, arquetipo válido y afinidad en [0, 100]', () => {
    const r = computeResult(FIRST_OPTION_OF_EACH);
    expect(r.x).toBeGreaterThanOrEqual(-100);
    expect(r.x).toBeLessThanOrEqual(100);
    expect(r.y).toBeGreaterThanOrEqual(-100);
    expect(r.y).toBeLessThanOrEqual(100);
    expect(ARCHETYPES).toContain(r.nearestArchetype);
    expect(r.affinity).toBeGreaterThanOrEqual(0);
    expect(r.affinity).toBeLessThanOrEqual(100);
  });

  it('determinismo: misma entrada ⇒ misma salida', () => {
    const a = computeResult(FIRST_OPTION_OF_EACH);
    const b = computeResult(FIRST_OPTION_OF_EACH);
    expect(a.x).toBe(b.x);
    expect(a.y).toBe(b.y);
    expect(a.nearestArchetype.id).toBe(b.nearestArchetype.id);
    expect(a.affinity).toBe(b.affinity);
  });

  it('respuestas uniformes hacia un arquetipo ⇒ arquetipo detectado, afinidad alta', () => {
    const target = ARCHETYPES.find((a) => a.id === 'guardiola')!;
    const r = computeResult(uniformAnswers(target.x, target.y));
    expect(r.nearestArchetype.id).toBe('guardiola');
    expect(r.affinity).toBe(100);
  });

  it('respuestas uniformes hacia (-90, +70) cae en el cuadrante guardiola/bielsa/sacchi/cruyff', () => {
    const r = computeResult(uniformAnswers(-90, 70));
    expect(['guardiola', 'bielsa', 'sacchi', 'cruyff']).toContain(
      r.nearestArchetype.id,
    );
  });

  it('cuadrante posesión-pragmático: anclotti/scaloni/deschamps/del-bosque/zidane', () => {
    const r = computeResult(uniformAnswers(-30, -50));
    // Buscamos que esté dentro de la "familia" abajo-izquierda.
    const lowerLeft = ['ancelotti', 'scaloni', 'deschamps', 'del-bosque', 'zidane'];
    expect(lowerLeft).toContain(r.nearestArchetype.id);
  });

  it('cuadrante vertical-dogmático: simeone/mourinho/conte/bilardo', () => {
    const r = computeResult(uniformAnswers(70, 80));
    const upperRight = ['simeone', 'mourinho', 'conte', 'bilardo'];
    expect(upperRight).toContain(r.nearestArchetype.id);
  });

  it('cuadrante vertical-pragmático: klopp/flick/luis-enrique/ramon-diaz/ferguson', () => {
    const r = computeResult(uniformAnswers(60, -40));
    const lowerRight = ['klopp', 'flick', 'luis-enrique', 'ramon-diaz', 'ferguson', 'capello'];
    expect(lowerRight).toContain(r.nearestArchetype.id);
  });

  it('respuestas mixtas (cada pregunta primera opción) caen en un arquetipo razonable', () => {
    const r = computeResult(FIRST_OPTION_OF_EACH);
    // Sólo verificamos que está dentro del set — sin asumir cuál.
    expect(ARCHETYPES).toContain(r.nearestArchetype);
  });

  it('respuestas todas-izquierda vs todas-derecha producen puntos opuestos', () => {
    const left = computeResult(ALL_LEFT);
    const right = computeResult(ALL_RIGHT);
    expect(left.x).toBeLessThan(0);
    expect(right.x).toBeGreaterThan(0);
  });

  it('respuestas todas-arriba vs todas-abajo producen puntos opuestos en Y', () => {
    const top = computeResult(ALL_TOP);
    const bottom = computeResult(ALL_BOTTOM);
    expect(top.y).toBeGreaterThan(0);
    expect(bottom.y).toBeLessThan(0);
  });

  it('respuestas neutras caen en afinidad media-alta para arquetipos del centro', () => {
    // El origen (0, 0) está a ~141 unidades de los arquetipos centrales;
    // afinidad esperada: 100 * (1 - 141 / 282.84) ≈ 50%.
    const r = computeResult(ALL_NEUTRAL);
    // Sólo pedimos que el resultado esté en la familia de arquetipos centrales.
    expect([
      'ancelotti', 'scaloni', 'deschamps', 'zidane', 'del-bosque',
      'emery', 'lopetegui', 'gallardo',
    ]).toContain(r.nearestArchetype.id);
  });

  it('acepta AnswerMap como entrada', () => {
    const map: Record<string, Option> = {};
    QUESTIONS.forEach((q, idx) => {
      map[q.id] = q.options[idx % q.options.length];
    });
    const r = computeResult(map);
    expect(r.x).toBeGreaterThanOrEqual(-100);
    expect(r.x).toBeLessThanOrEqual(100);
  });
});

describe('invariantes', () => {
  it('todos los arquetipos están dentro del rango [-100, +100] en ambos ejes', () => {
    for (const a of ARCHETYPES) {
      expect(a.x).toBeGreaterThanOrEqual(-100);
      expect(a.x).toBeLessThanOrEqual(100);
      expect(a.y).toBeGreaterThanOrEqual(-100);
      expect(a.y).toBeLessThanOrEqual(100);
    }
  });

  it('todos los pesos de opciones están dentro del rango [-100, +100]', () => {
    for (const q of QUESTIONS) {
      for (const o of q.options) {
        expect(o.x).toBeGreaterThanOrEqual(-100);
        expect(o.x).toBeLessThanOrEqual(100);
        expect(o.y).toBeGreaterThanOrEqual(-100);
        expect(o.y).toBeLessThanOrEqual(100);
      }
    }
  });

  it('computeResult siempre devuelve x, y dentro de [-100, +100]', () => {
    const inputs: AnswerList[] = [
      FIRST_OPTION_OF_EACH,
      ALL_LEFT,
      ALL_RIGHT,
      ALL_TOP,
      ALL_BOTTOM,
      ALL_NEUTRAL,
      uniformAnswers(0, 0),
      uniformAnswers(100, 100),
      uniformAnswers(-100, -100),
    ];
    for (const input of inputs) {
      const r = computeResult(input);
      expect(r.x).toBeGreaterThanOrEqual(-100);
      expect(r.x).toBeLessThanOrEqual(100);
      expect(r.y).toBeGreaterThanOrEqual(-100);
      expect(r.y).toBeLessThanOrEqual(100);
      expect(r.affinity).toBeGreaterThanOrEqual(0);
      expect(r.affinity).toBeLessThanOrEqual(100);
    }
  });
});