/**
 * MGC-1736 (WF6) — tests del cleanup post-retiro en `fin-carrera.tsx`.
 *
 * AC: "Salir de fin-carrera sin confirmar deja el store sin cambios".
 * Esto se cumple con dos capas:
 *
 *   1. La pantalla expone el CTA destructivo vía `onRestart` (async) que
 *      llama `resetAll()` (NO `reset()`) y AWAITA el borrado antes de
 *      navegar. Si el usuario hace Back físico antes de tocar el CTA,
 *      `onRestart` no corre y el store queda intacto.
 *
 *   2. `resetAll()` drena `flushPendingSave()` ANTES del `clearCareerSave`
 *      para que una save en vuelo no resucite la carrera vieja en disco
 *      (datos fantasma del AC de no-mutación).
 *
 * Estos tests cubren la capa 2 (el action del store) + un test estático
 * que verifica que la pantalla NO llama `reset()` (sólo `resetAll`) — el
 * `reset()` legacy es fire-and-forget y no respeta el contrato awaitable.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { useCareerStore } from '@/shared/store/careerStore';
import {
  loadCareerSave,
  saveCareerSave,
  __resetStorageForTests,
} from '@/features/career/persistence';
import { initialSnapshot } from '@/features/career/identity-state';

vi.mock('expo-router', () => ({
  useRouter: () => ({ replace: () => undefined, push: () => undefined, back: () => undefined }),
}));

const savedCareer = (name: string) => ({
  v: 1 as const,
  stage: 'retirement' as const,
  profile: { ...initialSnapshot().profile, name },
  draft: null,
  card: null,
  clubId: null,
  log: { timeline: [], events: [] },
  seed: 42,
});

describe('MGC-1736 WF6 — fin-carrera no-mutación AC', () => {
  beforeEach(async () => {
    __resetStorageForTests();
    useCareerStore.getState().reset();
  });

  it('resetAll existe y es Promise-returning (awaitable, a diferencia de reset())', () => {
    const fn = useCareerStore.getState().resetAll;
    expect(typeof fn).toBe('function');
    // El retorno de una llamada sin await debe ser una Promise — esto es
    // lo que la pantalla AWAITA antes de navegar a /identity.
    const result = fn();
    expect(result).toBeInstanceOf(Promise);
    // drenamos para no contaminar el siguiente test
    return result;
  });

  it('resetAll deja AsyncStorage vacío al resolver (datos fantasma = AC no-mutación)', async () => {
    await saveCareerSave(savedCareer('Retirado-A'));
    expect(await loadCareerSave()).not.toBeNull();

    await useCareerStore.getState().resetAll();

    // Sin ningún await extra: el clear YA terminó cuando resetAll resolvió,
    // así /identity monta con disco vacío.
    expect(await loadCareerSave()).toBeNull();
  });

  it('resetAll deja el store en initialSnapshot (stage=identity)', async () => {
    await saveCareerSave(savedCareer('Retirado-B'));
    await useCareerStore.getState().hydrateFromSave();
    expect(useCareerStore.getState().stage).toBe('retirement');

    await useCareerStore.getState().resetAll();

    expect(useCareerStore.getState().stage).toBe('identity');
    expect(useCareerStore.getState().profile.name).toBe(initialSnapshot().profile.name);
  });

  it('3 corridas consecutivas: ninguna deja datos fantasma de la anterior', async () => {
    for (const name of ['Carrera-A', 'Carrera-B', 'Carrera-C']) {
      await saveCareerSave(savedCareer(name));
      await useCareerStore.getState().hydrateFromSave();
      expect(useCareerStore.getState().profile.name).toBe(name);

      await useCareerStore.getState().resetAll();

      expect(await loadCareerSave()).toBeNull();
      // Rehidratar tras el reset no debe resucitar la carrera anterior.
      const rehydrated = await useCareerStore.getState().hydrateFromSave();
      expect(rehydrated).toBe(false);
      expect(useCareerStore.getState().profile.name).toBe(initialSnapshot().profile.name);
    }
  });

  it('la pantalla NO llama reset() (sólo resetAll) — gate estático del AC no-mutación', async () => {
    // MGC-1736 AC: la pantalla lee `resetAll` desde el store. Si alguna
    // vez alguien refactorea y vuelve a `reset`, este test rompe.
    const src = await import('node:fs').then((m) =>
      m.promises.readFile(
        'src/features/simulador-carrera/screens/fin-carrera.tsx',
        'utf8',
      ),
    );

    // 1) La pantalla debe destructurar `resetAll` del store.
    expect(src).toMatch(/useCareerStore\([^)]*\)\s*=>\s*s\.resetAll/);
    // 2) La pantalla NO debe destructurar `reset` a secas (sería el
    //    fire-and-forget legacy que viola el AC).
    expect(src).not.toMatch(/useCareerStore\([^)]*\)\s*=>\s*s\.reset\b/);
    // 3) `onRestart` debe ser async y awaitar resetAll antes de navegar.
    //    Antes `[^}]*` rompía cuando el cuerpo contenía un object literal
    //    (p.ej. `trackGameEvent('career_restarted', { previousSeason: ... })`)
    //    porque el `}` interno del objeto cierra el match antes de llegar a
    //    `await resetAll`. Usar `[\s\S]*?` (non-greedy any char) refleja
    //    la intención real: "onRestart awaits resetAll" sin importar qué
    //    otro código haya en el cuerpo.
    expect(src).toMatch(/onRestart\s*=\s*async\s*\(\s*\)\s*=>\s*\{[\s\S]*?await\s+resetAll/);
  });

  it('MGC-481 — modal implementa 3 pasos visuales (confirm → spinner → nav) — gate estático PR #655 spec', async () => {
    // PR #655 (docs/flows/restart-limpio/flow.md) step 2: "Modal muestra
    // spinner 'Reiniciando…' durante el wipe". Antes este paso era
    // invisible: `restarting=true` sólo deshabilitaba los botones sin
    // feedback visual. El fix introduce la rama `restarting ? spinner :
    // confirm` en el render del modal con ActivityIndicator + texto i18n.
    // Si alguien refactorea y elimina la rama del spinner, este test
    // rompe — la cobertura de QA (MGC-481) y el spec PR #655 dependen
    // de ese feedback visual.
    const src = await import('node:fs').then((m) =>
      m.promises.readFile(
        'src/features/simulador-carrera/screens/fin-carrera.tsx',
        'utf8',
      ),
    );

    // 1) El modal debe importar ActivityIndicator para el spinner.
    expect(src).toMatch(/import\s*\{[^}]*\bActivityIndicator\b[^}]*\}\s*from\s*['"]react-native['"]/);
    // 2) Debe haber una rama condicional `restarting ? <spinner> : <confirm>`
    //    en el render del modal. La forma exacta puede variar, pero la
    //    presencia del ternario sobre `restarting` dentro del bloque del
    //    Modal es el contrato.
    expect(src).toMatch(/restarting\s*\?\s*\(/);
    // 3) El texto "Reiniciando" debe estar cableado vía i18n (no
    //    hardcoded — los 4 locales tienen que mostrar el feedback).
    expect(src).toMatch(/t\(['"]retire\.wipingTitle['"]\)/);
    expect(src).toMatch(/t\(['"]retire\.wipingBody['"]\)/);
    // 4) El testID del spinner debe existir para que QA lo apunte con
    //    Maestro (`- id: fin-carrera-wiping-spinner`).
    expect(src).toMatch(/testID\s*=\s*['"]fin-carrera-wiping-spinner['"]/);
    // 5) El evento `career_restarted` debe emitirse en `onRestart` para
    //    cumplir la post-condición de la spec PR #655
    //    ("Telemetría: analytics.career_reset emitida con payload
    //    { previousSeason, hadTrophies }").
    expect(src).toMatch(/trackGameEvent\(['"]career_restarted['"]/);
    expect(src).toMatch(/previousSeason\s*:/);
    expect(src).toMatch(/hadTrophies\s*:/);
  });
});