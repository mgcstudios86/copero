import { describe, it, expect } from 'vitest';
import { WORDS, countWords, pickRandomWords } from '../../src/features/game/words';
import { CATEGORIES, type Category } from '../../src/types/game';

describe('words bank', () => {
  it('cada categoría tiene al menos 10 palabras', () => {
    for (const c of CATEGORIES) {
      expect(WORDS[c].length).toBeGreaterThanOrEqual(10);
    }
  });

  it('countWords coincide con WORDS[category].length', () => {
    for (const c of CATEGORIES) {
      expect(countWords(c)).toBe(WORDS[c].length);
    }
  });

  it('pickRandomWords no repite y respeta el límite', () => {
    const seq: number[] = [0.1, 0.5, 0.9, 0.3, 0.7];
    let i = 0;
    const rng = () => seq[i++ % seq.length] ?? 0;
    const picked = pickRandomWords('futbol', 5, rng);
    expect(picked.length).toBe(5);
    const texts = picked.map((w) => w.text);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('pickRandomWords con N > pool devuelve todas', () => {
    const c: Category = 'futbol';
    const picked = pickRandomWords(c, 9999, () => 0);
    expect(picked.length).toBe(WORDS[c].length);
  });
});
