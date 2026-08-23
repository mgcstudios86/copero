import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/**
 * MGC-373 — captura visual regression (home / categoria / compass)
 * para validar el fix de contraste + Lighthouse ≥ 90 sobre /.
 * Las capturas viven en /tmp/mgc373 (Linux runner) y /tmp/mgc373-* local.
 */

test.describe('Copero — visual regression MGC-373', () => {
  test('captura home, categoria, compass con Button primary', async ({ page }) => {
    test.setTimeout(90_000);
    mkdirSync('/tmp/mgc373', { recursive: true });
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="home-screen"]', { timeout: 15000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/mgc373/home.png', fullPage: true });

    await page.locator('[data-testid="btn-play"]').click();
    await page.waitForURL('**/categoria', { timeout: 10000 });
    await page.waitForSelector('[data-testid="categoria-screen"]', { timeout: 10000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/mgc373/categoria.png', fullPage: true });

    // Volver a home y abrir compass
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="home-screen"]', { timeout: 10000 });
    await page.locator('[data-testid="btn-compass"]').click();
    await page.waitForURL('**/compass', { timeout: 10000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: '/tmp/mgc373/compass.png', fullPage: true });
  });
});
