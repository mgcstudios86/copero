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
 * Solución (MGC-2451 v13) — secuencia canónica de eventos DOM + dispatchEvent
 * explícito para React 18 root listener + retry del batch completo si el
 * botón Continuar sigue disabled:
 *   1. focus (con fallback programático si el click forzado queda bloqueado
 *      por un overlay de capture pointer-events, ej. dropdown de país).
 *   2. waitForReactRoot: espera activa hasta que el ROOT container de React
 *      (no solo el input) tenga __reactContainer$xxx attached. Sin esta
 *      garantía, los eventos `input` se pierden porque el listener delegado
 *      de React 18 todavía no está attached.
 *   3. Clear previo: triple-click para seleccionar todo + Backspace.
 *   4. Secuencia canónica `focus` + `keyboard.insertText` + `dispatchEvent`
 *      (MGC-2451 AC §1):
 *        await input.focus();
 *        await page.keyboard.insertText(value);  // emite input events reales
 *        await input.dispatchEvent('input', { bubbles: true, ... });
 *      Esto cubre AMBOS paths de entrega: el delegated listener de React 18
 *      (cuando está listo) Y la cadena directa nativeEvent → onChangeText
 *      vía RNW handleChange (cuando el listener delegado aún no llega).
 *      Acepta chars no-ASCII (ñ/á/emoji) sin transformación.
 *   5. expect(input).toHaveValue(value) — web-first assertion con retry 5s.
 *   6. Push al batch de identidad de la página. Si `btn-identity-continue`
 *      existe y sigue disabled tras 1500ms, re-filla TODAS las entradas del
 *      batch (no solo la última) usando `input.fill()` canónico de Playwright.
 *      El batch-tracking evita que un fallo temprano (input-name) quede
 *      invisible cuando la última entrada (input-nationality-search) sí
 *      reconcilia.
 *   7. Pausa post-fill para que React 18 commitee el state update antes del
 *      siguiente fill (dos inputs consecutivos pueden batchearse y descartar
 *      el primero).
 *
 * Historial de iteraciones sobre PR #544:
 *   v2 (eb718d5): wrap down + press + up por char -> duplica chars.
 *   v3 (d72da6d): solo keyboard.press por char -> 7/23 specs fallan.
 *   v4 (680761f): insertText + setter nativo + change event -> mismo síntoma.
 *   v5 (316e93f): + waitForHydration antes de tipear -> race sigue.
 *   v6 (cee820b): hydration input + fill() canónico -> 7/23 FAIL.
 *   v7 (b098094): expect(toBeVisible) sobre btn-number-plus -> tapona stale.
 *   v8 (739c20f): waitForReactRoot + InputEvent -> 7/31 FAIL.
 *   v9 (f428175): invoca props.onChange directo via fiber -> TypeError.
 *   v10 (02cc7db): v9 + nativeEvent poblado -> 7/31 FAIL run 34193970453.
 *   v11 (146a335): retry CDP insertText si btn disabled -> 7/31 FAIL.
 *   v12 (d08903c): retry multi-intento 3×1500ms del LAST fill -> 8/31 FAIL
 *                  run 34198925623. Diagnóstico: retry del ÚLTIMO input no
 *                  rescata un fallo temprano (input-name o input-lastname
 *                  que quedaron sin reconciliar antes del pos-ST click).
 *   v13 (esta):   secuencia canónica focus + insertText + dispatchEvent
 *                  'input' (cumple task AC §1) + retry del BATCH completo
 *                  (no solo del último) si btn-identity-continue disabled.
 *                  Tipos TS explícitos en todos los callbacks (sin any).
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
 *
 * Tipos TS explícitos: el callback de `page.waitForFunction` recibe un
 * parámetro `unknown` (serializado por el bridge) y debe angostarse antes
 * de usarlo como elemento DOM. Mantenemos la firma `(tid) => boolean`
 * explícita (sin `any`) para cumplir strict TS de `tsc --noEmit`.
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

/**
 * v13 — Secuencia canónica de eventos DOM per MGC-2451 AC §1:
 *   1. `input.focus()` — DOM focus real.
 *   2. `page.keyboard.insertText(value)` — emite input events reales via CDP
 *      (UNO por cada caracter group; maneja ñ/á/emoji correctamente).
 *   3. `input.dispatchEvent('input', { bubbles: true, ... })` — explícitamente
 *      notifica al root listener de React 18 (delegated events). Esto cubre
 *      AMBOS paths: la cadena nativa CDP→DOM→React delegated listener
 *      (cuando funciona) Y la captura explícita via dispatchEvent que React
 *      no puede perder porque sale del input directamente al document.
 *
 * Notas:
 * - El wrapper `forceReactReconcile` se mantiene como helper interno pero
 *   su contenido cambia: ya no invocamos `props.onChange` directamente
 *   desde el fiber (v9-v12, frágil). Ahora disparamos eventos DOM reales.
 * - `dispatchEvent` se hace con `bubbles: true` para que el evento suba
 *   hasta el root donde React 18 tiene su delegated listener.
 * - Tipos TS: el callback de `evaluate` recibe el `HTMLInputElement` y el
 *   valor serializado. No usamos `any` en ningún punto.
 */
async function forceReactReconcile(input: Locator, value: string): Promise<void> {
  const page: Page = input.page();
  await input.focus();
  await page.keyboard.insertText(value);
  await input.dispatchEvent('input', {
    bubbles: true,
    cancelable: true,
    data: value,
    inputType: 'insertText',
  });
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

  // v13 — Push al batch de identidad de la página. Si `btn-identity-continue`
  // existe y sigue disabled tras la espera, re-filla TODAS las entradas del
  // batch (no solo la última) usando `input.fill()` canónico de Playwright.
  // v11/v12 retryaban solo el ÚLTIMO input; si un fallo temprano (input-name
  // o input-lastname) quedaba sin reconciliar antes del pos-ST click, el
  // retry del último input no lo rescataba y el spec fallaba al toBeEnabled.
  pushIdentityBatch(page, input, value);
  await maybeRetryIdentityBatch(page);

  // Pausa corta para que React 18 commitee el state update antes del
  // siguiente fill. Sin esto, dos fills consecutivos (p.ej. input-name +
  // input-lastname) pueden batchearse en un mismo commit y React descarta
  // el primero.
  await page.waitForTimeout(delay + 20);
}

/**
 * v13 — Tracking de inputs llenados en el batch de identidad de cada page.
 * Permite que el retry re-fille TODAS las entradas acumuladas, no solo la
 * última. `WeakMap<Page, ...>` evita leaks: cuando Playwright cierra la page
 * al terminar el test, el GC limpia la entrada correspondiente.
 *
 * Tipos TS: la entrada guarda `{ input, value }` con tipos explícitos
 * (`Locator` y `string`), no `any`.
 */
type IdentityBatchEntry = { input: Locator; value: string };
const _identityBatch: WeakMap<Page, IdentityBatchEntry[]> = new WeakMap();

function pushIdentityBatch(page: Page, input: Locator, value: string): void {
  const existing = _identityBatch.get(page);
  if (existing) {
    existing.push({ input, value });
  } else {
    _identityBatch.set(page, [{ input, value }]);
  }
}

/**
 * Limpia el batch de identidad de una página. Útil para `beforeEach` cuando
 * varios specs reutilizan la misma page (modo serial) o cuando un spec
 * navega fuera del flujo /identity y vuelve. Si no se llama, el batch
 * persiste durante la vida de la page (WeakMap lo limpia automáticamente).
 */
export function clearIdentityBatch(page: Page): void {
  _identityBatch.delete(page);
}

/**
 * v13 — Probe + retry multi-intento del BATCH COMPLETO. v11/v12 retryaban
 * solo el ÚLTIMO input; si un fallo temprano (input-name o input-lastname)
 * quedaba sin reconciliar antes del pos-ST click, el retry del último
 * input no lo rescataba y el spec fallaba al toBeEnabled con `Received:
 * disabled` (run 34198925623 FAIL — 8 specs fallan idénticamente con el
 * mismo síntoma).
 *
 * Diagnóstico v13: el botón `btn-identity-continue` se habilita solo cuando
 * TODOS los gates `isIdentityComplete` pasan (name + lastName + age +
 * nationality). Si cualquier input del flujo perdió su reconciliación, el
 * batch debe re-fillear TODAS las entradas, no solo la última. Cada retry
 * usa `input.fill()` canónico de Playwright (focus + selectAll + native
 * insertText) que dispara la cadena DOM→React 18 root listener de manera
 * robusta — distinto del CDP `Input.insertText` de v11/v12 que a veces se
 * pierde cuando el root listener aún no está attached.
 *
 * Estrategia:
 * 1. Después del fill v13, espera 1500ms para dar tiempo al commit de
 *    React 18.
 * 2. Si sigue disabled, re-filla TODAS las entradas del batch en orden.
 * 3. Re-espera 1500ms. Si sigue disabled, segundo retry.
 * 4. Límite: max 3 reintentos. Si tras 3 retries sigue disabled, abandona
 *    y deja que el spec falle con toBeEnabled (el caller verá el contexto
 *    correcto en el trace).
 *
 * Si el botón no existe (helpers fuera de /identity), skip silencioso.
 */
async function maybeRetryIdentityBatch(page: Page): Promise<void> {
  const continueBtn = page.getByTestId('btn-identity-continue');
  const exists = await continueBtn.count().catch(() => 0);
  if (exists === 0) return;

  // v13.1 — Fast-path: si el botón está enabled inmediatamente, return sin
  // esperar 1500ms. Esto evita ~1.5s de overhead por cada fillRnw call
  // (×31 specs × ~4 fillRnw/spec = ~3 min de waits innecesarios que
  // colgaban la suite completa en run 34201851806).
  const initiallyEnabled = await continueBtn
    .evaluate((el: HTMLButtonElement): boolean => !(el as HTMLButtonElement).disabled)
    .catch(() => false);
  if (initiallyEnabled) return;

  const batch = _identityBatch.get(page);
  if (!batch || batch.length === 0) return;

  const MAX_RETRIES = 3;
  const WAIT_BETWEEN_MS = 1500;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    await page.waitForTimeout(WAIT_BETWEEN_MS);
    const stillDisabled = await continueBtn
      .evaluate((el: HTMLButtonElement): boolean => (el as HTMLButtonElement).disabled)
      .catch(() => true);
    if (!stillDisabled) return;

    // Re-filla TODAS las entradas del batch en orden (no solo la última).
    for (const { input, value } of batch) {
      try {
        await input.fill(value);
        await expect(input).toHaveValue(value);
      } catch {
        // Best-effort: si el re-fill de esta entrada falla, continuar con
        // la siguiente. El siguiente intento global re-filla el batch
        // completo de nuevo.
        continue;
      }
    }
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
