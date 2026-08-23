/**
 * Definición de los dos ejes del compass ideológico.
 * Cada eje es bipolar: el polo izquierdo/inferior vale -100, el derecho/superior +100.
 *
 * Convenciones de orientación (ver `CompassVisualization`):
 *  - X horizontal: Posesión (izquierda) ↔ Vertical (derecha)
 *  - Y vertical:   Pragmático (abajo)     ↔ Dogmático (arriba)
 *
 * Los nombres son copy propia del clon; no traducimos ni tomamos del bundle original.
 */

export type AxisId = 'x' | 'y';

export type Axis = {
  readonly id: AxisId;
  readonly negative: string;
  readonly positive: string;
  readonly description: string;
};

export const AXES: Readonly<Record<AxisId, Axis>> = {
  x: {
    id: 'x',
    negative: 'Posesión',
    positive: 'Vertical',
    description:
      'De la pelota como propiedad al espacio como recurso. Del juego paciente que asfixia al ataque directo que estira líneas.',
  },
  y: {
    id: 'y',
    negative: 'Pragmático',
    positive: 'Dogmático',
    description:
      'De lo que sirve a lo que se cree. Del resultado como único juez a la idea como principio innegociable.',
  },
} as const;

/**
 * Rango teórico de coordenadas: [-100, +100] en cada eje.
 * El compass nunca se sale de acá.
 */
export const COMPASS_MIN = -100;
export const COMPASS_MAX = 100;
export const COMPASS_RANGE = COMPASS_MAX - COMPASS_MIN;