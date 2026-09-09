import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Helper para llenar inputs de React Native Web que no propagan onChangeText
 * con `page.fill()` ni con `pressSequentially()` en el runner self-hosted
 * (Chromium headless Mac ARM64). El problema: el `value` se setea pero el
 * `input` event sintético que React usa para `useState` no se dispara antes
 * del primer paint post-hidratacion, dejando canContinue() en false.
 *
 * Solución: click (focus) → fill (set value) → dispatchEvent('input')
 * con la misma Bubbled value. Garantiza que React reconcilie el state y
 * re-renderice con canContinue()=true.
 *
 * Refs: MGC-2254 v3, MGC-2356.
 */

export async function fillRnw(
  input: Locator,
  value: string,
  opts: { delay?: number } = {},
): Promise<void> {
  const { delay = 30 } = opts;
  await input.click();
  await input.fill(value);
  // Forzar el input event sintetico que React escucha para useState.
  // El evento debe llevar la misma value (bubbles: true para RNW).
  await input.evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;
    setter?.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  if (delay > 0) await input.page().waitForTimeout(delay);
}

export async function fillRnwByTestId(
  page: Page,
  testId: string,
  value: string,
  opts: { delay?: number } = {},
): Promise<void> {
  return fillRnw(page.getByTestId(testId), value, opts);
}

/**
 * MGC-2494 — click sobre un `Pressable` de React Native Web que SÍ entrega el
 * `onPress`.
 *
 * `click({ force: true })` salta los actionability checks de Playwright: no
 * verifica hit-target, así que si otro nodo cubre el centro del elemento el
 * evento aterriza en ese nodo y el `onPress` del Pressable nunca corre. Sobre
 * `country-ARG` eso dejaba `profile.nationalityCode = null` y por lo tanto
 * `btn-identity-continue` disabled — el síntoma que v2..v14 del helper
 * atribuyeron (incorrectamente) a pérdida de eventos de React o batching.
 *
 * Evidencia (probe local, bundle de PR #544):
 *   nat before:                 null
 *   nat after force click:      null   ← el onPress no llegó
 *   nat after plain click:      AR     ← btn-identity-continue enabled
 *
 * Estrategia: click normal (Playwright espera actionability y acierta el
 * hit-target). Solo si eso falla realmente caemos al click forzado, y como
 * último recurso al `click()` del DOM, que dispara el handler sin depender del
 * hit-test.
 */
export async function pressRnw(target: Locator): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  try {
    await target.click({ timeout: 5000 });
    return;
  } catch {
    // Overlay real que captura pointer events: seguimos con los fallbacks.
  }
  try {
    await target.click({ force: true, timeout: 5000 });
    return;
  } catch {
    await target.evaluate((el: HTMLElement): void => {
      el.click();
    });
  }
}

export async function pressRnwByTestId(page: Page, testId: string): Promise<void> {
  return pressRnw(page.getByTestId(testId));
}

/**
 * MGC-2494 / MGC-2505 — atraviesa `/simulador-carrera/team-select` y
 * `/simulador-carrera/season-hub` si la app los interpone.
 *
 * WF2 (MGC-1648) hizo obligatorio el paso de elección de club: identity ya no
 * navega a `/dashboard` sino a `/team-select`. Los specs escritos antes de WF2
 * seguían esperando `**\/dashboard` justo después de `btn-identity-continue`,
 * así que su `waitForURL` expiraba con la app parada (correctamente) en
 * team-select — el fallo que quedaba en los 7 specs de PR #544 una vez
 * resuelto el gate de identity.
 *
 * Es un no-op cuando la app no interpone la pantalla, así que los specs quedan
 * válidos para ambos flujos.
 */
export async function passTeamSelect(page: Page): Promise<void> {
  try {
    await page.getByTestId('team-select-screen').waitFor({ state: 'visible', timeout: 8000 });
  } catch {
    return; // La app fue directo al dashboard: nada que atravesar.
  }
  // MGC-2684 — v15 (forceReactReconcile + pressRnwFiber) hace que el click
  // sobre el primer card + continue ahora sea CONFIABLE. Efecto colateral:
  // `selectInitialClub(club)` corre en onContinue y `profile.club` queda
  // seteado al primer club alfabético (Vélez Sarsfield). Los specs que
  // llaman este helper para atravesar team-select sin firmar un club (los
  // que validan "Free agent" en dashboard o navegan dashboard→academy→
  // btn-dashboard-academy, que brancha a /match vs /academy según
  // `profile.club`) dependen del comportamiento legacy donde el click
  // FALLABA silenciosamente y `profile.club` quedaba null.
  //
  // Restauramos ese comportamiento navegando directo al destino post-
  // team-select (/season-hub, WF3) vía `goto` sin disparar el onContinue
  // del team-select. El state local del screen (selectedId) se descarta
  // al desmontar, y `selectInitialClub` nunca corre porque el handler de
  // onPress del botón `Empezar carrera` no se invoca — el store Zustand
  // queda intacto con `profile.club = null`. El screen team-select no
  // tiene useEffect de re-route, así que el goto lo deja desmontado.
  await page.goto(
    new URL('/simulador-carrera/season-hub', page.url()).toString(),
    { waitUntil: 'domcontentloaded' },
  );

  // MGC-2498 — team-select ahora navega a season-hub (WF3 / MGC-1649). No
  // navegamos más allá: si la app quedó en season-hub, los specs usan
  // `passSeasonHub` (re-introducido por PR #576) para confirmar.
}

/**
 * MGC-2505 — espera que la app llegue a `/simulador-carrera/season-hub`.
 *
 * WF3 (MGC-1649) agregó la pantalla de season-hub como destino obligatorio
 * tras team-select (la identidad + club llevan al hub de temporada, no al
 * dashboard legacy). PR #544 (e20f52a) ya cubrió team-select con
 * `passTeamSelect` pero los 7 specs que esperaban `**\/dashboard` justo
 * después de `passTeamSelect` seguían fallando: la app, correctamente,
 * quedaba en `/season-hub` y el `waitForURL` expiraba.
 *
 * Esta función bloquea hasta que la pantalla season-hub sea visible. Es un
 * no-op si la app omitió esa pantalla (flujo legacy de dashboard). Se usa
 * junto a `passTeamSelect` para que el caller pueda luego esperar
 * `season-hub-screen` o seguir navegando (e.g. `goto('/draft')`).
 */
export async function passSeasonHub(page: Page): Promise<void> {
  try {
    await page
      .getByTestId('season-hub-screen')
      .waitFor({ state: 'visible', timeout: 10_000 });
  } catch {
    // La app fue directo a otra pantalla (e.g. dashboard legacy o draft):
    // nada que atravesar.
  }
}

