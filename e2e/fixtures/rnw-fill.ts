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
 * Solución (MGC-2451 v5) — esperar hidratación + patrón canónico RTL:
 *   1. focus (con fallback programático si el click forzado queda bloqueado
 *      por un overlay de capture pointer-events, ej. dropdown de país).
 *   2. waitForHydration: bloquea hasta que React 18 haya terminado de
 *      hidratar el elemento (chequea __reactProps$xxx / __reactFiber$xxx
 *      en el DOM node). Sin este wait, dispatchEvent se pierde porque
 *      el listener delegado de React aún no está attached en el root.
 *   3. keyboard.insertText(value) — dispara un único `input` event con la
 *      string entera (acepta ñ/á/emoji sin pasar por key mapping).
 *   4. Post-loop, fuerza reconciliación React con el patrón canónico
 *      React Testing Library: setter nativo de HTMLInputElement.value
 *      (bypaseando cualquier override de React en la instancia) +
 *      dispatch de ambos eventos `input` y `change` (bubbles: true).
 *   5. expect(input).toHaveValue(value) — web-first assertion con retry
 *      5s default; bloquea hasta que el `value` del DOM refleje exactamente
 *      lo tipeado.
 *
 * Historial de iteraciones sobre PR #544:
 *   v2 (eb718d5): wrap down + press + up por char -> duplica chars
 *                 ("CALVO" -> "CCAALLVVOO").
 *   v3 (d72da6d): solo keyboard.press por char -> arregla duplicación
 *                 pero 8/23 specs aún fallan (events perdidos pre-hidratación).
 *   v4 (680761f): insertText + setter nativo + change event -> mismo
 *                 síntoma, race con hidratación.
 *   v5 (esta):    + waitForHydration antes de tipear. Garantiza que el
 *                 listener delegado de React esté attached.
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
  // Patrón canónico de React Testing Library: setear via el setter nativo
  // del prototipo (bypasea cualquier override que React haga en la instancia)
  // y despachar ambos eventos `input` y `change`. Esto cubre los dos paths
  // que RNW usa:
  //   - onChange (React) -> native `input` event (inputs/textareas)
  //   - onChangeText (RNW TextInput) -> native `input` event
  // En React 17+ ambos pasan por el mismo listener delegado en el root, así
  // que un solo dispatch alcanza, pero emitimos ambos para máxima
  // compatibilidad con RNW que en algunas versiones registra `change` por
  // separado.
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
  // `input` events se pierden (race condition del runner self-hosted
  // copero-ci-runner-02 con la hidratación tardía de RNW).
  await waitForHydration(page, input);

  // Si el input ya tiene value previo (ej. tests que reutilizan state),
  // limpiamos primero para que insertText no concatene caracteres.
  const current = await input.inputValue().catch(() => '');
  if (current !== '') {
    await input.fill('');
  }

  if (value.length > 0) {
    // insertText dispara un único `input` event con la string entera. Acepta
    // chars no-ASCII (ñ, á, emoji) sin pasar por key mapping. Más rápido y
    // determinista que `press` por caracter.
    await page.keyboard.insertText(value);
  }

  // Forzar reconciliación React. insertText ya dispara `input`, pero por
  // seguridad también aplicamos el patrón canónico RTL: setter nativo +
  // dispatch explícito de `input` y `change` para garantizar que `useState`
  // reciba el value final.
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