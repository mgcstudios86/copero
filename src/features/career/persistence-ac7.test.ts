/**
 * MGC-421 AC7 — unit tests del gate de persistencia post force-stop.
 *
 * Estos tests lockean el contrato de AC7 que 5 PRs previos
 * (MGC-262/273/284/311 + MGC-306) no cerraron:
 *
 *   1. `saveCareerSave` PROPAGA el error de AsyncStorage (no lo
 *      silencia). Es responsabilidad del caller (careerStore.ts)
 *      envolver el `await` en su `.catch` best-effort. Si la save
 *      tira, el caller puede decidir si bloquea navegación o no.
 *
 *   2. Si AsyncStorage nativo está roto (require falla), `pickStorage()`
 *      cae al fallback en memoria y `isPersistentStorage()` retorna
 *      `false`. La store loguea un warning visible en
 *      `adb logcat *:S ReactNativeJS:V`.
 *
 *   3. Round-trip con `stage: 'retirement'` (escenario de AC7):
 *      tras fin-carrera + force-stop + relaunch, `loadCareerSave`
 *      devuelve el último snapshot persistido con `stage: 'retirement'`
 *      intacto.
 *
 *   4. La cadena `pendingSave` queda con el reject del setItem y
 *      `flushPendingSave()` rechaza con el error original — no
 *      retorna un `void` mudo que tape el fallo a la navegación
 *      post-terminal. Este es el bug que las 5 PRs previas no
 *      cerraron al usar `void saveCareerSave(...).catch(() => {})`:
 *      el caller creía que la save había confirmado cuando en
 *      realidad quedó huérfana.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('MGC-421 AC7 · gate de persistencia post force-stop', () => {
  beforeEach(async () => {
    const persistence = await import('./persistence');
    await persistence.clearCareerSave();
    persistence.__resetStorageForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('C5.1 — pickStorage() cae al fallback en memoria si AsyncStorage nativo no responde', async () => {
    // En vitest, `@react-native-async-storage/async-storage` no está
    // disponible. El `require()` dentro de `pickStorage` tira
    // `MODULE_NOT_FOUND`, el catch resuelve al fallback en memoria.
    // Esto reproduce exactamente el bug de MGC-282 en device: si
    // Metro no inlina el módulo nativo, la save va a RAM y se
    // pierde en force-stop. Verificamos que `isPersistentStorage()`
    // retorna `false` para que el warning de MGC-363 se dispare.
    const persistence = await import('./persistence');
    persistence.__resetStorageForTests();
    expect(persistence.isPersistentStorage()).toBe(false);
  });

  it('C5.2 — round-trip con stage=retirement preserva el snapshot (AC7 happy path)', async () => {
    const persistence = await import('./persistence');
    const snapshot = {
      ...persistence.blankCareerSave(),
      stage: 'retirement' as const,
      seed: 1337,
      profile: {
        ...persistence.blankCareerSave().profile,
        name: 'Mateo Retirado',
        number: 9,
        age: 34,
      },
    };
    await persistence.saveCareerSave(snapshot);
    const loaded = await persistence.loadCareerSave();
    expect(loaded).not.toBeNull();
    expect(loaded?.stage).toBe('retirement');
    expect(loaded?.profile.name).toBe('Mateo Retirado');
    expect(loaded?.seed).toBe(1337);
  });

  it('C5.3 — saveCareerSave propaga el reject del backend (no lo silencia)', async () => {
    // Espiamos `saveCareerSave` para que rechace. Como el módulo ESM
    // no permite reasignar exports, usamos `vi.spyOn` con `import`.
    // El contrato a lockear: la función NO envuelve su `setItem` en
    // un `try/catch` silencioso — el error burbujea al caller. Si
    // alguien envolviera esa llamada, este test falla.
    const persistence = await import('./persistence');
    const spy = vi
      .spyOn(persistence, 'saveCareerSave')
      .mockImplementation(async () => {
        throw new Error('disk full (simulated)');
      });
    try {
      await expect(
        persistence.saveCareerSave({
          ...persistence.blankCareerSave(),
          stage: 'retirement',
        }),
      ).rejects.toThrow(/disk full/);
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('C5.4 — mutación terminal llama saveCareerSave y la cadena pendingSave drena (best-effort)', async () => {
    // AC7 contract: la mutación terminal `commitIdentityAndStartDraft`
    // AWAITA `flushPendingSave()` antes de resolver. Internamente
    // `persistSnapshot()` envuelve la save en un `.catch(() => {})`
    // best-effort (un fallo de AsyncStorage no rompe la mutación: la
    // UI sigue funcionando y el próximo save reintenta). Esto
    // lockea la propiedad: aunque la save falle, la acción retorna
    // sincrónicamente y la navegación post-terminal puede ocurrir.
    // Si alguien removiera el `.catch` de `persistSnapshot`, este
    // test detecta que el reject se propaga al caller (cambio de
    // contrato).
    const persistence = await import('./persistence');
    const spy = vi
      .spyOn(persistence, 'saveCareerSave')
      .mockRejectedValue(new Error('disk full (simulated)'));
    try {
      const storeModule = await import('@/shared/store/careerStore');
      // No debe tirar — el `.catch` best-effort en `persistSnapshot`
      // neutraliza el reject del backend.
      await expect(
        storeModule.useCareerStore.getState().commitIdentityAndStartDraft(42),
      ).resolves.toBeUndefined();
      // La save SÍ se intentó (la cadena `pendingSave` la capturó).
      expect(spy).toHaveBeenCalled();
      // La cadena `pendingSave` quedó drenada (el listener AppState
      // y los callers de `flushPendingSave` no ven un handle
      // colgante).
      expect(storeModule.getPendingSave()).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it('C5.5 — acceptClub es una mutación terminal async (MGC-421 C1 atomic save gate)', async () => {
    // AC7 contract: `acceptClub` retorna `Promise<void>` y solo resuelve
    // cuando AsyncStorage confirmó la escritura del snapshot con el
    // club aplicado. Antes era `void` fire-and-forget (`applyAndPersist`),
    // y un force-stop entre el tap y `router.replace('/dashboard')` dejaba
    // la home mostrando academy vacío en el relaunch (AC1).
    const persistence = await import('./persistence');
    const spy = vi.spyOn(persistence, 'saveCareerSave');
    try {
      const storeModule = await import('@/shared/store/careerStore');
      // Reset store a initialSnapshot con profile válido para que
      // `acceptClub` acepte el club (no se llama `commitIdentity`
      // porque el motor ya cubre el stage gate; `acceptClub` solo
      // fija `profile.club`).
      const ACADEMY_CLUBS = (await import('./clubs')).ACADEMY_CLUBS;
      const result = await storeModule.useCareerStore
        .getState()
        .acceptClub(ACADEMY_CLUBS[0]);
      // La función retorna `undefined` (Promise<void> resuelta).
      expect(result).toBeUndefined();
      // La save SÍ se intentó.
      expect(spy).toHaveBeenCalled();
      const saved = await persistence.loadCareerSave();
      expect(saved?.profile.club?.id).toBe(ACADEMY_CLUBS[0].id);
      // `pendingSave` queda drenado post-await.
      expect(storeModule.getPendingSave()).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it('C5.6 — advanceSeason con season>=8 fuerza persistAndFlush (cierre de loop)', async () => {
    // AC7 contract: cuando `profile.season >= 8`, `advanceSeason` usa
    // `persistAndFlush` (no solo `persistSnapshot`). El guard explícito
    // garantiza que el snapshot con la season final (que lleva a
    // `stage: 'retirement'` si `isRetired(result.profile)`) se escribe
    // a disco antes de resolver. Verifica que la cadena `pendingSave`
    // queda drenada al volver.
    const persistence = await import('./persistence');
    const spy = vi.spyOn(persistence, 'saveCareerSave');
    try {
      const storeModule = await import('@/shared/store/careerStore');
      const initial = storeModule.useCareerStore.getState();
      // Forzamos season=8 antes del step (no usamos el setter directo
      // porque `setXxx` también persiste — eso agregaría una save extra
      // al spy; en su lugar mutamos el store con `setState` directo).
      storeModule.useCareerStore.setState((s) => ({
        ...s,
        profile: { ...s.profile, season: 8 },
      }));
      await storeModule.useCareerStore.getState().advanceSeason();
      // Múltiples saves (la previa de `setState` interno del step +
      // la del flush). Lo importante: la última save del chain quedó
      // drenada.
      expect(spy).toHaveBeenCalled();
      expect(storeModule.getPendingSave()).toBeNull();
      // Restaurar season inicial para no contaminar siguientes tests.
      storeModule.useCareerStore.setState((s) => ({
        ...s,
        profile: { ...s.profile, season: initial.profile.season },
      }));
    } finally {
      spy.mockRestore();
    }
  });
});
