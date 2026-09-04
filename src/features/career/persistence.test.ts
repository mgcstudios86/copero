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
    const { NO_MODIFIERS } = await import('./events');

    // MGC-1730 — explicitamos los 3 campos F3.2 con defaults antes del
    // round-trip. Sin esto, `hydrateF3Fields` los materializa con
    // `null/NO_MODIFIERS/null` al cargar y la comparación `toEqual`
    // rompe (espera `undefined`).
    const snapshot = {
      ...blankCareerSave(),
      stage: 'draft' as const,
      seed: 42,
      postMatchPending: null,
      nextWeekModifiers: { ...NO_MODIFIERS },
      transferState: null,
    };
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

  /**
   * MGC-1730 (MEDIUM-1 review CTO sobre PR #425) — round-trip save→load
   * con los 3 campos F3.2 poblados. Antes este test no existía: el
   * contrato "los 3 campos se persisten" quedaba en JSDoc pero ningún
   * lock lo probaba, y un bug de serialización (por ejemplo un campo
   * `undefined` que se materialize a `null` por JSON.stringify) hubiera
   * pasado desapercibido.
   *
   * Verifica:
   *   1. `postMatchPending` con todos sus campos (id/copyId/rating/week/
   *      luckGatePassed) round-trippea idéntico.
   *   2. `nextWeekModifiers` (todos los 6 deltas) round-trippea idéntico.
   *   3. `transferState` (verdict + offers + acceptedOfferId + resolved +
   *      decisionDeadline + season) round-trippea idéntico.
   *   4. El save re-cargado se mantiene en v:2 (no se bump-ea a v:3).
   */
  it('MGC-1730 round-trippea postMatchPending + nextWeekModifiers + transferState', async () => {
    const { saveCareerSave, loadCareerSave, clearCareerSave, blankCareerSave } =
      await import('./persistence');
    const { createRng } = await import('./rng');
    const { evaluateTransfer } = await import('./transfers');

    await clearCareerSave();

    const transferState = evaluateTransfer(
      {
        avgRating: 8.5,
        goals: 12,
        tablePos: 2,
        position: 'CM',
        age: 24,
        season: 2,
        seasonEndWeek: 38,
        currentClubId: 'velez',
      },
      createRng(7777),
    );

    const snapshot = {
      ...blankCareerSave(),
      stage: 'season' as const,
      seed: 99,
      postMatchPending: {
        id: 'fiesta' as const,
        copyId: 'post_match_fiesta',
        rating: 8.2,
        week: 5,
        luckGatePassed: true,
      },
      nextWeekModifiers: {
        luckBonus: 0.12,
        trainingBoost: 1,
        injuryRiskMul: 1.5,
        moralDelta: 6,
        fatigueDelta: -12,
        confianzaDelta: 2,
      },
      transferState,
    };

    await saveCareerSave(snapshot);
    const loaded = await loadCareerSave();

    expect(loaded).not.toBeNull();
    expect(loaded?.v).toBe(2);
    expect(loaded?.postMatchPending).toEqual(snapshot.postMatchPending);
    expect(loaded?.nextWeekModifiers).toEqual(snapshot.nextWeekModifiers);
    expect(loaded?.transferState).toEqual(snapshot.transferState);
  });

  /**
   * MGC-1730 (HIGH-2 review CTO sobre PR #425) — un save v:2 pre-F3.2
   * (sin los 3 campos nuevos) hidrata con defaults explícitos en vez de
   * `undefined`. Sin esto, la UI no podría distinguir "no hay modal" de
   * "el save está corrupto".
   */
  it('MGC-1730 hidrata defaults cuando un save v:2 no trae los 3 campos F3.2', async () => {
    const { saveCareerSave, loadCareerSave, clearCareerSave, blankCareerSave } =
      await import('./persistence');
    const { NO_MODIFIERS } = await import('./events');

    await clearCareerSave();
    // Simulamos un save v:2 que llegó a disco antes del F3.2 — los 3
    // campos están ausentes (`undefined`). `JSON.stringify` los omite
    // por completo, así que al re-parsear quedan `undefined`.
    await saveCareerSave({
      ...blankCareerSave(),
      stage: 'season' as const,
      seed: 7,
      // postMatchPending/nextWeekModifiers/transferState omitidos a propósito.
    });

    const loaded = await loadCareerSave();
    expect(loaded).not.toBeNull();
    expect(loaded?.postMatchPending).toBeNull();
    expect(loaded?.nextWeekModifiers).toEqual(NO_MODIFIERS);
    expect(loaded?.transferState).toBeNull();
  });
});
