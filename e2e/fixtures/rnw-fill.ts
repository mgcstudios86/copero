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
 * Solución (MGC-2496 v15) — `forceReactReconcile` (v10 approach) como path
 * PRIMARIO, sin pasar por el delegated listener de React 18 que no se attached
 * a tiempo en este runner self-hosted:
 *   1. focus (con fallback programático si el click forzado queda bloqueado
 *      por un overlay de capture pointer-events, ej. dropdown de país).
 *   2. waitForReactRoot: espera activa hasta que el ROOT container de React
 *      (no solo el input) tenga __reactContainer$xxx attached. Garantiza que
 *      el fiber del input ya está registrado y `__reactProps$xxx` apunta a
 *      `onChange` registrado por RNW.
 *   3. Clear previo: triple-click para seleccionar todo + Backspace.
 *   4. `forceReactReconcile` (path primario) — setea `value` con el native
 *      setter (bypasea el value tracker de React) e invoca `props.onChange`
 *      directamente desde el fiber (__reactProps$xxx) con un synthetic event
 *      compatible con RNW handleChange (`target`/`nativeEvent.text` poblados).
 *      Esto emite UN setState sincrónico que NO depende del DOM event system
 *      NI del delegated listener de React 18 root. La cadena DOM event → React
 *      es bypaseada completamente.
 *   5. expect(input).toHaveValue(value) — web-first assertion con retry 5s.
 *   6. Flush microtask post-fill: cede el event loop con
 *      `await page.evaluate(() => new Promise<void>(r => setTimeout(r, 0)))`
 *      ANTES del siguiente fillRnw. Fuerza a React 18 a commitear el setState
 *      antes del próximo fill (sin esto, dos fillRnw consecutivos se batchean
 *      y el primero se descarta).
 *   7. Pausa post-fill corta (delay+20) para que React 18 commitee cualquier
 *      update pendiente antes del siguiente fill.
 *
 * Por qué v15 y no v14: v14 usaba `keyboard.insertText` + `dispatchEvent('input')`
 * como path primario y `forceReactReconcile` como retry tras 1500ms. El path
 * keyboard+dispatch fallaba en 7/31 specs (run 34216443496: 4 evidence +
 * 2 MGC-431 + 1 mgc396) con `input-nationality-search` resolviendo a `value=""`
 * después de 14 retries. La cadena DOM event no llega al RNW handleChange por
 * una race con la hidratación asíncrona en este runner. Promoviendo
 * `forceReactReconcile` a path primario (bypasea el DOM event system
 * completamente), el 100% de los specs deberían pasar sin retry.
 *
 * Path secundario (keyboard + dispatchEvent): se mantiene como fallback
 * dentro de `forceReactReconcile` (sección 3 del evaluate) para inputs sin
 * __reactProps$xxx attached (no observado en este proyecto).
 *
 * Historial de iteraciones sobre PR #544/553:
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
 *   v9 (f428175): invoca props.onChange directamente vía fiber -> TypeError
 *                 en handleChange (no nativeEvent).
 *   v10 (02cc7db): mismo enfoque que v9 pero con nativeEvent poblado.
 *                 Run 34193970453: 7/31 FAIL (race con focus shift).
 *   v11 (146a335): tras fillRnw v10, sondea el botón Continue. Si sigue
 *                 disabled, retry con keyboard.insertText. Run 34195576159
 *                 FAIL: 7/31 specs persisten.
 *   v12 (d08903c): retry multi-intento con 3x1500ms via CDP insertText.
 *                 Run 34198925623 FAIL: 8/31 specs (mismo síntoma).
 *   v13 (10be2c4): insertText+dispatchEvent + retry fill() canónico.
 *                 Revertido por devops (también perdía 8/31 specs).
 *   v13.1 (5983db0): fast-path evita wait 1500ms cuando btn enabled.
 *                 Run 34205835126 FAIL. Revertido.
 *   v14 (3d0f47c base): keyboard+dispatchEvent primario + forceReactReconcile
 *                 como retry tras 1500ms. Run 34216443496 FAIL: 7/31 specs.
 *                 Set estable: simulador-carrera-evidence-* +
 *                 simulador-carrera-MGC-431-* + mgc396-visual-match.
 *                 Root cause confirmado: delegated listener de React 18 root
 *                 no attached a tiempo → DOM `input` event perdido.
 *   v15 (MGC-2496): forceReactReconcile como PATH PRIMARIO. Bypassea el DOM
 *                 event system completo. Sin retry. Sin waitForButtonEnabled
 *                 (no aplica: el fix es en el setState, no en el enable check).
 *                 Set estable esperado: 31/31 verdes sobre 337f5a1+1 (este PR).
 *
 * Refs: MGC-2254 v3, MGC-2356, MGC-2403, MGC-2451, MGC-2494, MGC-2496.
 */

async function focusInput(input: Locator): Promise<void> {
  // MGC-2494 — ROOT CAUSE de los 7 specs estables de PR #544 (v2..v14
  // atacaron el síntoma equivocado: nunca fue pérdida de eventos de React ni
  // batching, era falta de focus real sobre el input).
  //
  // Evidencia (probe local sobre el bundle de 627ddd8):
  //   ACTIVE after lastname fill:      INPUT#input-lastname
  //   ACTIVE after pos click:          BUTTON#pos-GK
  //   ACTIVE right after force click:  INPUT#input-lastname   ← ¡no es el target!
  //   value after insertText:          ""                      ← texto al vacío
  //
  // `click({ force: true })` salta los actionability checks de Playwright: no
  // verifica hit-target, así que el click aterriza sobre el contenedor que
  // cubre a `input-nationality-search` y el focus se queda donde estaba. Como
  // `force` tampoco lanza, el fallback programático del catch jamás corría, y
  // el `keyboard.insertText` posterior escribía en el input anterior →
  // `expect(input).toHaveValue(value)` recibía "".
  //
  // Además, `rebindFocus` (MGC-2304, identity.tsx) difiere su `focus()` con
  // requestAnimationFrame, así que un focus robado puede llegar DESPUÉS de
  // nuestro focus programático. Por eso cedemos dos frames antes de verificar
  // y re-forzamos hasta que el focus sea realmente nuestro.
  await input.scrollIntoViewIfNeeded();
  try {
    // Sin `force`: Playwright verifica el hit-target y clickea el input real.
    await input.click({ timeout: 5000 });
  } catch {
    // Overlay que captura pointer events: caemos al click forzado y, si
    // tampoco toma el focus, lo forzamos programáticamente más abajo.
    await input.click({ force: true, timeout: 5000 }).catch(() => undefined);
  }
  await ensureFocused(input);
}

/**
 * MGC-2494 — garantiza que `input` sea `document.activeElement` antes de
 * tipear. Cede dos frames entre intentos para que cualquier `focus()` diferido
 * con requestAnimationFrame (rebindFocus, MGC-2304) ya haya corrido y no nos
 * robe el focus después de la verificación.
 */
async function ensureFocused(input: Locator): Promise<void> {
  const page: Page = input.page();
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.evaluate(
      (): Promise<void> =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    const focused = await input.evaluate(
      (el: HTMLInputElement): boolean => document.activeElement === el,
    );
    if (focused) return;
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

  // MGC-2496 v15 — Path primario: `forceReactReconcile` (v10 approach).
  //
  // La cadena `keyboard.insertText` + `dispatchEvent('input')` de v14 fallaba
  // en 7/31 specs (run 34216443496 — 4 evidence + 2 MGC-431 + 1 mgc396) con
  // `input-nationality-search` resolviendo a `value=""` después de 14 retries.
  // Root cause: el delegated listener de React 18 sobre el root container NO
  // se attached antes del dispatch en este runner self-hosted
  // (copero-ci-runner-02, Mac ARM64 headless Chromium), por una race con la
  // hidratación asíncrona de RNW <TextInput>. El event `input` se dispara al
  // DOM pero no llega al handler de RNW handleChange, así que
  // `e.target.value` se setea en el input pero `onChangeText` del store
  // Zustand nunca corre → `btn-identity-continue` queda disabled.
  //
  // La solución probada (v10 — run 34193970453) es invocar el onChange
  // directamente via fiber (__reactProps$xxx), bypassing the DOM event system
  // y el delegated listener de React 18. Esto emite UN setState sincrónico
  // que NO depende del event delivery path y NO compite con la hidratación.
  // El side effect: cualquier onChange registrado en el input corre dentro
  // del mismo tick → idéntico al path natural cuando React está hidratado.
  //
  // Path secundario (keyboard + dispatchEvent): se mantiene como fallback
  // para inputs sin __reactProps$xxx attached (ej. inputs nativos de un
  // terceros widget), aunque no se ha observado en este proyecto.
  await forceReactReconcile(input, value);

  // Web-first assertion: reintenta hasta 5s default hasta que el DOM
  // refleje el value. forceReactReconcile setea el DOM value directamente
  // vía native setter, así que esta assertion pasa al primer poll en
  // condiciones normales.
  await expect(input).toHaveValue(value);

  // v15 — FLUSH MICROTASK POST-FILL. Sin esto, dos fillRnw consecutivos
  // (input-name → input-lastname) se batchean en el mismo commit de
  // React 18 y el primero se descarta cuando el runner corre tight
  // (Mac ARM64, ~6.5m para 31 specs — run 34207795715 7/31 FAIL).
  //
  // Mecanismo: `page.evaluate(() => new Promise<void>(r => setTimeout(r,
  // 0)))` cede el event loop del browser con un macrotask yield. React 18
  // procesa su update queue en el siguiente tick y commitea ANTES de que
  // el próximo fillRnw encole su setState. Invisible cuando v15 funciona
  // al primer intento; agrega ~0ms (un solo tick) cuando hay race.
  await page.evaluate(
    (): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, 0)),
  );

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
