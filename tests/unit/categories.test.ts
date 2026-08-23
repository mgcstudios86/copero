import { describe, it, expect } from 'vitest';
import { CATEGORIES_META, getCategoryMeta, isCategory } from '../../src/features/game/categories';

describe('categories', () => {
  it('todos los emoji son code points válidos (no U+FFFD)', () => {
    // El bug original fue codepoint U+FFFD (REPLACEMENT CHARACTER) por encoding
    // inválido. `c.emoji.length > 0` no detectaba el problema porque � tiene
    // length=1 pero codepoint=0xFFFD. Este test recorre los code points y
    // rechaza U+FFFD explícitamente.
    for (const c of CATEGORIES_META) {
      expect(c.emoji.length).toBeGreaterThan(0);
      for (const cp of c.emoji) {
        expect(cp.codePointAt(0)).not.toBe(0xfffd);
      }
      // Tampoco debe haber secuencias de reemplazo en el string.
      expect(c.emoji).not.toMatch(/�/);
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
