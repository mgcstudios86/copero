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
 * Solución (MGC-2451 v4) — combinación de tres mecanismos:
 *   1. focus (con fallback programático si el click forzado queda bloqueado
 *      por un overlay de capture pointer-events, ej. dropdown de país).
 *   2. keyboard.insertText(value) — dispara un único `input` event con la
 *      string entera (RNW acepta chars no-ASCII como ñ, á, emoji).
 *   3. Post-loop, fuerza reconciliación React con el patrón canónico
 *      React Testing Library: setter nativo de HTMLInputElement.value
 *      (bypaseando cualquier override de React) + dispatch de ambos
 *      eventos `input` y `change` (bubbles: true). Esto cubre tanto
 *      React 17 (que mapea `onChange` -> native `change`) como RNW
 *      (que mapea `onChangeText` -> native `input`).
 *   4. expect(input).toHaveValue(value) — web-first assertion con retry
 *      5s default; bloquea hasta que el `value` del DOM refleje exactamente
 *      lo tipeado.
 *
 * Historial de iteraciones sobre PR #544:
 *   v2 (eb718d5): wrap down + press + up por char -> duplica caracteres
 *                 (recibido "CCAALLVVOO" para "CALVO") porque cada keydown
 *                 adicional inserta otro char.
 *   v3 (d72da6d): solo keyboard.press por char -> arregla duplicación pero
 *                 8/23 specs aún fallan: btn-number-plus no aparece
 *                 porque React state quedó vacío (input event no se
 *                 propagó a useState post-hidratación).
 *   v4 (esta):    insertText + setter nativo + dispatch `input` y `change`
 *                 -> cubre los 3 mecanismos que RNW usa para `onChangeText`.
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

  // Forzar reconciliación React. insertText ya dispara `input`, pero en el
  // runner self-hosted copero-ci-runner-02 (Chromium headless Mac ARM64)
  // ese evento a veces se pierde en la carrera con la hidratación tardía
  // de RNW. El setter nativo + dispatch explícito es el último recurso
  // que garantiza que `useState` reciba el value final.
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