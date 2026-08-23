import { describe, it, expect } from 'vitest';
import { CATEGORIES_META, getCategoryMeta, isCategory } from '../../src/features/game/categories';

describe('categories', () => {
  it('todas las categorías tienen label, emoji y description', () => {
    for (const c of CATEGORIES_META) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.emoji.length).toBeGreaterThan(0);
      expect(c.description.length).toBeGreaterThan(0);
    }
  });

  it('getCategoryMeta devuelve meta válida', () => {
    expect(getCategoryMeta('futbol').id).toBe('futbol');
    expect(() => getCategoryMeta('unknown' as never)).toThrow();
  });

  it('isCategory type guard', () => {
    expect(isCategory('futbol')).toBe(true);
    expect(isCategory('xyz')).toBe(false);
  });
});
