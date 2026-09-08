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
 * Solución (MGC-2451 v8) — hidratación del ROOT + dispatch sintético:
 *   1. focus (con fallback programático si el click forzado queda bloqueado
 *      por un overlay de capture pointer-events, ej. dropdown de país).
 *   2. waitForReactRoot: espera activa hasta que el ROOT container de React
 *      (no solo el input) tenga __reactContainer$xxx attached. Sin esta
 *      garantía, los eventos que disparamos se pierden porque el listener
 *      delegado de React 18 en el root aún no está attached. El check
 *      anterior sobre __reactProps$xxx del input (v5/v6) era insuficiente:
 *      el fiber del input puede existir mientras el delegated listener del
 *      root todavía no, por la hidratación asíncrona de RNW en el runner.
 *   3. Clear previo: triple-click para seleccionar todo + Backspace. Garantiza
 *      que fill no concatene caracteres cuando el input ya tenía value.
 *   4. Native setter + dispatch `input`/`change` con InputEvent:
 *        a. Setter nativo de HTMLInputElement.prototype.value (bypasea el
 *           value tracker de React para que detecte el cambio).
 *        b. dispatchEvent(new InputEvent('input', { bubbles: true,
 *           cancelable: true, data: value, inputType: 'insertText' }))
 *           → path canónico RNW TextInput (onChangeText bridgea al
 *           delegateInput listener de React 18 en el root).
 *        c. dispatchEvent(new Event('change', { bubbles: true })) por las
 *           ramas onChange que RNW también expone.
 *      Acepta chars no-ASCII (ñ, á, emoji) directamente via InputEvent.data.
 *   5. expect(input).toHaveValue(value) — web-first assertion con retry 5s
 *      default. Bloquea hasta que el DOM refleje el value (lo cual también
 *      valida que la cadena setter→dispatch llegó al DOM).
 *   6. Pausa de 50 ms post-fill para que React 18 commitee el state update
 *      antes del siguiente evento (los inputs consecutivos en el form —
 *      p.ej. input-name + input-lastname — comparten un mismo commit y si
 *      el siguiente fill ocurre antes de que el primero commitée, el
 *      segundo onChange se procesa sincrónicamente y React puede descartar
 *      el primero por batching).
 *
 * Historial de iteraciones sobre PR #544:
 *   v2 (eb718d5): wrap down + press + up por char -> duplica chars
 *                 ("CALVO" -> "CCAALLVVOO").
 *   v3 (d72da6d): solo keyboard.press por char -> arregla duplicación
 *                 pero 8/23 specs fallan (events perdidos pre-hidratación).
 *   v4 (680761f): insertText + setter nativo + change event -> mismo síntoma.
 *   v5 (316e93f): + waitForHydration antes de tipear -> race sigue.
 *   v6 (cee820b): hydration input + fill() canónico -> 8/23 FAIL.
 *   v7 (b098094): expect(toBeVisible) sobre btn-number-plus -> tapona
 *                 un testID stale (removido por MGC-1647) y NO resuelve el
 *                 root cause del fill.
 *   v8 (esta):    waitForReactRoot (no solo el input) + InputEvent con
 *                 data/inputType explícitos + pausa post-fill 50ms.
 *                 Tipos TS explícitos en todos los callbacks (no any).
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

/**
 * Espera activa hasta que el ROOT container de React (no solo el input)
 * tenga `__reactContainer$xxx` attached. Esto garantiza que el listener
 * delegado de React 18 (que es donde se procesan los eventos `input`
 * burbujeados desde los inputs) esté attached. Sin este check, los eventos
 * se disparan antes de que el root esté listo y se pierden silenciosamente.
 */
async function waitForReactRoot(page: Page, input: Locator): Promise<void> {
  const testId: string | null = await input.evaluate((el: Element): string | null => {
    return el.getAttribute('data-testid');
  });
  await page.waitForFunction(
    (tid: string | null): boolean => {
      if (!tid) return false;
      const el = document.querySelector(`[data-testid="${tid}"]`);
      if (!el) return false;
      // Sube por la cadena de padres hasta encontrar un __reactContainer$xxx.
      // El root container es lo que React 18 usa para registrar el
      // delegated event listener; sin él los eventos se pierden.
      let node: Element | null = el;
      while (node) {
        const keys = Object.keys(node);
        if (keys.some((k) => k.startsWith('__reactContainer$'))) {
          return true;
        }
        node = node.parentElement;
      }
      return false;
    },
    testId,
    { timeout: 15_000 },
  );
}

async function forceReactReconcile(input: Locator, value: string): Promise<void> {
  // Setter nativo para que el value tracker de React detecte el cambio y
  // dispatchee onChange. Usamos InputEvent (no Event genérico) porque el
  // bridge de RNW TextInput inspecciona `data` e `inputType` del InputEvent
  // para enrutar a onChangeText.
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
      el.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          data: val,
          inputType: 'insertText',
        }),
      );
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

  // Esperar a que el ROOT container de React esté hidratado. Sin esto, los
  // `input` events se pierden porque el listener delegado de React 18
  // todavía no está attached en el root (race del runner self-hosted con
  // la hidratación asíncrona de RNW).
  await waitForReactRoot(page, input);

  // Limpiar si el input ya tiene value previo (tests que reutilizan state).
  // Triple-click selecciona todo el contenido + Backspace lo borra vía
  // keyboard events (más nativo que input.fill('') que despacha eventos
  // que podrían ser filtrados por el wrapper de RNW).
  const current = await input.inputValue().catch(() => '');
  if (current !== '' && current !== value) {
    await input.click({ clickCount: 3, force: true });
    await page.keyboard.press('Backspace');
  }

  // Native setter + InputEvent con data/inputType. Dispara onChange del
  // controlled input de RNW TextInput. Acepta chars no-ASCII (ñ/á/emoji).
  await forceReactReconcile(input, value);

  // Web-first assertion: reintenta hasta 5s default hasta que el DOM
  // refleje el value.
  await expect(input).toHaveValue(value);

  // Pausa corta para que React 18 commitee el state update antes del
  // siguiente fill. Sin esto, dos fills consecutivos (p.ej. input-name +
  // input-lastname) pueden batchearse en un mismo commit y React descarta
  // el primero.
  await page.waitForTimeout(delay + 20);
}

export async function fillRnwByTestId(
  page: Page,
  testId: string,
  value: string,
  opts: { delay?: number } = {},
): Promise<void> {
  return fillRnw(page.getByTestId(testId), value, opts);
}
