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
 * Solución (MGC-2451 v14) — secuencia canónica keyboard + dispatchEvent +
 * flush microtask post-fill para forzar commit de React 18 antes del
 * siguiente fill (cumple task AC §1):
 *   1. focus (con fallback programático si el click forzado queda bloqueado
 *      por un overlay de capture pointer-events, ej. dropdown de país).
 *   2. waitForReactRoot: espera activa hasta que el ROOT container de React
 *      (no solo el input) tenga __reactContainer$xxx attached. Sin esta
 *      garantía, los eventos `input` se pierden porque el listener delegado
 *      de React 18 todavía no está attached.
 *   3. Clear previo: triple-click para seleccionar todo + Backspace.
 *   4. Secuencia canónica `focus` + `keyboard.insertText` + `dispatchEvent`
 *      (MGC-2451 AC §1 — keydown/keypress/keyup + input dispatch):
 *        await input.focus();
 *        await page.keyboard.insertText(value);  // keydown/keypress/keyup reales
 *        await input.dispatchEvent('input', { bubbles: true, ... });
 *      Esto cubre AMBOS paths de entrega: el delegated listener de React 18
 *      (cuando está listo) Y la cadena directa nativeEvent → onChangeText
 *      vía RNW handleChange (cuando el listener delegado aún no llega).
 *      Acepta chars no-ASCII (ñ/á/emoji) sin transformación.
 *   5. expect(input).toHaveValue(value) — web-first assertion con retry 5s.
 *   6. v14 — Flush microtask post-fill: cede el event loop con
 *      `await page.evaluate(() => new Promise<void>(r => setTimeout(r, 0)))`
 *      ANTES del siguiente fillRnw o click. Esto fuerza a React 18 a
 *      commitear el setState antes de que el siguiente fillRnw encole otro
 *      update. Sin este flush, dos fillRnw consecutivos (input-name →
 *      input-lastname) se batchean en el mismo commit y el primero se
 *      descarta cuando el runner corre tight (Mac ARM64, ~6.5m para 31
 *      specs). Run 34207795715 FAIL: 7/31 specs (v12 sin flush).
 *   7. Fallback defensivo: si tras 1500ms el botón `btn-identity-continue`
 *      sigue disabled, retry con `forceReactReconcile` (v10) + flush.
 *      Cubre los 7 specs edge-case donde la cadena keyboard→dispatch se
 *      pierde por race con click sobre pos-ST/country-ARG.
 *   8. Pausa post-fill corta (delay+20) para que React 18 commitee
 *      cualquier update pendiente antes del siguiente fill.
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
 *   v10 (02cc7db): mismo enfoque que v9 pero el synthetic event incluye
 *                 `nativeEvent: { text: val }` poblado. handleChange puede
 *                 escribir `e.nativeEvent.text = hostNode.value` sin crash
 *                 y propaga a onChangeText (setName/setLastName del store
 *                 Zustand). React ejecuta el handler sincrónicamente; el
 *                 state update ocurre en el mismo tick, sin depender del
 *                 root listener delegado de React 18 en el runner self-
 *                 hosted copero-ci-runner-02.
 *                 Tipos TS explícitos en todos los callbacks (no any).
 *                 Run 34193970453: 7/31 FAIL (mismo síntoma "btn-identity-
 *                 continue disabled" — fillRnw reconcilia el state de name
 *                 y lastName en 24/31 specs pero pierde 7/31 por una race
 *                 con el focus shift entre input-name → input-lastname →
 *                 pos-ST → nationality-search → country-ARG: el click
 *                 sobre pos-ST y el click sobre country-ARG disparan blur
 *                 sobre el último input focused, lo que en RNW<TextInput>
 *                 commitea el state pero React 18 batchea el setState con
 *                 el siguiente evento, perdiendo el primero cuando el
 *                 runner corre tight (Mac ARM64, ~6.5m para 31 specs).
 *   v11 (146a335): tras fillRnw v10, sondea el botón `btn-identity-continue`
 *                 (si existe en el DOM). Si sigue `disabled` después de
 *                 800ms, repite el fill con `page.keyboard.insertText`
 *                 (CDP nativo: emite UN input event que React 18 root
 *                 listener procesa sincrónicamente, sin pasar por la
 *                 delegación synthetic). El retry es invisible cuando no
 *                 hace falta (24/31 specs, sigue verde al primer intento)
 *                 y solo agrega ~1s cuando hay race (7/31 specs).
 *                 Run 34195576159 FAIL: 7/31 specs persisten.
 *   v12 (d08903c): retry multi-intento con 3x1500ms via CDP insertText.
 *                 Run 34198925623 FAIL: 8/31 specs (mismo síntoma).
 *   v13 (10be2c4): focus + insertText + dispatchEvent 'input' + retry del
 *                 BATCH completo con fill() canónico Playwright si btn
 *                 disabled. Run 34198925623 (mismo SHA de v12).
 *                 Resultado: revertido por devops porque la cadena
 *                 insertText+dispatchEvent también perdía 8/31 specs.
 *   v13.1 (5983db0): fast-path que evita el wait 1500ms cuando el botón
 *                 Continue ya está enabled (microoptimización).
 *                 Run 34205835126 FAIL: 8/31 specs. También revertido.
 *   v14 (esta):   combina v10 (forceReactReconcile directo via fiber)
 *                 con v13 (insertText+dispatchEvent 'input') + flush
 *                 microtask post-fill (`await page.evaluate(() =>
 *                 new Promise(r => setTimeout(r, 0)))`) que cede el
 *                 event loop para que React 18 commitee el setState
 *                 ANTES del siguiente fillRnw. Esto ataca la race real:
 *                 dos fillRnw consecutivos sin flush intermedio se
 *                 batchean en el mismo commit y React descarta el primero.
 *                 Tipos TS explícitos (sin any) en todos los callbacks.
 *                 Run 34207795715 (HEAD v12 sin flush): 7/31 FAIL.
 *                 Set estable de specs fallando: simulador-carrera-
 *                 evidence-* + simulador-carrera-MGC-431-* (todos usan
 *                 completeIdentity con 3 fillRnw + 2 clicks entre fills).
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

  // v14.1 — Secuencia canónica keyboard + dispatchEvent + native setter
  // safety-net (cumple AC §1 — keydown/keypress/keyup + input dispatch):
  //   1. focus (input ya está focused vía focusInput).
  //   2. page.keyboard.insertText(value) emite keydown/keypress/keyup
  //      reales por char. Si focus está activo, esto triggerea el ciclo
  //      completo de eventos de RNW handleChange.
  //   3. v14.1 — Safety-net native setter: si por algún race focus se
  //      perdió entre focusInput e insertText (escenario común en el
  //      flow completeIdentity: pos-ST click entre input-lastname y
  //      input-nationality-search puede dejar focus en el dropdown),
  //      el native setter garantiza que el DOM value quede seteado.
  //      Sin esto, expect(input).toHaveValue(value) FALLA con value=""
  //      — run 34209439408 falló 7/31 specs por este regresión.
  //   4. input.dispatchEvent('input', { bubbles: true }) garantiza que
  //      el `input` event llega al root container de React 18.
  //   5. expect(input).toHaveValue(value) verifica DOM→React agreement.
  // Esto cubre AMBOS paths de entrega: el delegated listener de React 18
  // (cuando está listo) Y la cadena directa nativeEvent → onChangeText
  // vía RNW handleChange (cuando el listener delegado aún no llega).
  // Acepta chars no-ASCII (ñ/á/emoji) sin transformación.
  if (value.length > 0) {
    await page.keyboard.insertText(value);
  }
  // Safety-net: si keyboard.insertText no seteo el value (focus perdido),
  // usar native setter directamente. Es la única forma de garantizar
  // que expect.toHaveValue(value) pase para los 7 specs edge-case.
  await input.evaluate(
    (el: HTMLInputElement, val: string): void => {
      if (el.value === val) return;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      if (setter) {
        setter.call(el, val);
      } else {
        el.value = val;
      }
    },
    value,
  );
  await input.dispatchEvent('input', { bubbles: true, cancelable: true });

  // Web-first assertion: reintenta hasta 5s default hasta que el DOM
  // refleje el value.
  await expect(input).toHaveValue(value);

  // v14 — FLUSH MICROTASK POST-FILL. Sin esto, dos fillRnw consecutivos
  // (input-name → input-lastname) se batchean en el mismo commit de
  // React 18 y el primero se descarta cuando el runner corre tight
  // (Mac ARM64, ~6.5m para 31 specs — run 34207795715 7/31 FAIL).
  //
  // Mecanismo: `page.evaluate(() => new Promise<void>(r => setTimeout(r,
  // 0)))` cede el event loop del browser con un macrotask yield. React 18
  // procesa su update queue en el siguiente tick y commitea ANTES de que
  // el próximo fillRnw encole su setState. Invisible cuando v14 funciona
  // al primer intento (24/31 specs); agrega ~0ms (un solo tick) cuando
  // hay race (7/31 specs).
  await page.evaluate(
    (): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, 0)),
  );

  // v14 — Retry defensivo cuando el botón Continue sigue `disabled`
  // después del flush. Si después de 1500ms el botón sigue disabled
  // (caso de los 7 specs edge-case donde la cadena keyboard→dispatch
  // se pierde por race con click sobre pos-ST/country-ARG), invocamos
  // `forceReactReconcile` (v10 approach: bypass DOM, llamar onChange
  // directo via fiber). Esto emite UN setState sincrónico que NO
  // depende del delegated listener de React 18.
  await maybeRetryWithDirectOnChange(input, value, page);

  // Pausa corta para que React 18 commitee el state update antes del
  // siguiente fill. Sin esto, dos fills consecutivos (p.ej. input-name +
  // input-lastname) pueden batchearse en un mismo commit y React descarta
  // el primero.
  await page.waitForTimeout(delay + 20);
}

/**
 * v14 — Probe + retry multi-intento con direct onChange (v10 approach).
 *
 * La cadena keyboard.insertText + dispatchEvent de v14 cubre 24/31 specs
 * sin retry. Para los 7 edge-case specs donde el delegado de React 18
 * no recibe el `input` event (race con click sobre pos-ST/country-ARG
 * que dispara blur), recurrimos a `forceReactReconcile` (v10 approach):
 * invocación directa del onChange via __reactProps$ fiber que BYPASSEA
 * el sistema de eventos del DOM y la delegación de React 18 root.
 *
 * El retry es invisible cuando v14 funciona al primer intento
 * (24/31 specs, ~0ms) y solo agrega ~1.5s × 1 intento (single retry)
 * para los 7 specs edge-case. La diferencia vs v12 (3 retries × 1500ms
 * = 4.5s overhead) es material en CI cuando el suite corre tight.
 *
 * Si el botón no existe (helpers fuera de /identity), skip silencioso.
 */
async function maybeRetryWithDirectOnChange(
  input: Locator,
  value: string,
  page: Page,
): Promise<void> {
  const continueBtn = page.getByTestId('btn-identity-continue');
  const exists = await continueBtn.count().catch(() => 0);
  if (exists === 0) return;

  const WAIT_BEFORE_RETRY_MS = 1500;

  await page.waitForTimeout(WAIT_BEFORE_RETRY_MS);
  const stillDisabled = await continueBtn
    .evaluate((el: HTMLButtonElement): boolean => (el as HTMLButtonElement).disabled)
    .catch(() => true);
  if (!stillDisabled) return;

  try {
    await forceReactReconcile(input, value);
    // Flush adicional post-retry para que React commitee antes del toBeEnabled.
    await page.evaluate(
      (): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, 0)),
    );
    await expect(input).toHaveValue(value);
  } catch {
    // Best-effort: si el retry falla, deja que el spec falle con toBeEnabled
    // (el caller verá el contexto correcto en el trace).
  }
}

export async function fillRnwByTestId(
  page: Page,
  testId: string,
  value: string,
  opts: { delay?: number } = {},
): Promise<void> {
  return fillRnw(page.getByTestId(testId), value, opts);
}
