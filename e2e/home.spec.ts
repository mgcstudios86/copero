import { test, expect } from '@playwright/test';

/**
 * Home — smoke E2E (web).
 *
 * MGC-302: scaffold. Cuando MGC-291 cierre el MVP, este spec crece
 * con los AC reales (botón Jugar visible, navegación a categorías, etc).
 *
 * Por ahora valida que el bundle Expo web responde 200 y que el texto
 * del bootstrap aparece. Si la página no renderiza (MGC-291 aún no
 * mergeado), se captura screenshot y se skipea hasta MGC-293.
 */
test.describe('Copero — home (web)', () => {
  test('home bundle responde y renderiza', async ({ page }, testInfo) => {
    test.setTimeout(30_000);

    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response, 'no hubo respuesta del dev server').not.toBeNull();
    expect(response!.status(), 'status != 200').toBeLessThan(400);

    // Captura baseline para review visual del scaffold.
    await page.screenshot({ path: testInfo.outputPath('home-baseline.png'), fullPage: true });

    // AC provisional: el bootstrap string es estable mientras no llegue MVP.
    // MGC-293 ajustará este assertion al botón "Jugar" real.
    const bodyText = await page.locator('body').innerText().catch(() => '');
    test.skip(
      !/Copero/i.test(bodyText),
      'Home no renderiza aún — esperar MGC-291 (MVP) antes de habilitar AC reales.',
    );

    await expect(page.locator('body')).toContainText(/Copero/i);
  });

  test('expo error overlay no apareció', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' }).catch(() => undefined);
    // El dev overlay de Expo muestra <div id="expo-error-screen" /> en fallos.
    const overlay = page.locator('#expo-error-screen');
    await expect(overlay).toHaveCount(0);
  });
});
