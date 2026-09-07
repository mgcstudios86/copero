import { describe, expect, it } from 'vitest';
import {
  createRng,
  createRngFromSnapshot,
  createRngSnapshot,
  restoreRng,
  snapshotRng,
} from './rng';

describe('RngSnapshot', () => {
  it('crea un snapshot v1 con el contrato de Mulberry32', () => {
    expect(createRngSnapshot(42)).toEqual({
      v: 1,
      seed: 42,
      cursor: 0,
      algorithm: 'mulberry32',
    });
  });

  it('reanuda la misma secuencia después del cursor persistido', () => {
    const source = createRng(7);
    for (let i = 0; i < 5; i += 1) source.next();

    const snapshot = snapshotRng(source);
    const restored = createRngFromSnapshot(snapshot);
    const expected = Array.from({ length: 10 }, () => source.next());
    const actual = Array.from({ length: 10 }, () => restored.next());

    expect(snapshot.cursor).toBe(5);
    expect(actual).toEqual(expected);

    const target = createRng(9);
    restoreRng(target, snapshot);
    const restoredReference = createRngFromSnapshot(snapshot);
    const expectedRestored = Array.from({ length: 3 }, () => restoredReference.next());
    expect(Array.from({ length: 3 }, () => target.next())).toEqual(expectedRestored);
  });
});
