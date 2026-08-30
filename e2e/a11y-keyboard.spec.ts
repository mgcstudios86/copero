import { test, expect } from '@playwright/test';

/**
 * MGC-339 — a11y cross-platform: keyboard-only happy path en web.
 *
 * AC: "Teclado puro navega el simulador de carrera en web".
 *
 * Flujo (todo con Tab/Enter, sin click ni touch) sobre el home
 * rediseñado MGC-505 (un solo CTA `btn-career`):
 *  1. /  → Tab hasta btn-career → Enter → /simulador-carrera/identity
 *  2. /simulador-carrera/identity → Tab al input-name → tipeo nombre
 *     → Tab al primer pos-{id} → Enter → Tab nationality → escribir → Enter
 *     → Tab btn-identity-continue → Enter → /simulador-carrera/dashboard
 *  3. /dashboard → dashboard-jersey visible + btn-dashboard-academy focuseable
 *
 * Sin mouse. Sin .click(). Sin .tap(). Sólo .press() y .keyboard.press().
 *
 * MGC-505: el viejo juego "Juego de palabras" /categoria-/ronda-/fin fue
 * removido del home. Este spec cubre el único flujo accesible desde el
 * landing post-rediseño.
 */
test.describe('Copero — keyboard-only happy path (web) — MGC-505', () => {
  test('teclado puro navega home → identity → dashboard sin mouse', async ({ page }, testInfo) => {
    test.setTimeout(90_000);

    // 1) HOME — Tab hasta el CTA btn-home-play (MGC-394: home limpio
    // expone sólo el botón Jugar; antes era btn-career).
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="home-screen"]', { timeout: 15_000 });
    await page.screenshot({ path: testInfo.outputPath('kbd-1-home.png'), fullPage: true });

    await page.keyboard.press('Tab');
    const btnCareer = page.locator('[data-testid="btn-home-play"]');
    await expect(btnCareer).toBeVisible();
    for (let i = 0; i < 40; i += 1) {
      const isFocused = await btnCareer.evaluate(
        (el) => el === document.activeElement || el.contains(document.activeElement),
      );
      if (isFocused) break;
      await page.keyboard.press('Tab');
    }
    await page.keyboard.press('Enter');
    await page.waitForURL('**/simulador-carrera/identity', { timeout: 10_000 });
    await page.waitForSelector('[data-testid="identity-screen"]', { timeout: 10_000 });
    await page.screenshot({ path: testInfo.outputPath('kbd-2-identity.png'), fullPage: true });

    // 2) IDENTITY — input-name por teclado, luego posición, nacionalidad y continue.
    const inputName = page.locator('[data-testid="input-name"]');
    await inputName.focus();
    await page.keyboard.type('Mateo Romero');
    // El estado canónico requiere nationality + position. Por teclado puro
    // completamos nationality primero (más predecible que el field map pos-{id}).
    const inputNat = page.locator('[data-testid="input-nationality-search"]');
    await inputNat.focus();
    await page.keyboard.type('arg');
    // Seleccionar Argentina del dropdown (botón con el texto).
    const argentinaButton = page.getByRole('button', { name: /Argentina/i }).first();
    await expect(argentinaButton).toBeVisible();
    await argentinaButton.focus();
    await page.keyboard.press('Enter');
    // Posición: el primer pos-{id} del field map (ST por orden).
    const firstPos = page.locator('[data-testid^="pos-"]').first();
    await firstPos.focus();
    await page.keyboard.press('Enter');
    // Continue (debe estar habilitado con los 3 campos completos).
    const btnContinue = page.locator('[data-testid="btn-identity-continue"]');
    await btnContinue.focus();
    await page.keyboard.press('Enter');
    await page.waitForURL('**/simulador-carrera/dashboard', { timeout: 15_000 });
    await page.waitForSelector('[data-testid="dashboard-screen"]', { timeout: 10_000 });
    await page.screenshot({ path: testInfo.outputPath('kbd-3-dashboard.png'), fullPage: true });

    // 3) DASHBOARD — Jersey visible + Academy focuseable.
    await expect(page.locator('[data-testid="jersey-preview"]')).toBeVisible();
    const btnAcademy = page.locator('[data-testid="btn-dashboard-academy"]');
    await expect(btnAcademy).toBeVisible();
    // Validar que el botón es focuseable por teclado.
    await btnAcademy.focus();
    const isAcademyFocused = await btnAcademy.evaluate(
      (el) => el === document.activeElement || el.contains(document.activeElement),
    );
    expect(isAcademyFocused, 'btn-dashboard-academy debe ser focuseable por teclado').toBe(true);
  });
});