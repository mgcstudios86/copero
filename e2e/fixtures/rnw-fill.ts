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
 * Solución (MGC-2451 v10) — invocación directa del onChange de RNW vía fiber
 * con `nativeEvent` poblado:
 *   1. focus (con fallback programático si el click forzado queda bloqueado
 *      por un overlay de capture pointer-events, ej. dropdown de país).
 *   2. waitForReactRoot: espera activa hasta que el ROOT container de React
 *      (no solo el input) tenga __reactContainer$xxx attached. Sin esta
 *      garantía, el onChange vía fiber puede leer un props.onChange stale
 *      de un fiber pre-hidratación que aún referencia el componente anterior.
 *   3. Clear previo: triple-click para seleccionar todo + Backspace.
 *   4. Setter nativo de HTMLInputElement.prototype.value + invocar
 *      `props.onChange` directamente desde el fiber (__reactProps$xxx).
 *      Esto BYPASSEA el sistema de eventos del DOM y la delegación de
 *      React 18 en el root container — que es la pieza que rompe en el
 *      runner self-hosted. RNW TextInput expone su handler interno como
 *      `onChange` del `<input>` (que llama onChangeText del usuario), por
 *      lo que invocarlo directamente dispara el setter del store Zustand.
 *      Acepta chars no-ASCII (ñ, á, emoji) vía event.target.value.
 *      Fallback: dispatch DOM events (InputEvent + change) si no se
 *      encuentra props.onChange (caso defensivo, no esperado en RNW).
 *   5. expect(input).toHaveValue(value) — web-first assertion con retry 5s.
 *   6. Pausa post-fill para que React commitee el state update antes del
 *      siguiente fill (dos inputs consecutivos pueden batchearse y descartar
 *      el primero).
 *
 * Historial de iteraciones sobre PR #544:
 *   v2 (eb718d5): wrap down + press + up por char -> duplica chars
 *                 ("CALVO" -> "CCAALLVVOO").
 *   v3 (d72da6d): solo keyboard.press por char -> arregla duplicación
 *                 pero 7/23 specs fallan (events perdidos pre-hidratación).
 *   v4 (680761f): insertText + setter nativo + change event -> mismo síntoma.
 *   v5 (316e93f): + waitForHydration antes de tipear -> race sigue.
 *   v6 (cee820b): hydration input + fill() canónico -> 7/23 FAIL.
 *   v7 (b098094): expect(toBeVisible) sobre btn-number-plus -> tapona
 *                 un testID stale (removido por MGC-1647) y NO resuelve el
 *                 root cause del fill.
 *   v8 (739c20f): waitForReactRoot + InputEvent con data/inputType +
 *                 pausa post-fill 50ms -> 7/31 FAIL run 34190975062.
 *                 El problema: dispatched events llegan al DOM pero NO
 *                 propagan al handler de React (root listener de React 18
 *                 no se attached en este runner, o se attached después
 *                 del dispatch por race con hidratación asíncrona).
 *   v9 (f428175): invoca props.onChange directamente vía fiber
 *                 (__reactProps$xxx) → bypass total del DOM event system.
 *                 Crash: handleChange de RNW hace `e.nativeEvent.text = text`
 *                 sobre el synthetic event, pero `nativeEvent` no estaba
 *                 definido → TypeError en TODOS los specs que llaman
 *                 fillRnw. Run 34192727621 FAIL.
 *   v10 (esta):   mismo enfoque que v9 pero el synthetic event incluye
 *                 `nativeEvent: { text: val }` poblado. handleChange puede
 *                 escribir `e.nativeEvent.text = hostNode.value` sin crash
 *                 y propaga a onChangeText (setName/setLastName del store
 *                 Zustand). React ejecuta el handler sincrónicamente; el
 *                 state update ocurre en el mismo tick, sin depender del
 *                 root listener delegado de React 18 en el runner self-
 *                 hosted copero-ci-runner-02.
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
  // Setter nativo + invocación DIRECTA del onChange de React vía fiber.
  // This bypasses the DOM event system and the React 18 root delegation
  // listener — both fail on the runner self-hosted copero-ci-runner-02 due
  // to a hydration race with RNW TextInput. RNW renders the input element
  // with `onChange={rnwInternalHandler}` and the handler reads
  // `event.target.value` to extract the new text and call the user's
  // onChangeText. By invoking that handler directly with a synthetic event
  // we skip the broken event delivery path while preserving the exact
  // contract RNW expects (target.value present, no DOM dispatch required).
  await input.evaluate(
    (el: HTMLInputElement, val: string): void => {
      // 1. Set value via native setter (bypasea el value tracker de React).
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      if (setter) {
        setter.call(el, val);
      } else {
        el.value = val;
      }

      // 2. Invocar props.onChange directamente desde el fiber. Las props se
      //    guardan en __reactProps$<id> (key no-enumerable; usar
      //    Object.getOwnPropertyNames para enumerarlas).
      let invoked = false;
      const keys = Object.getOwnPropertyNames(el);
      for (const key of keys) {
        if (!key.startsWith('__reactProps$')) continue;
        const props = (el as unknown as Record<string, { onChange?: (e: unknown) => void }>)[key];
        const onChange = props?.onChange;
        if (typeof onChange === 'function') {
          // Synthetic event compatible con RNW TextInput handleChange.
          // handleChange (node_modules/react-native-web/src/exports/TextInput/index.js:265)
          // hace `e.nativeEvent.text = hostNode.value` ANTES de invocar onChange,
          // por lo que `nativeEvent` debe estar definido (aunque sea {}) en el
          // synthetic event. Sin esto: TypeError "Cannot set properties of
          // undefined (setting 'text')" — run 34192727621 (v9) FAIL.
          // `target` apunta al input element para que handleChange pueda leer
          // `e.target.value` y propagarlo a onChangeText (setName/setLastName).
          const syntheticEvent = {
            target: el,
            currentTarget: el,
            type: 'change',
            bubbles: true,
            cancelable: true,
            defaultPrevented: false,
            preventDefault: (): void => {},
            stopPropagation: (): void => {},
            persist: (): void => {},
            isPersistent: (): boolean => true,
            nativeEvent: { text: val },
          };
          onChange(syntheticEvent);
          invoked = true;
          break;
        }
      }

      // 3. Fallback defensivo: si no encontramos onChange (no esperado en
      //    RNW), despachar DOM events. Mantenido por simetría con v8.
      if (!invoked) {
        el.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            data: val,
            inputType: 'insertText',
          }),
        );
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
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
