import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/**
 * MGC-505 — captura visual regression (home + simulador-carrera identity)
 * para validar el rediseño del home (Convertite en Leyenda).
 *
 * El viejo flujo /categoria (Juego de palabras) y /compass (Ideología
 * Futbolística) ya no se exponen desde el home. Persisten como rutas
 * para deep-linking, pero la qa.yml SPA workaround no permite goto
 * directo (`python3 -m http.server` sin fallback), así que el único
 * camino verificable vía Playwright es el nuevo CTA `btn-career`.
 *
 * Las capturas viven en /tmp/mgc373 (Linux runner) y /tmp/mgc373-* local.
 */

test.describe('Copero — visual regression MGC-505', () => {
  test('captura home + simulador-carrera/identity con CTA único', async ({ page }) => {
    test.setTimeout(90_000);
    mkdirSync('/tmp/mgc373', { recursive: true });

    // 1) Home rediseñado (Convertite en Leyenda + CTA carrera).
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="home-screen"]', { timeout: 15000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/mgc373/home.png', fullPage: true });

    // 2) simulador-carrera/identity (reemplaza la vieja captura de /categoria).
    await page.locator('[data-testid="btn-career"]').click();
    await page.waitForURL('**/simulador-carrera/identity', { timeout: 10000 });
    await page.waitForSelector('[data-testid="identity-screen"]', { timeout: 10000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/mgc373/identity.png', fullPage: true });
  });
});