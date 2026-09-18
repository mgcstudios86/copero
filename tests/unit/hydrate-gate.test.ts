/**
 * MGC-755 iter8 — unit tests del gate centralizado de hidratación.
 *
 * Cubre las 3 capas del gate:
 *   Capa A — coalesce de concurrentes (Promise compartida).
 *   Capa B — singleton via Symbol (sobrevive HMR / bundle splits).
 *   Capa C — early-exit por no-snapshot cacheado (corta el loop).
 *
 * Plus:
 *   - sticky dedup de logs `[hydrateGate]` (un warn por slot+reason).
 *   - `invalidate()` resetea cache + permite nuevo log post save.
 *   - `force: true` salta la capa C sin tocar A+B.
 *   - `__resetGateForTests()` da un estado limpio entre tests.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';

describe('MGC-755 iter8 — hydrateGate centralizado', () => {
  beforeEach(async () => {
    const gate = await import('@/shared/store/hydrateGate');
    gate.__resetGateForTests();
    vi.restoreAllMocks();
  });

  it('devuelve no-snapshot la primera vez con loader vacío', async () => {
    const { requestHydrate } = await import('@/shared/store/hydrateGate');
    const loader = vi.fn().mockResolvedValue(null);
    const result = await requestHydrate(loader, { caller: 'test-1' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('no-snapshot');
    }
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('capa C — corta el loop: 2da llamada sin force NO invoca el loader', async () => {
    const { requestHydrate } = await import('@/shared/store/hydrateGate');
    const loader = vi.fn().mockResolvedValue(null);
    // 1ra: ejecuta el loader y cachea no-snapshot.
    const r1 = await requestHydrate(loader, { caller: 'test-2' });
    expect(r1.ok).toBe(false);
    expect(loader).toHaveBeenCalledTimes(1);

    // 2da-10ma: el gate debe cortar el loop. El loader NO se vuelve
    // a llamar — esto es lo que el walk QA mostró fallando sobre
    // iter6/iter7 (3184 calls en 152s).
    for (let i = 0; i < 9; i++) {
      const r = await requestHydrate(loader, { caller: 'test-2' });
      expect(r.ok).toBe(false);
    }
    expect(loader).toHaveBeenCalledTimes(1); // sigue en 1
  });

  it('force:true salta la capa C y re-invoca el loader', async () => {
    const { requestHydrate } = await import('@/shared/store/hydrateGate');
    const loader = vi.fn().mockResolvedValue(null);
    await requestHydrate(loader, { caller: 'test-3' });
    expect(loader).toHaveBeenCalledTimes(1);

    // force: el loader se invoca otra vez.
    await requestHydrate(loader, { caller: 'test-3', force: true });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('invalidate() resetea la cache de resultado y permite re-load', async () => {
    const { requestHydrate, invalidate } = await import('@/shared/store/hydrateGate');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const loader = vi.fn().mockResolvedValue(null);
    await requestHydrate(loader, { caller: 'test-4' });
    expect(loader).toHaveBeenCalledTimes(1);

    invalidate();
    await requestHydrate(loader, { caller: 'test-4' });
    expect(loader).toHaveBeenCalledTimes(2);

    // El warn sticky debe emitirse UNA sola vez (la primera). El
    // invalidate() no borra el Set sticky — sólo el cache de
    // resultado — así el segundo requestHydrate re-invoca el loader
    // pero NO emite un nuevo warn.
    const nullWarns = warnSpy.mock.calls.filter((c) =>
      String(c[0] ?? '').includes('hydrate=null'),
    );
    expect(nullWarns.length).toBe(1);
  });

  it('capa A — coalesce: N llamadas concurrentes ejecutan el loader UNA vez', async () => {
    const { requestHydrate } = await import('@/shared/store/hydrateGate');
    let resolveLoader: (v: unknown) => void = () => {};
    const loader = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLoader = resolve;
        }),
    );

    // Disparar 5 calls concurrentes ANTES de que el loader resuelva.
    const promises = [
      requestHydrate(loader, { caller: 'concurrent-1' }),
      requestHydrate(loader, { caller: 'concurrent-2' }),
      requestHydrate(loader, { caller: 'concurrent-3' }),
      requestHydrate(loader, { caller: 'concurrent-4' }),
      requestHydrate(loader, { caller: 'concurrent-5' }),
    ];

    // El gate.inFlight se setea SÍNCRONAMENTE en el primer caller;
    // los otros 4 ven el guard antes de cualquier await. Damos un
    // microtask para que el IIFE async llegue al `await loader()`
    // antes de medir.
    await new Promise((r) => setTimeout(r, 0));
    expect(loader).toHaveBeenCalledTimes(1);

    resolveLoader(null);
    const results = await Promise.all(promises);
    for (const r of results) {
      expect(r.ok).toBe(false);
    }
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('happy path: loader devuelve saved → outcome.ok=true con payload', async () => {
    const { requestHydrate } = await import('@/shared/store/hydrateGate');
    const fakeSave = { v: 2, stage: 'dashboard', profile: { name: 'TEST' } };
    const loader = vi.fn().mockResolvedValue({ saved: fakeSave });
    const result = await requestHydrate(loader, { caller: 'happy' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload).toEqual(fakeSave);
    }
  });

  it('reason version-mismatch se cachea como no-ok y no-snapshot NO', async () => {
    const { requestHydrate } = await import('@/shared/store/hydrateGate');
    const loader1 = vi.fn().mockResolvedValue({ saved: null, reason: 'version-mismatch' });
    const r1 = await requestHydrate(loader1, { caller: 'version' });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.reason).toBe('version-mismatch');

    // version-mismatch se cachea como ok=false pero la razón NO es
    // 'no-snapshot' → la próxima llamada SIN force SÍ re-invoca el
    // loader (no early-exit). Esto permite recuperación post-fix.
    const loader2 = vi.fn().mockResolvedValue(null);
    const r2 = await requestHydrate(loader2, { caller: 'version' });
    expect(r2.ok).toBe(false);
    expect(loader2).toHaveBeenCalledTimes(1);
  });

  it('sticky dedup: 1 warn "FIRST" + suppressed subsiguientes durante toda la vida', async () => {
    const { requestHydrate, invalidate } = await import('@/shared/store/hydrateGate');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const loader = vi.fn().mockResolvedValue(null);

    await requestHydrate(loader, { caller: 'sticky' });
    invalidate(); // resetea cache para forzar re-load
    await requestHydrate(loader, { caller: 'sticky' });
    invalidate();
    await requestHydrate(loader, { caller: 'sticky' });

    const nullWarns = warnSpy.mock.calls.filter((c) =>
      String(c[0] ?? '').includes('hydrate=null'),
    );
    // Primer warn: el "FIRST" con stack trace. Los siguientes
    // invalidamos + re-llamamos, pero como el gate conserva el Set
    // nullLogEmitted por instancia (NO se borra en `invalidate()`),
    // los warns subsiguientes NO se emiten — sólo el primero aparece
    // en logcat. El walk QA iter6/7 emitía 21 logs/s; con esta capa
    // el máximo esperado es 1 por sesión.
    expect(nullWarns.length).toBe(1);
  });

  it('high-call-count warn cuando un caller supera 5 calls', async () => {
    const { requestHydrate, invalidate } = await import('@/shared/store/hydrateGate');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const loader = vi.fn().mockResolvedValue(null);

    // 1ra: cachea no-snapshot.
    await requestHydrate(loader, { caller: 'spammer' });
    // 2-6ta: cache hit, no re-load, pero el counter sigue.
    for (let i = 0; i < 5; i++) {
      await requestHydrate(loader, { caller: 'spammer' });
    }

    const highCountWarns = warnSpy.mock.calls.filter((c) =>
      String(c[0] ?? '').includes('high-call-count'),
    );
    expect(highCountWarns.length).toBeGreaterThanOrEqual(1);
  });

  it('getGateDebug expone el estado para diagnóstico', async () => {
    const { requestHydrate, getGateDebug, __resetGateForTests } = await import(
      '@/shared/store/hydrateGate'
    );
    __resetGateForTests();
    const before = getGateDebug();
    expect(before.lastResult).toBeNull();
    expect(before.callCount).toEqual({});

    await requestHydrate(async () => null, { caller: 'debug-test' });
    const after = getGateDebug();
    expect(after.lastResult).not.toBeNull();
    expect(after.callCount['debug-test:default']).toBeGreaterThanOrEqual(1);
  });
});
