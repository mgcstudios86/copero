import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/**
 * MGC-505 + MGC-1188 — captura visual regression del landing del simulador
 * (dispatcher de `/` → identity, sin home splash visible).
 *
 * El viejo flujo /categoria (Juego de palabras) y /compass (Ideología
 * Futbolística) ya no se exponen desde el home. Persisten como rutas
 * para deep-linking, pero la qa.yml SPA workaround no permite goto
 * directo (`python3 -m http.server` sin fallback), así que el camino
 * verificable vía Playwright es el dispatcher de `/` (MGC-1188) que
 * redirige a `/simulador-carrera/identity` cuando no hay perfil.
 *
 * Las capturas viven en /tmp/mgc373 (Linux runner) y /tmp/mgc373-* local.
 */

test.describe('Copero — visual regression MGC-505 / MGC-1188', () => {
  test('captura simulador-carrera/identity tras dispatcher de /', async ({ page }) => {
    test.setTimeout(90_000);
    mkdirSync('/tmp/mgc373', { recursive: true });

    // MGC-2254: goto directo a identity (home dejo de ser dispatcher
    // tras MGC-1397 / PR #340 — ahora splash visible con CTA Jugar).
    await page.goto('/simulador-carrera/identity', { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="identity-screen"]', { timeout: 15_000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/mgc373/identity.png', fullPage: true });
  });
});