import { beforeEach, describe, expect, it } from 'vitest';
import { createRng, createRngFromSnapshot, snapshotRng } from './rng';
import {
  __resetStorageForTests,
  blankCareerSave,
  loadCareerSave,
  saveCareerSave,
} from './persistence';

describe('persistencia de RngSnapshot', () => {
  beforeEach(() => {
    __resetStorageForTests();
  });

  it('roundtrippea cursor y restaura la secuencia desde AsyncStorage', async () => {
    const source = createRng(42);
    for (let i = 0; i < 6; i += 1) source.next();

    const state = {
      ...blankCareerSave(),
      seed: 42,
      rng: snapshotRng(source),
    };
    await saveCareerSave(state);

    const loaded = await loadCareerSave();
    expect(loaded?.rng).toEqual(state.rng);

    const restored = createRngFromSnapshot(loaded!.rng!);
    expect(Array.from({ length: 12 }, () => restored.next())).toEqual(
      Array.from({ length: 12 }, () => source.next()),
    );
  });
});
