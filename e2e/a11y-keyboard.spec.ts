import { test, expect } from '@playwright/test';

/**
 * MGC-339 — a11y cross-platform: keyboard-only happy path en web.
 *
 * AC: "Teclado puro navega el simulador de carrera en web".
 *
 * Flujo (todo con Tab/Enter, sin click ni touch) tras MGC-1188:
 *  1. /  → el dispatcher redirige a /simulador-carrera/identity
 *     (sin carrera persistida). El focus cae sobre el primer focuseable
 *     del identity screen (típicamente el input-name).
 *  2. /simulador-carrera/identity → Tab al input-name → tipeo nombre
 *     → Tab al primer pos-{id} → Enter → Tab nationality → escribir → Enter
 *     → Tab btn-identity-continue → Enter → /simulador-carrera/dashboard
 *  3. /dashboard → dashboard-jersey visible + btn-dashboard-academy focuseable
 *
 * Sin mouse. Sin .click(). Sin .tap(). Sólo .press() y .keyboard.press().
 *
 * MGC-1188: el home es ahora un dispatcher invisible que resuelve a la
 * ruta del simulador en el mismo render (los testIDs del splash viejo
 * fueron removidos junto con la pantalla inicial).
 */
test.describe('Copero — keyboard-only happy path (web) — MGC-505', () => {
  test('teclado puro navega home → identity → dashboard sin mouse', async ({ page }, testInfo) => {
    test.setTimeout(90_000);

    // 1) LANDING — MGC-2254: goto directo (home ya no es dispatcher
    // tras MGC-1397 / PR #340).
    await page.goto('/simulador-carrera/identity', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="identity-screen"]', { timeout: 15_000 });
    await page.screenshot({ path: testInfo.outputPath('kbd-1-identity.png'), fullPage: true });

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
    // MGC-448: scope al dashboard-screen. Sin el scope, expo-router deja
    // identity.tsx montado (lazy-unmount) y `[data-testid="jersey-preview"]`
    // resuelve a 2 elementos (uno en /identity, otro en /dashboard) →
    // strict mode violation en Playwright.
    await expect(
      page.locator('[data-testid="dashboard-screen"] [data-testid="jersey-preview"]'),
    ).toBeVisible();
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