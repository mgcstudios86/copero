import type { Locator, Page } from '@playwright/test';

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