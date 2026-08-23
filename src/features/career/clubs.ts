import type { Club } from '@/types/career';

/**
 * Clubes que el academy ofrece al jugador (MGC-430, pantalla 3).
 * Datos placeholder: se reemplazan con assets del designer (MGC-428) al final.
 */
export const ACADEMY_CLUBS: Club[] = [
  {
    id: 'velez',
    name: 'Vélez Sarsfield',
    league: 'Liga Profesional',
    crestColor: '#1F2A24',
    crestAccent: '#FFFFFF',
    presupuesto: 8,
  },
  {
    id: 'temperley',
    name: 'Temperley',
    league: 'Primera Nacional',
    crestColor: '#5B0A0A',
    crestAccent: '#F0EAE0',
    presupuesto: 3,
  },
  {
    id: 'moron',
    name: 'Morón',
    league: 'Primera Nacional',
    crestColor: '#0E1411',
    crestAccent: '#FFFFFF',
    presupuesto: 1,
  },
];