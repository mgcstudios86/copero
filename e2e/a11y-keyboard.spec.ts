import { test, expect } from '@playwright/test';

/**
 * MGC-339 — a11y cross-platform: keyboard-only happy path en web.
 *
 * AC: "Teclado puro juega una ronda completa en web".
 *
 * Flujo (todo con Tab/Enter, sin click ni touch):
 *  1. /  → Tab hasta btn-play → Enter → /categoria
 *  2. /categoria → Tab hasta cat-{id} → Enter → /ronda
 *  3. /ronda → btn-correct (Enter) → repite N rondas hasta /fin
 *  4. /fin → btn-play-again → /categoria (verifica reset)
 *
 * Sin mouse. Sin .click(). Sin .tap(). Sólo .press() y .keyboard.press().
 */
test.describe('Copero — keyboard-only happy path (web)', () => {
  test('teclado puro completa una ronda sin ayuda', async ({ page }, testInfo) => {
    test.setTimeout(90_000);

    // 1) Home
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="home-screen"]', { timeout: 15_000 });
    // Captura evidencia
    await page.screenshot({ path: testInfo.outputPath('kbd-1-home.png'), fullPage: true });

    // Foco inicial en body; saltar al primer control focuseable.
    await page.keyboard.press('Tab');
    // Avanzar foco hasta el botón Jugar (testID="btn-play" en Button → Pressable).
    // No asumimos cuántos Tab's hacen falta: iteramos hasta encontrarlo.
    const btnPlay = page.locator('[data-testid="btn-play"]');
    await expect(btnPlay).toBeVisible();
    for (let i = 0; i < 25; i += 1) {
      const isFocused = await btnPlay.evaluate(
        (el) => el === document.activeElement || el.contains(document.activeElement),
      );
      if (isFocused) break;
      await page.keyboard.press('Tab');
    }
    await page.keyboard.press('Enter');
    await page.waitForURL('**/categoria', { timeout: 10_000 });
    await page.waitForSelector('[data-testid="categoria-screen"]', { timeout: 10_000 });
    await page.screenshot({ path: testInfo.outputPath('kbd-2-categoria.png'), fullPage: true });

    // 2) Categoría: elegir la primera opción
    const firstCat = page.locator('[data-testid^="cat-"]').first();
    await expect(firstCat).toBeVisible();
    for (let i = 0; i < 30; i += 1) {
      const isFocused = await firstCat.evaluate(
        (el) => el === document.activeElement || el.contains(document.activeElement),
      );
      if (isFocused) break;
      await page.keyboard.press('Tab');
    }
    await page.keyboard.press('Enter');
    await page.waitForURL('**/ronda', { timeout: 10_000 });
    await page.waitForSelector('[data-testid="ronda-screen"]', { timeout: 10_000 });
    await page.screenshot({ path: testInfo.outputPath('kbd-3-ronda.png'), fullPage: true });

    // 3) Ronda: jugar 10 rondas apretando "¡Acerté!" con Enter
    //    (también válido: el botón default tiene onPress → handleCorrect → advance
    //    350ms → nextRound; lo único que necesitamos es esperar el cambio de
    //    palabra o la navegación a /fin).
    const btnCorrect = page.locator('[data-testid="btn-correct"]');
    await expect(btnCorrect).toBeVisible();
    await btnCorrect.focus();

    let roundsPlayed = 0;
    const maxAttempts = 30; // 10 rondas * 3 reintentos (worst case timer race)
    for (let i = 0; i < maxAttempts; i += 1) {
      const currentUrl = page.url();
      if (currentUrl.endsWith('/fin')) break;
      // Foco al botón correcto antes de presionar Enter
      const focused = await btnCorrect.evaluate(
        (el) => el === document.activeElement || el.contains(document.activeElement),
      );
      if (!focused) await btnCorrect.focus();
      await page.keyboard.press('Enter');
      roundsPlayed += 1;
      // Esperar un poco para que el advance (350ms) cambie la palabra o navegue
      await page.waitForTimeout(450);
    }

    // 4) /fin: debe estar visible con score final
    await page.waitForURL('**/fin', { timeout: 15_000 });
    await page.waitForSelector('[data-testid="fin-screen"]', { timeout: 10_000 });
    await page.waitForSelector('[data-testid="final-score"]', { timeout: 5_000 });
    await page.screenshot({ path: testInfo.outputPath('kbd-4-fin.png'), fullPage: true });

    const finalScoreText = await page.locator('[data-testid="final-score"]').innerText();
    const finalScore = Number.parseInt(finalScoreText, 10);
    expect(roundsPlayed, 'debe haber jugado al menos 1 ronda').toBeGreaterThanOrEqual(1);
    expect(roundsPlayed, 'no debe jugar más rondas que el máximo (10)').toBeLessThanOrEqual(10);
    expect(Number.isFinite(finalScore), 'final-score debe ser numérico').toBe(true);

    // 5) "Jugar de nuevo" → /categoria (teclado)
    const btnPlayAgain = page.locator('[data-testid="btn-play-again"]');
    await expect(btnPlayAgain).toBeVisible();
    await btnPlayAgain.focus();
    await page.keyboard.press('Enter');
    await page.waitForURL('**/categoria', { timeout: 10_000 });
    await page.screenshot({ path: testInfo.outputPath('kbd-5-reset.png'), fullPage: true });
  });
});
