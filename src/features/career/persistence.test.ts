/**
 * Regresión MGC-282 — la partida no se restauraba tras force-stop.
 *
 * Causa: `persistence.ts` resolvía AsyncStorage con `eval('require')`.
 * Hermes no compila JS en runtime, así que en el APK la llamada tiraba
 * excepción, el `catch` caía al store en memoria y ningún snapshot llegaba
 * a disco. La sesión viva funcionaba; el relaunch mostraba el form
 * "Definí tu identidad" vacío.
 *
 * Estos tests lockean el contrato que no se puede verificar en node:
 * el módulo no debe contener `eval` y debe resolver el backend con un
 * `require` estático que Metro pueda inlinear en el bundle.
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

  it('round-trippea el snapshot y lo borra con el fallback en memoria', async () => {
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
      // MGC-1657 (F2.3) — v:1 y v:2 son ambas válidas; probamos una
      // versión futura desconocida (v:3) para confirmar que se descarta.
      v: 3 as unknown as 1,
    });
    expect(await loadCareerSave()).toBeNull();
  });
});
