/**
 * 15 preguntas del Ideología Futbolística (Tactical Compass).
 *
 * Cada opción tiene un peso crudo (x, y):
 *   - x en [-100, +100]: Posesión ↔ Vertical
 *   - y en [-100, +100]: Pragmático ↔ Dogmático
 *
 * `computeResult` en `lib/compass.ts` suma los pesos crudos y luego normaliza
 * dividiendo por la magnitud teórica máxima. Esto evita que sumar 15 preguntas
 * nos saque del rango [-100, +100].
 *
 * El texto de las preguntas es **copy propia** del clon; no se reutiliza el del bundle original.
 */

export type OptionId = string;

export type Option = {
  readonly id: OptionId;
  readonly label: string;
  /** Peso crudo en X. */
  readonly x: number;
  /** Peso crudo en Y. */
  readonly y: number;
};

export type Question = {
  readonly id: string;
  readonly prompt: string;
  readonly options: readonly Option[];
};

export const QUESTIONS: readonly Question[] = [
  {
    id: 'q1',
    prompt: '¿Qué le pedís a tu 5?',
    options: [
      { id: 'q1-a', label: 'Que lea el juego antes que la pelota', x: -55, y: 30 },
      { id: 'q1-b', label: 'Que sea el primer pase del contraataque', x: 55, y: -10 },
      { id: 'q1-c', label: 'Que gane el duelo y ya', x: 30, y: -50 },
    ],
  },
  {
    id: 'q2',
    prompt: '¿Qué es jugar bien?',
    options: [
      { id: 'q2-a', label: 'Tener la pelota y que el rival corra detrás', x: -80, y: 55 },
      { id: 'q2-b', label: 'Llegar al arco rival con más gente que el rival', x: 60, y: -25 },
      { id: 'q2-c', label: 'Ganar sin que se note cómo', x: 10, y: -65 },
    ],
  },
  {
    id: 'q3',
    prompt: '¿Para qué sirve tener la pelota?',
    options: [
      { id: 'q3-a', label: 'Para asfixiar al rival y hacer circular', x: -85, y: 50 },
      { id: 'q3-b', label: 'Para elegir el momento del ataque', x: -30, y: -10 },
      { id: 'q3-c', label: 'Para nada, lo que importa es lo que hacés con ella', x: 55, y: -55 },
    ],
  },
  {
    id: 'q4',
    prompt: '¿Qué significa dominar?',
    options: [
      { id: 'q4-a', label: 'Tener la pelota el 65% del partido', x: -70, y: 35 },
      { id: 'q4-b', label: 'Que el rival no pueda salir de su campo', x: 45, y: 60 },
      { id: 'q4-c', label: 'Tener más llegadas y más tiros', x: 20, y: -45 },
    ],
  },
  {
    id: 'q5',
    prompt: '¿Qué importa más?',
    options: [
      { id: 'q5-a', label: 'La idea, siempre', x: -25, y: 85 },
      { id: 'q5-b', label: 'El resultado, siempre', x: 20, y: -80 },
      { id: 'q5-c', label: 'El proceso, pero con números al final', x: -10, y: -20 },
    ],
  },
  {
    id: 'q6',
    prompt: '¿Todavía hay lugar para el 10 clásico?',
    options: [
      { id: 'q6-a', label: 'Sí, el equipo necesita un enganche', x: -40, y: 50 },
      { id: 'q6-b', label: 'No, los extremos llegaron para eso', x: 50, y: -30 },
      { id: 'q6-c', label: 'Solo si entiende cuándo defender', x: -10, y: 10 },
    ],
  },
  {
    id: 'q7',
    prompt: '¿Qué le pedís a tu 9?',
    options: [
      { id: 'q7-a', label: 'Que sea el primer defensor', x: -55, y: 70 },
      { id: 'q7-b', label: 'Que defina y se mueva en el área', x: 65, y: -30 },
      { id: 'q7-c', label: 'Que pivotee y haga jugar al equipo', x: -65, y: 20 },
    ],
  },
  {
    id: 'q8',
    prompt: 'El rival presiona alto. ¿Cómo salís?',
    options: [
      { id: 'q8-a', label: 'Por abajo, con el central pasando al mediocampista', x: -70, y: 40 },
      { id: 'q8-b', label: 'Salto líneas, busco a un punta o un carrilero', x: 80, y: 0 },
      { id: 'q8-c', label: 'Cambio el ritmo con un pase largo a la espalda', x: 30, y: -40 },
    ],
  },
  {
    id: 'q9',
    prompt: 'Llegás a un club nuevo a mitad de temporada. ¿Qué hacés?',
    options: [
      { id: 'q9-a', label: 'Imprimo mi idea desde el primer día', x: -30, y: 80 },
      { id: 'q9-b', label: 'Me adapto al plantel hasta el receso', x: 5, y: -60 },
      { id: 'q9-c', label: 'Sumo de a poco, sin romper lo que funciona', x: -10, y: -20 },
    ],
  },
  {
    id: 'q10',
    prompt: 'Tu crack no tiene físico para tu táctica. ¿Qué hacés?',
    options: [
      { id: 'q10-a', label: 'Cambio la táctica para que pueda jugar', x: -20, y: -55 },
      { id: 'q10-b', label: 'Cambio al crack por otro que se adapte', x: 15, y: 60 },
      { id: 'q10-c', label: 'Le busco un rol específico en la estructura', x: -45, y: 10 },
    ],
  },
  {
    id: 'q11',
    prompt: 'Empate al entretiempo sin afianzarse. ¿Qué tocás en el entretiempo?',
    options: [
      { id: 'q11-a', label: 'Nada, el plan está bien, lo repito', x: -25, y: 70 },
      { id: 'q11-b', label: 'Cambio piezas y modifico el sistema', x: 20, y: -50 },
      { id: 'q11-c', label: 'Subo un jugador y voy con todo', x: 70, y: -10 },
    ],
  },
  {
    id: 'q12',
    prompt: 'Visitante contra un rival fuerte. ¿Cómo plantás el equipo?',
    options: [
      { id: 'q12-a', label: 'Bloque bajo y transiciones rápidas', x: 50, y: -25 },
      { id: 'q12-b', label: 'Presión alta para que no le llegue la pelota', x: -45, y: 65 },
      { id: 'q12-c', label: 'Posesión larga para que el rival no ataque', x: -75, y: 10 },
    ],
  },
  {
    id: 'q13',
    prompt: 'Final, ganando 1-0 a los 80 minutos. ¿Qué hacés?',
    options: [
      { id: 'q13-a', label: 'Cierro líneas y juego con el reloj', x: 20, y: -75 },
      { id: 'q13-b', label: 'Sigo atacando, quiero el segundo', x: 60, y: 30 },
      { id: 'q13-c', label: 'Administro la pelota sin rifarla', x: -55, y: -20 },
    ],
  },
  {
    id: 'q14',
    prompt: 'Un jugador tuyo encaró tres veces y perdió todas. ¿Qué hacés?',
    options: [
      { id: 'q14-a', label: 'Lo saco, está regalando la pelota', x: 40, y: 30 },
      { id: 'q14-b', label: 'Lo dejo, la cuarta puede ser gol', x: -15, y: -60 },
      { id: 'q14-c', label: 'Le doy una indicación táctica concreta', x: -50, y: 25 },
    ],
  },
  {
    id: 'q15',
    prompt: 'Cuando se pierde la pelota, ¿qué tiene que pasar?',
    options: [
      { id: 'q15-a', label: 'Recuperarla en seis segundos, todos aprietan', x: -55, y: 75 },
      { id: 'q15-b', label: 'Reorganizarse rápido, bloque medio bajo', x: 25, y: -40 },
      { id: 'q15-c', label: 'Atacar el espacio antes de que se reorganicen', x: 85, y: 10 },
    ],
  },
] as const;

/**
 * Devuelve la opción correspondiente a `optionId` dentro de la pregunta `question`.
 * Lanza si la combinación es inválida (ayuda a cazar typos).
 */
export function getOption(
  question: Question,
  optionId: OptionId,
): Option {
  const opt = question.options.find((o) => o.id === optionId);
  if (!opt) {
    throw new Error(
      `[questions] option ${optionId} no existe en pregunta ${question.id}`,
    );
  }
  return opt;
}