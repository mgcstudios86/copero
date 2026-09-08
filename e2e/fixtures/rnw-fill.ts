import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Helper para llenar inputs de React Native Web que no propagan `onChangeText`
 * ni con `page.fill()` ni con `pressSequentially()` en el runner self-hosted
 * (Chromium headless Mac ARM64). El problema: el `value` se setea pero el
 * evento `input` que React usa para `useState` no se dispara antes del primer
 * paint post-hidratacion, dejando `canContinue()` en false y el botón
 * `btn-identity-continue` con `disabled=true`.
 *
 * Solución (MGC-2451 v6) — hidratación primero + fill canónico:
 *   1. focus (con fallback programático si el click forzado queda bloqueado
 *      por un overlay de capture pointer-events, ej. dropdown de país).
 *   2. waitForHydration: bloquea hasta que React 18 haya terminado de
 *      hidratar el elemento (chequea __reactProps$xxx / __reactFiber$xxx
 *      en el DOM node). Sin este wait, los eventos de Playwright se
 *      pierden porque el listener delegado de React aún no está attached
 *      en el root container.
 *   3. locator.fill(value) — la API canónica de Playwright. Internamente:
 *        a. Hace focus si no está focused.
 *        b. Setea el value via el setter nativo del prototipo
 *           (bypasea el value tracker de React para que detecte el cambio).
 *        c. Dispara eventos `input` y `change` con bubbles: true.
 *      Esto cubre tanto el path onChange (React -> native input) como
 *      onChangeText (RNW TextInput -> native input). Acepta chars
 *      no-ASCII (ñ, á, emoji) directamente.
 *   4. expect(input).toHaveValue(value) — web-first assertion con retry
 *      5s default.
 *
 * Historial de iteraciones sobre PR #544:
 *   v2 (eb718d5): wrap down + press + up por char -> duplica chars
 *                 ("CALVO" -> "CCAALLVVOO").
 *   v3 (d72da6d): solo keyboard.press por char -> arregla duplicación
 *                 pero 8/23 specs fallan (events perdidos pre-hidratación).
 *   v4 (680761f): insertText + setter nativo + change event -> mismo síntoma.
 *   v5 (316e93f): + waitForHydration antes de tipear -> race sigue.
 *   v6 (esta):    hydration + fill() canónico. La API fill ya hace
 *                 exactamente lo que RTL recomienda; con hidratación
 *                 asegurada, React está listo para recibir el input event.
 *
 * Refs: MGC-2254 v3, MGC-2356, MGC-2403, MGC-2451.
 */

async function focusInput(input: Locator): Promise<void> {
  try {
    await input.scrollIntoViewIfNeeded();
    await input.click({ force: true, timeout: 5000 });
  } catch {
    // Fallback: foco programático si el click force sigue bloqueado por un
    // overlay que capture pointer events a nivel de captura de Playwright.
    await input.evaluate((el: HTMLInputElement): void => {
      el.focus({ preventScroll: true });
    });
  }
}

async function waitForHydration(page: Page, input: Locator): Promise<void> {
  // Espera activa hasta que React 18 haya terminado de hidratar el elemento.
  // La señal canónica es que el DOM node tenga __reactProps$xxx (React 18)
  // o __reactInternalInstance$xxx (React 16/17) attached. Sin este wait,
  // dispatchEvent('input') se pierde porque el listener delegado de React
  // aún no está attached en el root.
  const testId: string | null = await input.evaluate((el: Element): string | null => {
    return el.getAttribute('data-testid');
  });
  await page.waitForFunction(
    (tid: string | null): boolean => {
      if (!tid) return true; // Si no hay testID, no podemos verificar
      const el = document.querySelector(`[data-testid="${tid}"]`);
      if (!el) return false;
      const keys = Object.keys(el);
      return keys.some(
        (k) =>
          k.startsWith('__reactProps$') ||
          k.startsWith('__reactFiber$') ||
          k.startsWith('__reactInternalInstance$'),
      );
    },
    testId,
    { timeout: 10_000 },
  );
}

async function forceReactReconcile(input: Locator, value: string): Promise<void> {
  // Belt-and-suspenders: tras el fill canónico de Playwright, garantizamos
  // que el value del DOM sea exactamente lo tipeado y disparamos `input`
  // y `change` para cubrir cualquier rama de React 17/18 que el fill haya
  // dejado colgada. Setter nativo para que el value tracker de React
  // detecte el cambio y dispare onChange.
  await input.evaluate(
    (el: HTMLInputElement, val: string): void => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      if (setter) {
        setter.call(el, val);
      } else {
        el.value = val;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    },
    value,
  );
}

export async function fillRnw(
  input: Locator,
  value: string,
  opts: { delay?: number } = {},
): Promise<void> {
  const { delay = 30 } = opts;
  await focusInput(input);

  const page: Page = input.page();

  // Esperar a que React termine de hidratar el elemento. Sin esto, el
  // listener delegado de React 18 en el root aún no está attached y los
  // `input` events del fill() se pierden (race condition del runner
  // self-hosted copero-ci-runner-02 con la hidratación tardía de RNW).
  await waitForHydration(page, input);

  // Si el input ya tiene value previo (ej. tests que reutilizan state),
  // limpiamos primero para que fill no concatene caracteres.
  const current = await input.inputValue().catch(() => '');
  if (current !== '' && current !== value) {
    await input.fill('');
  }

  // API canónica de Playwright: focus + native setter + dispatch
  // 'input' + 'change' (bubbles: true). Acepta ñ/á/emoji.
  await input.fill(value);

  // Belt-and-suspenders: por si la primera cadena de eventos no enganchó
  // el onChange de RNW (RNW usa handleChange -> onChangeText; en algunas
  // versiones el chain se rompe en el listener delegado), re-disparamos.
  await forceReactReconcile(input, value);

  // expect() de @playwright/test es una web-first assertion: reintenta hasta
  // 5s por default hasta que el DOM refleje el value.
  await expect(input).toHaveValue(value);

  if (delay > 0) await page.waitForTimeout(delay);
}

export async function fillRnwByTestId(
  page: Page,
  testId: string,
  value: string,
  opts: { delay?: number } = {},
): Promise<void> {
  return fillRnw(page.getByTestId(testId), value, opts);
}