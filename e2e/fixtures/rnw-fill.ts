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
 * Solución (MGC-2451 v3): secuencia explícita de eventos por caracter
 *   1. focus (con fallback programático si el click forzado queda bloqueado
 *      por un overlay de capture pointer-events, ej. dropdown de país).
 *   2. por cada `char` del value:
 *        keyboard.press(char)  -> keydown + keyup (UNA inserción por char).
 *      Para chars no-ASCII (ñ, á, …) `keyboard.press` no mapea a un Key
 *      válido; usamos `keyboard.insertText(char)` que dispara el `input`
 *      event con la string cruda (RNW lo acepta).
 *   3. dispatchEvent('input', { bubbles: true }) explícito sobre el input
 *      para garantizar que React reconcilie el state sin esperar al
 *      siguiente tick del event loop.
 *   4. expect(input).toHaveValue(value) — web-first assertion con retry
 *      5s default; bloquea hasta que el `value` del DOM refleje exactamente
 *      lo tipeado, evitando race con re-renders.
 *
 * Nota importante (iteración 3 sobre PR #544): un wrap `down + press + up`
 * emite DOS keydown por caracter y React inserta el caracter DOS veces
 * (recibido = "CCAALLVVOO" cuando se tipea "CALVO"). `keyboard.press` ya
 * hace `down + up` internamente; envolverlo duplica. Por eso esta versión
 * usa solo `press`.
 *
 * Detalle de implementación: usamos `click({ force: true })` con scroll
 * previo en `focusInput` para evitar overlays (ej. dropdown de país en
 * nationality-search) que interceptan pointer-events en el runner
 * self-hosted. Si el click forzado sigue siendo bloqueado, fallback a
 * `evaluate(el => el.focus())` que no depende del pointer pipeline.
 *
 * Refs: MGC-2254 v3, MGC-2356, MGC-2403, MGC-2451.
 */

const ASCII_KEY_PATTERN = /^[\x20-\x7E]$/;

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

async function typeChar(page: Page, char: string): Promise<void> {
  if (char === '') return;
  if (ASCII_KEY_PATTERN.test(char)) {
    // `press` = keydown + keyup (un solo ciclo). React inserta el caracter
    // una vez. NO envolver con down/up adicionales: cada down adicional
    // duplica la inserción (regression observada en run 34178994028: "CALVO"
    // -> "CCAALLVVOO").
    await page.keyboard.press(char);
  } else {
    // Chars fuera del rango ASCII imprimible (tildes, ñ, emoji): insertText
    // escribe la string cruda en el input focused sin pasar por key mapping.
    await page.keyboard.insertText(char);
  }
}

export async function fillRnw(
  input: Locator,
  value: string,
  opts: { delay?: number } = {},
): Promise<void> {
  const { delay = 30 } = opts;
  await focusInput(input);

  const page: Page = input.page();
  for (const char of value) {
    await typeChar(page, char);
  }

  // Disparar `input` explícito sobre el elemento (bubbles: true para RNW).
  // Cubre el caso donde la hidratación tardía dejó listeners colgados: el
  // evento a nivel de elemento fuerza a React a reconciliar useState con el
  // value final ya tipeado.
  await input.dispatchEvent('input', { bubbles: true });

  // expect() de @playwright/test es una web-first assertion: reintenta hasta
  // 5s por default hasta que el DOM refleje el value. Sin esto, specs que
  // clickean inmediatamente después pueden leer un value stale y fallar el
  // expect del botón enabled.
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