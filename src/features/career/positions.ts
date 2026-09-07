import type { Position, PositionGroup } from '@/types/career';

/**
 * Posiciones del field map (12 clickeables en MGC-430):
 * ST/CAM/CM/CDM/CB base + LW/RW/LM/RM/LB/RB alas + GK.
 * Coords en % sobre el field map (0..1) para que la card escale
 * manteniendo la distribución del campo de fútbol.
 */
export type PositionDef = {
  id: Position;
  label: string;
  group: PositionGroup;
  x: number; // 0..1
  y: number; // 0..1
};

export const POSITIONS: PositionDef[] = [
  // Línea de ataque
  { id: 'LW', label: 'LW', group: 'attack', x: 0.18, y: 0.18 },
  { id: 'ST', label: 'ST', group: 'attack', x: 0.5, y: 0.12 },
  { id: 'RW', label: 'RW', group: 'attack', x: 0.82, y: 0.18 },
  // Mediocampistas
  { id: 'LM', label: 'LM', group: 'midfield', x: 0.1, y: 0.42 },
  { id: 'CAM', label: 'CAM', group: 'midfield', x: 0.5, y: 0.4 },
  { id: 'RM', label: 'RM', group: 'midfield', x: 0.9, y: 0.42 },
  { id: 'CM', label: 'CM', group: 'midfield', x: 0.5, y: 0.55 },
  { id: 'CDM', label: 'CDM', group: 'midfield', x: 0.5, y: 0.7 },
  // Defensa
  { id: 'LB', label: 'LB', group: 'defense', x: 0.18, y: 0.78 },
  { id: 'CB', label: 'CB', group: 'defense', x: 0.5, y: 0.83 },
  { id: 'RB', label: 'RB', group: 'defense', x: 0.82, y: 0.78 },
  // Arquero
  { id: 'GK', label: 'GK', group: 'goalkeeper', x: 0.5, y: 0.95 },
];

export const POSITION_LABEL: Record<Position, string> = POSITIONS.reduce(
  (acc, p) => {
    acc[p.id] = p.label;
    return acc;
  },
  {} as Record<Position, string>,
);

export const GROUP_COLOR: Record<PositionGroup, string> = {
  attack: '#E96A56',
  midfield: '#4FBE82',
  defense: '#93C5FD',
  goalkeeper: '#FBBF24',
};

/**
 * MGC-1628 rev 3 §L4 — `groupOf(position)`.
 *
 * Resuelve el `PositionGroup` (attack / midfield / defense / goalkeeper)
 * para una `Position` arbitraria. Es el helper canónico que motor
 * (`stats.ts`), match (`match.ts`) y reputación consumen para agrupar
 * las 12 posiciones del field map en las 4 familias que entiende el
 * `positionFactor` y los pesos del `match.ts`.
 *
 * Pure function. Sin lookup table (las 12 ramas se resuelven vía el
 * switch, no un `Record<Position, PositionGroup>` para evitar diverger
 * si F2.1+ agrega una posición como `RW2` o alias).
 *
 * AGREGADO en F2.1 (MGC-1628 rev 3 §L4): antes la resolución vivía
 * inline en `match.ts#groupOf` (privado) y se duplicaba en
 * `engine.ts#pickClub` como un `groupMap` Record literal. Ahora es un
 * helper único importable, y los call sites consumen la versión
 * exportada.
 */
export function groupOf(position: Position): PositionGroup {
  switch (position) {
    case 'GK':
      return 'goalkeeper';
    case 'CB':
    case 'LB':
    case 'RB':
      return 'defense';
    case 'CDM':
    case 'CM':
    case 'CAM':
    case 'LM':
    case 'RM':
      return 'midfield';
    case 'ST':
    case 'LW':
    case 'RW':
      return 'attack';
  }
}