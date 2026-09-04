import type { Club, PositionGroup } from '@/types/career';

/**
 * Clubes que el academy ofrece al jugador (MGC-430, pantalla 3) +
 * arquetipos (MGC-208 §2: DESARROLLO / EQUILIBRIO / AMBICIÓN).
 *
 * El catálogo cubre los 3 arquetipos para que cada playthrough del
 * simulador tenga al menos una opción por arquetipo (MGC-216). Datos
 * placeholder: se reemplazan con assets del diseñador (MGC-428) al final.
 *
 * MGC-249: cada club declara `positionGroups` para que la pantalla de
 * selección priorice clubes afines al rol del jugador (un ST verá a Boca
 * y Vélez primero; un GK verá a Temperley y Morón como DESARROLLO
 * natural). Esto evita el bug "queda Free agent" — siempre hay ≥1 club
 * recomendado visible para cualquier posición.
 */
export type ClubWithPosition = Club & {
  /** Grupos de posición donde el club recluta normalmente. */
  positionGroups: PositionGroup[];
  /** Bonus de fit (1=neutro, 2=afinidad alta) que se suma al OVR inicial en `pickClub`. */
  fitBonus?: number;
};

export const ACADEMY_CLUBS: ClubWithPosition[] = [
  {
    id: 'velez',
    name: 'Vélez Sarsfield',
    league: 'Liga Profesional',
    crestColor: '#1F2A24',
    crestAccent: '#FFFFFF',
    presupuesto: 8,
    archetype: 'EQUILIBRIO',
    reputation: 4,
    positionGroups: ['attack', 'midfield', 'defense'],
    fitBonus: 1,
  },
  {
    id: 'temperley',
    name: 'Temperley',
    league: 'Primera Nacional',
    crestColor: '#5B0A0A',
    crestAccent: '#F0EAE0',
    presupuesto: 3,
    archetype: 'DESARROLLO',
    reputation: 2,
    positionGroups: ['midfield', 'defense', 'goalkeeper'],
    fitBonus: 2,
  },
  {
    id: 'moron',
    name: 'Morón',
    league: 'Primera Nacional',
    crestColor: '#0E1411',
    crestAccent: '#FFFFFF',
    presupuesto: 1,
    archetype: 'DESARROLLO',
    reputation: 1,
    positionGroups: ['defense', 'midfield', 'goalkeeper'],
    fitBonus: 1,
  },
  {
    id: 'boca',
    name: 'Boca Juniors',
    league: 'Liga Profesional',
    crestColor: '#0A2A6B',
    crestAccent: '#FBBF24',
    presupuesto: 25,
    archetype: 'AMBICIÓN',
    reputation: 5,
    positionGroups: ['attack', 'midfield'],
    fitBonus: 2,
  },
  // MGC-1648 — F1 WF2 (team-select obligatorio) requiere 5 clubes
  // seleccionables con reputación visible. River Plate cierra el top 5 de
  // popularité (Boca/River/Vélez + los dos de Primera Nacional). Sin este
  // quinto club la pantalla del alta no podía cumplir el AC del ticket
  // («lista de 5 clubes»). Mantiene shape ClubWithPosition para no romper
  // `clubsForPosition` que el academy (F2+) sigue consumiendo: un ST sigue
  // viendo Boca/River/Vélez primero; un GK ve Temperley/Morón. La reputación
  // 5 lo posiciona como AMBICIÓN para los drills de draft.
  {
    id: 'river',
    name: 'River Plate',
    league: 'Liga Profesional',
    crestColor: '#FFFFFF',
    crestAccent: '#D4AF37',
    presupuesto: 24,
    archetype: 'AMBICIÓN',
    reputation: 5,
    positionGroups: ['attack', 'midfield', 'defense'],
    fitBonus: 2,
  },
];

/** Devuelve los clubes afines a un grupo de posición, ordenados por fit. */
export function clubsForPosition(group: PositionGroup): ClubWithPosition[] {
  return [...ACADEMY_CLUBS].sort((a, b) => {
    const aFit = a.positionGroups.includes(group) ? (a.fitBonus ?? 1) : 0;
    const bFit = b.positionGroups.includes(group) ? (b.fitBonus ?? 1) : 0;
    if (aFit !== bFit) return bFit - aFit;
    return (b.reputation ?? 0) - (a.reputation ?? 0);
  });
}
