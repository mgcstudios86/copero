/**
 * MGC-421 C5 — unit tests AC4 (logs `[persistence]` visibles) + C1
 * (persistAndFlush gate). Las 5 PRs merged previas (MGC-262/273/284/
 * 311/MGC-306) no cerraron el bug porque los logs estaban gated tras
 * `__DEV__` (silenciados en builds preview/profile) y los callers
 * terminales no esperaban el flush de AsyncStorage.
 *
 * QA escaló AC7 FAIL: snapshot vacío post force-stop, logs ausentes
 * en logcat preview, Maestro ac7-force-stop.yaml nunca existió.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { initialProfile } from '@/features/career/identity-state';

describe('MGC-421 C5 — AC4 logs [persistence] visibles en consola', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('saveCareerSave emite marker save=ok con stage y storage', async () => {
    const { saveCareerSave, __resetStorageForTests } = await import(
      '@/features/career/persistence'
    );
    __resetStorageForTests();
    await saveCareerSave({
      v: 1,
      stage: 'identity',
      profile: { ...initialProfile },
      draft: null,
      card: null,
      clubId: null,
      log: { timeline: [], events: [] },
      seed: 0,
    });
    const saw = logSpy.mock.calls.some((c) =>
      String(c[0] ?? '').startsWith('[persistence] save=ok'),
    );
    expect(saw).toBe(true);
  });

  it('loadCareerSave emite marker hydrate=null con storage vacío', async () => {
    const { loadCareerSave, clearCareerSave, __resetStorageForTests } = await import(
      '@/features/career/persistence'
    );
    __resetStorageForTests();
    await clearCareerSave();
    logSpy.mockClear();
    const result = await loadCareerSave();
    expect(result).toBeNull();
    const sawHydrate = logSpy.mock.calls.some((c) =>
      String(c[0] ?? '').startsWith('[persistence] hydrate='),
    );
    expect(sawHydrate).toBe(true);
  });

  it('loadCareerSave emite marker hydrate=ok cuando hay save válido', async () => {
    const { saveCareerSave, loadCareerSave, __resetStorageForTests } = await import(
      '@/features/career/persistence'
    );
    __resetStorageForTests();
    await saveCareerSave({
      v: 1,
      stage: 'season',
      profile: { ...initialProfile, name: 'TestQA' },
      draft: null,
      card: null,
      clubId: null,
      log: { timeline: [], events: [] },
      seed: 7,
    });
    logSpy.mockClear();
    const loaded = await loadCareerSave();
    expect(loaded && loaded.stage).toBe('season');
    const sawOk = logSpy.mock.calls.some((c) =>
      String(c[0] ?? '').startsWith('[persistence] hydrate=ok'),
    );
    expect(sawOk).toBe(true);
  });
});

describe('MGC-421 C5 — C1 persistAndFlush gate happy path', () => {
  it('persistAndFlush resuelve cuando AsyncStorage confirma', async () => {
    await import('@/features/career/persistence').then((p) =>
      p.__resetStorageForTests(),
    );
    const { persistAndFlush, useCareerStore } = await import(
      '@/shared/store/careerStore'
    );
    const snap = useCareerStore.getState();
    await expect(persistAndFlush(snap)).resolves.toBeUndefined();
  });
});
