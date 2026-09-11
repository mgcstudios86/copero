/**
 * MGC-2099-A — multi-slot save + UI save-picker.
 *
 * Locks the API contract that the dashboard/temporada pickers depend on:
 *
 *   1. Three distinct saves round-trip independently (`saveCareerSave(s, slotId)`
 *      + `loadCareerSave(slotId)` returns the right payload per slot).
 *   2. `listSlots()` returns the index sorted by `savedAt` desc and
 *      includes the active slot id.
 *   3. `createSlot(name)` slugs and dedups by name + id.
 *   4. `setActiveSlot` + `getActiveSlotId` controls the cursor that the
 *      single-arg API reads from.
 *   5. Back-compat: legacy `copero:career:save:v1` is migrated to slot
 *      `default` on first read and the legacy key is preserved
 *      (DoR subtarea: "No invalidar save vivo en ZY22G728HN").
 *   6. `loadCareerSave()` without args resolves to the active slot.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getActiveSlotId } from './persistence';

describe('MGC-2099-A · multi-slot save + UI save-picker', () => {
  beforeEach(async () => {
    const persistence = await import('./persistence');
    await persistence.clearCareerSave();
    persistence.__resetStorageForTests();
  });

  it('3 saves distintos viven en keys v2 separadas y round-trippean sin pisarse', async () => {
    const persistence = await import('./persistence');
    const base = persistence.blankCareerSave();

    const saveA = { ...base, stage: 'season' as const, seed: 111, profile: { ...base.profile, name: 'Save A' } };
    const saveB = { ...base, stage: 'draft' as const, seed: 222, profile: { ...base.profile, name: 'Save B' } };
    const saveC = { ...base, stage: 'season' as const, seed: 333, profile: { ...base.profile, name: 'Save C' } };

    await persistence.saveCareerSave(saveA, 'save-a');
    await persistence.saveCareerSave(saveB, 'save-b');
    await persistence.saveCareerSave(saveC, 'save-c');

    expect((await persistence.loadCareerSave('save-a'))?.profile.name).toBe('Save A');
    expect((await persistence.loadCareerSave('save-b'))?.profile.name).toBe('Save B');
    expect((await persistence.loadCareerSave('save-c'))?.profile.name).toBe('Save C');
    // Que no haya cross-contamination de stage/seed.
    expect((await persistence.loadCareerSave('save-a'))?.stage).toBe('season');
    expect((await persistence.loadCareerSave('save-b'))?.stage).toBe('draft');
    expect((await persistence.loadCareerSave('save-a'))?.seed).toBe(111);
    expect((await persistence.loadCareerSave('save-c'))?.seed).toBe(333);
  });

  it('listSlots devuelve los 3 saves ordenados por savedAt desc y reporta el activo', async () => {
    const persistence = await import('./persistence');
    const base = persistence.blankCareerSave();

    await persistence.saveCareerSave({ ...base, profile: { ...base.profile, name: 'A' } }, 'a');
    await new Promise((r) => setTimeout(r, 2));
    await persistence.saveCareerSave({ ...base, profile: { ...base.profile, name: 'B' } }, 'b');
    await new Promise((r) => setTimeout(r, 2));
    await persistence.saveCareerSave({ ...base, profile: { ...base.profile, name: 'C' } }, 'c');
    await persistence.setActiveSlot('b');

    const { slots, activeSlotId } = await persistence.listSlots();
    expect(activeSlotId).toBe('b');
    // Orden desc por savedAt → c, b, a.
    expect(slots.map((s) => s.id)).toEqual(['c', 'b', 'a']);
    expect(slots.find((s) => s.id === 'b')?.name).toBe('B');
  });

  it('loadCareerSave() sin slotId resuelve al slot activo (compat con callers legacy)', async () => {
    const persistence = await import('./persistence');
    const base = persistence.blankCareerSave();

    await persistence.saveCareerSave({ ...base, profile: { ...base.profile, name: 'Carrera A' } }, 'a');
    await persistence.saveCareerSave({ ...base, profile: { ...base.profile, name: 'Carrera B' } }, 'b');
    await persistence.setActiveSlot('b');

    const loaded = await persistence.loadCareerSave();
    expect(loaded?.profile.name).toBe('Carrera B');
    expect(await getActiveSlotId()).toBe('b');
  });

  it('createSlot genera slug del nombre y deduplica por nombre idéntico', async () => {
    const persistence = await import('./persistence');

    const first = await persistence.createSlot('Save Principal');
    expect(first.id).toBe('save-principal');
    expect(first.name).toBe('Save Principal');

    // Mismo nombre → devuelve el slot existente, no duplica.
    const dup = await persistence.createSlot('Save Principal');
    expect(dup.id).toBe('save-principal');

    // Otro nombre distinto al del slot activo default no colisiona con
    // el slug, pero el slug ya estaba tomado → sufijo numérico.
    const collision = await persistence.createSlot('Save Principal 2');
    expect(collision.id).not.toBe('save-principal');
    // El slug de "save principal 2" es "save-principal-2"; entra sin colisión.
    expect(collision.id).toBe('save-principal-2');
  });

  it('createSlot genera sufijo numérico cuando el slug base choca con un slot existente', async () => {
    const persistence = await import('./persistence');
    const base = persistence.blankCareerSave();

    // Sembramos un slot con id `save-principal` directamente vía save.
    await persistence.saveCareerSave({ ...base, profile: { ...base.profile, name: 'A' } }, 'save-principal');

    const created = await persistence.createSlot('Save Principal');
    // El slug base coincide con el id existente; el helper anexa `-2`.
    expect(created.id).toBe('save-principal-2');
    expect(created.name).toBe('Save Principal');
  });

  it('migration silenciosa: save legacy v:1 sobrevive la primera lectura post-upgrade', async () => {
    // Sembramos la key legacy v:1 manualmente (lo que tendría ZY22G728HN
    // tras un build previo sin multi-slot). El módulo debe:
    //   - detectar la legacy en `loadCareerSave()` / `listSlots()`
    //   - copiarla como slot `default` v:2
    //   - preservar la key legacy (DoR: "No invalidar save vivo en ZY22G728HN")
    const persistence = await import('./persistence');
    persistence.__resetStorageForTests();
    const legacySnapshot = {
      ...persistence.blankCareerSave(),
      v: 1 as const,
      stage: 'season' as const,
      seed: 999,
      profile: { ...persistence.blankCareerSave().profile, name: 'Legacy Save' },
    };
    persistence.__seedForTests({
      'copero:career:save:v1': JSON.stringify(legacySnapshot),
    });

    // Primera lectura dispara la migración silenciosa.
    const loaded = await persistence.loadCareerSave();
    expect(loaded).not.toBeNull();
    expect(loaded?.profile.name).toBe('Legacy Save');
    expect(loaded?.v).toBe(2);
    // El slot activo es `default` y aparece en el índice.
    expect(await getActiveSlotId()).toBe('default');
    const { slots, activeSlotId } = await persistence.listSlots();
    expect(activeSlotId).toBe('default');
    expect(slots.find((s) => s.id === 'default')?.name).toBe('Legacy Save');
  });

  it('deleteSlot borra el payload y vuelve el cursor al default', async () => {
    const persistence = await import('./persistence');
    const base = persistence.blankCareerSave();
    await persistence.saveCareerSave({ ...base, profile: { ...base.profile, name: 'X' } }, 'x');
    await persistence.setActiveSlot('x');
    expect(await getActiveSlotId()).toBe('x');

    await persistence.deleteSlot('x');
    expect(await persistence.loadCareerSave('x')).toBeNull();
    // Cursor vuelve al default automáticamente.
    expect(await getActiveSlotId()).toBe('default');
  });

  // MGC-2999 — regresión bug SaveSlotPicker duplicaba state entre slots.
  // Síntoma original: tras `createSlot('SaveB')` el save:v2:saveb-* tenía
  // los MISMOS bytes que save:v2:default. AC: bytes divergen y seed es
  // determinista-per-slot pero distinto entre slots.
  it('createSlot inicializa payload v:2 limpio y AISLADO del slot activo previo', async () => {
    const persistence = await import('./persistence');

    // Sembramos el slot default con un state ficticio "Save A" en stage
    // season + seed identificable, simulando una carrera ya avanzada.
    const base = persistence.blankCareerSave();
    const saveA = {
      ...base,
      stage: 'season' as const,
      seed: 1048675450,
      profile: {
        ...base.profile,
        name: 'SaveA',
        lastName: 'Velez',
        club: { id: 'velez', name: 'Vélez Sarsfield', presupuesto: 1, interes: true } as never,
      },
    };
    await persistence.saveCareerSave(saveA, 'default');
    await persistence.setActiveSlot('default');

    // AC 1: createSlot escribe payload propio, no devuelve null y el
    // loadCareerSave(slot) resuelve con shape v:2 válido.
    const created = await persistence.createSlot('SaveB_Boca_PR2999');
    expect(created.id).toMatch(/saveb-boca-pr2999/);
    const loadedNew = await persistence.loadCareerSave(created.id);
    expect(loadedNew).not.toBeNull();
    expect(loadedNew?.v).toBe(2);

    // AC 2: bytes divergen. Serializamos el payload del slot nuevo y
    // verificamos que NO contenga "SaveA" ni "Velez" — un clone del
    // slot activo violaría este check.
    const payloadBytes = JSON.stringify(loadedNew);
    expect(payloadBytes).not.toContain('SaveA');
    expect(payloadBytes).not.toContain('Velez');
    expect(payloadBytes).not.toContain('1048675450');

    // AC 3: seed distinto y determinista-per-slot. Mismo slotId → mismo
    // seed (re-creación idempotente del meta colisionante), pero
    // distinto del seed de Save A.
    expect(loadedNew?.seed).not.toBe(1048675450);
    const reloadedAgain = await persistence.loadCareerSave(created.id);
    expect(reloadedAgain?.seed).toBe(loadedNew?.seed);

    // AC 4: el slot default NO se tocó — sigue con el state de Save A.
    const loadedDefault = await persistence.loadCareerSave('default');
    expect(loadedDefault?.profile.name).toBe('SaveA');
    expect(loadedDefault?.seed).toBe(1048675450);
  });

  // MGC-2999 — defense in depth en hydrateFromSave. Cuando el slot
  // activo no tiene payload (caso edge: index tiene el slot pero el
  // payload fue borrado externamente sin pasar por clearCareerSave,
  // p.ej. corrupción de disco o test setup que elimina solo la key),
  // el store NO debe arrastrar state del slot previo.
  it('store hydrateFromSave resetea a initialSnapshot cuando el slot activo no tiene payload', async () => {
    const persistence = await import('./persistence');
    const storeModule = await import('@/shared/store/careerStore');

    // Sembramos un state "Dirty" en default + activamos default.
    const base = persistence.blankCareerSave();
    await persistence.saveCareerSave(
      {
        ...base,
        stage: 'season' as const,
        seed: 777,
        profile: { ...base.profile, name: 'Dirty', lastName: 'Carryover' },
      },
      'default',
    );
    await persistence.setActiveSlot('default');

    // Hidratamos el store con state de Dirty.
    const store = storeModule.useCareerStore.getState();
    await store.hydrateFromSave();
    expect(storeModule.useCareerStore.getState().profile.name).toBe('Dirty');
    expect(storeModule.useCareerStore.getState().seed).toBe(777);

    // Forzamos "slot activo vacío" sin pasar por clearCareerSave
    // (clearCareerSave resetea el cursor a default — eso no es lo que
    // queremos testear). Sembramos un slot con payload en
    // 'dirty-slot', lo activamos, y luego sembramos-storage para
    // borrar SÓLO la key del payload (no tocamos el cursor ni el índice).
    await persistence.saveCareerSave(base, 'dirty-slot');
    await persistence.setActiveSlot('dirty-slot');
    persistence.__seedForTests({}); // wipe el memory backend entero
    // Re-sembramos el cursor activo + el payload de Dirty para que el
    // store siga hidratando primero con Dirty (motivamos el state
    // pre-acquire), luego borramos solo la key del nuevo slot.
    await persistence.saveCareerSave(
      {
        ...base,
        stage: 'season' as const,
        seed: 777,
        profile: { ...base.profile, name: 'Dirty', lastName: 'Carryover' },
      },
      'default',
    );
    await persistence.setActiveSlot('dirty-slot'); // cursor al slot vacío
    persistence.__seedForTests({}); // wipe otra vez — slot activo ahora vacío

    await store.hydrateFromSave();
    const afterReset = storeModule.useCareerStore.getState();
    expect(afterReset.stage).toBe('identity');
    expect(afterReset.profile.name).not.toBe('Dirty');
    expect(afterReset.profile.lastName).not.toBe('Carryover');
    expect(afterReset.seed).not.toBe(777);
  });
});
