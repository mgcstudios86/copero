import { CATEGORIES } from '@/types/game';
import type { Category } from '@/types/game';

export type CategoryMeta = {
  readonly id: Category;
  readonly label: string;
  readonly emoji: string;
  readonly description: string;
};

export const CATEGORIES_META: readonly CategoryMeta[] = [
  {
    id: 'futbol',
    label: 'Fútbol',
    emoji: '⚽',
    description: 'Pelota, técnica, táctica y gol.',
  },
  {
    id: 'musica',
    label: 'Música',
    emoji: '🎵',
    description: 'Géneros, instrumentos y bandas.',
  },
  {
    id: 'geografia',
    label: 'Geografía',
    emoji: '🌎',
    description: 'Ciudades, ríos y montañas.',
  },
  {
    id: 'comida',
    label: 'Comida',
    emoji: '🍕',
    description: 'Platos, bebidas y sabores.',
  },
  {
    id: 'animales',
    label: 'Animales',
    emoji: '🐾',
    description: 'Fauna terrestre, marina y aérea.',
  },
];

export const getCategoryMeta = (id: Category): CategoryMeta => {
  const meta = CATEGORIES_META.find((c) => c.id === id);
  if (!meta) throw new Error(`Categoría desconocida: ${id}`);
  return meta;
};

export const isCategory = (value: string): value is Category =>
  (CATEGORIES as readonly string[]).includes(value);
