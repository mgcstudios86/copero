import type { Club } from '@/types/career';

/**
 * Clubes que el academy ofrece al jugador (MGC-430, pantalla 3) +
 * arquetipos (MGC-208 §2: DESARROLLO / EQUILIBRIO / AMBICIÓN).
 *
 * El catálogo cubre los 3 arquetipos para que cada playthrough del
 * simulador tenga al menos una opción por arquetipo (MGC-216). Datos
 * placeholder: se reemplazan con assets del designer (MGC-428) al final.
 */
export const ACADEMY_CLUBS: Club[] = [
  {
    id: 'velez',
    name: 'Vélez Sarsfield',
    league: 'Liga Profesional',
    crestColor: '#1F2A24',
    crestAccent: '#FFFFFF',
    presupuesto: 8,
    archetype: 'EQUILIBRIO',
    reputation: 4,
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
  },
];
