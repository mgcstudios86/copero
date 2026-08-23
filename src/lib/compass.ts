/**
 * Cálculo puro del resultado del Tactical Compass.
 *
 * Función `computeResult(answers)`:
 *   - Recibe un array de exactamente 15 opciones (una por pregunta).
 *   - Suma los pesos crudos (x, y) de cada opción.
 *   - Normaliza dividiendo por la magnitud teórica máxima (suma del máximo absoluto
 *     de cada pregunta) → mantiene el resultado dentro de [-100, +100] en cada eje.
 *   - Devuelve el arquetipo más cercano por distancia euclídea y el porcentaje de
 *     afinidad (100 = idéntico al arquetipo, 0 = diametralmente opuesto).
 *
 * No tiene side effects. Es testeable con vitest sin DOM ni storage.
 */

import { ARCHETYPES, type Archetype } from '@/data/archetypes';
import type { Option } from '@/data/questions';

/**
 * Resultado final del quiz. La forma es estable y consumida por `ResultScreen`,
 * el share card y los tests.
 */
export type CompassResult = {
  /** Coordenada X normalizada, rango [-100, 100]. */
  readonly x: number;
  /** Coordenada Y normalizada, rango [-100, 100]. */
  readonly y: number;
  /** Arquetipo más cercano por distancia euclídea. */
  readonly nearestArchetype: Archetype;
  /** Afinidad en [0, 100], donde 100 = mismo punto, 0 = diametralmente opuesto. */
  readonly affinity: number;
};

/**
 * Mapa de respuestas: id de pregunta → opción elegida.
 * Forma conveniente para persistir en sessionStorage.
 */
export type AnswerMap = Readonly<Record<string, Option>>;

/**
 * Lista ordenada de 15 opciones (una por pregunta, en el mismo orden que QUESTIONS).
 * Forma alternativa a `AnswerMap` para tests deterministas.
 */
export type AnswerList = readonly Option[];

/** Tipo de entrada flexible para `computeResult`. */
export type AnswersInput = AnswerMap | AnswerList;

const QUESTIONS_ORDER = [
  'q1',
  'q2',
  'q3',
  'q4',
  'q5',
  'q6',
  'q7',
  'q8',
  'q9',
  'q10',
  'q11',
  'q12',
  'q13',
  'q14',
  'q15',
] as const;

const MAX_PER_QUESTION = 100;

/**
 * Magnitud teórica máxima de la suma cruda, en valor absoluto, sobre cada eje.
 * Si todas las respuestas tuvieran peso +100 en X, sumarían 1500. Usamos 1500
 * como denominador para normalizar a [-100, +100].
 */
const TOTAL_QUESTIONS = QUESTIONS_ORDER.length;
const RAW_MAX = MAX_PER_QUESTION * TOTAL_QUESTIONS;

/**
 * Distancia máxima posible entre dos puntos dentro del cuadrado [-100, +100]²:
 * la diagonal, de ( -100, -100 ) a ( +100, +100 ).
 */
const MAX_DISTANCE = Math.sqrt(
  (200) ** 2 + (200) ** 2,
);

/**
 * Suma cruda de pesos sobre las 15 respuestas (sin normalizar).
 * Devuelve `null` si `answers` no cubre las 15 preguntas.
 */
export function sumRaw(answers: AnswersInput): { x: number; y: number } | null {
  const list = toList(answers);
  if (list.length !== TOTAL_QUESTIONS) return null;
  let x = 0;
  let y = 0;
  for (const opt of list) {
    x += opt.x;
    y += opt.y;
  }
  return { x, y };
}

/**
 * Normaliza una suma cruda al rango [-100, +100] dividiendo por `RAW_MAX`.
 * Acepta magnitudes negativas (no las rechaza) y nunca devuelve valores fuera
 * de rango si las entradas individuales cumplen con `MAX_PER_QUESTION`.
 */
export function normalize(raw: number): number {
  const clamped = Math.max(-RAW_MAX, Math.min(RAW_MAX, raw));
  return (clamped / RAW_MAX) * 100;
}

/**
 * Distancia euclídea entre dos puntos del compass.
 */
export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Busca el arquetipo más cercano al punto (x, y).
 * Si hay empate (poco probable con datos reales), gana el primero que aparece
 * en `ARCHETYPES` (estable).
 */
export function findNearest(x: number, y: number): Archetype {
  let nearest = ARCHETYPES[0];
  let best = distance({ x, y }, { x: nearest.x, y: nearest.y });
  for (let i = 1; i < ARCHETYPES.length; i++) {
    const a = ARCHETYPES[i];
    const d = distance({ x, y }, { x: a.x, y: a.y });
    if (d < best) {
      best = d;
      nearest = a;
    }
  }
  return nearest;
}

/**
 * Afinidad en [0, 100]:
 *   - 100  → el punto del usuario coincide exactamente con el arquetipo.
 *   - 0    → el punto está en la esquina opuesta del cuadrado [-100, +100]².
 *
 * Fórmula: 100 × (1 − distancia / MAX_DISTANCE).
 */
export function affinity(x: number, y: number, arch: Archetype): number {
  const d = distance({ x, y }, { x: arch.x, y: arch.y });
  const raw = 1 - d / MAX_DISTANCE;
  return clampPercent(raw * 100);
}

/**
 * Función principal. Lanza si las entradas son inválidas.
 */
export function computeResult(answers: AnswersInput): CompassResult {
  const raw = sumRaw(answers);
  if (!raw) {
    throw new Error(
      `[compass] se requieren ${TOTAL_QUESTIONS} respuestas, recibidas ${toList(answers).length}`,
    );
  }
  const x = normalize(raw.x);
  const y = normalize(raw.y);
  const nearest = findNearest(x, y);
  return {
    x,
    y,
    nearestArchetype: nearest,
    affinity: affinity(x, y, nearest),
  };
}

// ---- internals ----------------------------------------------------------

function toList(answers: AnswersInput): AnswerList {
  if (Array.isArray(answers)) return answers;
  // AnswerMap: armar la lista en el orden canónico de QUESTIONS_ORDER.
  const list: Option[] = [];
  const map = answers as Record<string, Option | undefined>;
  for (const qid of QUESTIONS_ORDER) {
    const opt = map[qid];
    if (opt) list.push(opt);
  }
  return list;
}

function clampPercent(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}