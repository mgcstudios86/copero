/**
 * Regresión MGC-282 + MGC-363 — la partida no se restauraba tras force-stop.
 *
 * MGC-282 root cause: `persistence.ts` resolvía AsyncStorage con
 * `eval('require')`. Hermes no compila JS en runtime, así que en el APK
 * la llamada tiraba excepción, el `catch` caía al store en memoria y
 * ningún snapshot llegaba a disco. La sesión viva funcionaba; el
 * relaunch mostraba el form "Definí tu identidad" vacío.
 *
 * MGC-363 root cause (v3.x): el `default` export de
 * @react-native-async-storage/async-storage@3 dejó de ser el TurboModule
 * nativo y pasó a ser el shim web `getLegacyStorage()`. En Android/iOS
 * ese shim tira "Cannot read property 'localStorage' of undefined" al
 * primer setItem/getItem y el catch de `persistSnapshot` lo silenciaba.
 * La fix correcta es usar el named factory `createAsyncStorage(dbName)`
 * que apunta al TurboModule nativo `RNCAsyncStorage`, más un probe
 * async para confirmar que el bridge responde antes de aceptar el
 * backend.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const SOURCE = readFileSync(join(__dirname, 'persistence.ts'), 'utf8');

/** Código sin comentarios: los comentarios documentan el bug y nombran `eval`. */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('MGC-282 · backend de persistencia', () => {
  it('no usa eval (Hermes no lo soporta y rompe la persistencia en device)', () => {
    expect(CODE).not.toMatch(/\beval\s*\(/);
  });

  it('resuelve AsyncStorage con un require estático analizable por Metro', () => {
    expect(CODE).toContain(
      "require('@react-native-async-storage/async-storage')",
    );
  });
});

describe('MGC-363 · fix del default export de v3.x', () => {
  it('usa createAsyncStorage (factory del TurboModule nativo) y NO el default export', () => {
    // El default export en v3.x es getLegacyStorage() (web shim). Si el
    // código resuelve `mod?.default ?? mod` sigue cayendo al shim en
    // plataforma web y a "Native module is null" en nativo cuando el
    // shim no encuentra localStorage. El factory named retorna el
    // RNCAsyncStorage correcto.
    expect(CODE).toContain('createAsyncStorage');
    expect(CODE).not.toMatch(/mod\?\.default\s*\?\?\s*mod/);
  });

  it('probe async antes de aceptar el backend nativo', () => {
    // El probe confirma que setItem/getItem responden antes de fijar
    // resolved = native. Sin esto un build con autolinking roto caía al
    // shim web y el save fallaba silenciosamente en cada mutación.
    expect(CODE).toContain('PROBE_KEY');
    expect(CODE).toMatch(/setItem.*getItem.*removeItem/s);
  });

  it('round-trippea el snapshot y lo borra con el fallback en memoria', async () => {
    // Si vitest no mockea AsyncStorage, igual confirmamos save→load→clear.
    const {
      saveCareerSave,
      loadCareerSave,
      clearCareerSave,
      blankCareerSave,
    } = await import('./persistence');

    const snapshot = { ...blankCareerSave(), stage: 'draft' as const, seed: 42 };
    await saveCareerSave(snapshot);
    expect(await loadCareerSave()).toEqual(snapshot);

    await clearCareerSave();
    expect(await loadCareerSave()).toBeNull();
  });

  it('descarta un payload de versión distinta en vez de hidratar basura', async () => {
    const { saveCareerSave, loadCareerSave, clearCareerSave, blankCareerSave } =
      await import('./persistence');

    await clearCareerSave();
    await saveCareerSave({
      ...blankCareerSave(),
      v: 2 as unknown as 1,
    });
    expect(await loadCareerSave()).toBeNull();
  });
});
