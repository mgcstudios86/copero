import { test, expect } from '@playwright/test';
import path from 'node:path';

/**
 * MGC-394 — QA visual del home limpio (splash + botón Jugar) + smoke
 * del simulador de carrera.
 *
 * Reemplaza MGC-505 (validaba "Convertite en Leyenda" + "Cómo se
 * juega" + form de identidad en home). Esos elementos fueron removidos
 * del landing en MGC-394: el home ahora sólo expone el splash
 * (assets/splash.png) y el botón Jugar.
 *
 * AC MGC-394:
 *  - Home muestra splash + botón Jugar verde (`btn-home-play`).
 *  - Home NO expone el chrome global (SiteHeader con 7 nav links +
 *    SiteFooter con Privacy · Terms · Contacto · GitHub). El chrome
 *    vive sólo en rutas internas.
 *  - Home NO expone los controles del home anterior (btn-career, btn-how-
 *    to-play, home-tag-list, home-jersey, btn-home-resume-career).
 *  - Tap en btn-home-play navega al simulador de carrera y el identity
 *    screen renderiza el JerseyPreview con los 4 grupos pos-{id}.
 */

const OUT_DIR = path.join(__dirname, '.results', 'mgc-394');

test.describe('MGC-394 — QA visual home (splash + Jugar) + simulador-carrera', () => {
  test.beforeAll(() => {
    require('node:fs').mkdirSync(OUT_DIR, { recursive: true });
  });

  test('home limpio (splash + Jugar) + navegación a simulador-carrera', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);

    // Estado limpio: cookies + storage.
    await page.context().clearCookies();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      try {
        window.localStorage.clear();
        window.sessionStorage.clear();
      } catch {
        /* noop */
      }
    });
    await page.reload({ waitUntil: 'domcontentloaded' });

    // 1) HOME limpio — splash + botón Jugar (MGC-394).
    await page.waitForSelector('[data-testid="home-screen"]', { timeout: 15_000 });
    await page.waitForSelector('[data-testid="home-screen-clean"]', { timeout: 5_000 });
    await page.screenshot({ path: path.join(OUT_DIR, '01-home-mgc394.png'), fullPage: true });

    // Splash visible.
    await expect(page.locator('[data-testid="home-splash-image"]')).toBeVisible();
    // CTA principal con label "Jugar".
    await expect(page.locator('[data-testid="btn-home-play"]')).toBeVisible();

    // Chrome global NO debe estar en home (AC MGC-394: sin GitHub/Terms).
    await expect(page.locator('[data-testid="copero-site-header"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="copero-site-footer"]')).toHaveCount(0);

    // Garantizar que NO están los controles del home anterior (MGC-505).
    const btnPlayCount = await page.locator('[data-testid="btn-play"]').count();
    const btnCompassCount = await page.locator('[data-testid="btn-compass"]').count();
    expect(btnPlayCount, 'home no debe exponer btn-play').toBe(0);
    expect(btnCompassCount, 'home no debe exponer btn-compass').toBe(0);
    await expect(page.locator('[data-testid="btn-career"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="btn-how-to-play"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="home-tag-list"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="home-jersey"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="btn-home-resume-career"]')).toHaveCount(0);

    // 2) Navegación al simulador-carrera. El push a la raíz del
    // simulador dispara el flow identity/dashboard según el snapshot
    // persistido. En estado limpio cae en /identity.
    await page.locator('[data-testid="btn-home-play"]').click();
    await page.waitForURL(/\/simulador-carrera(\/.*)?$/, { timeout: 10_000 });
    // El chrome global reaparece en rutas internas.
    await expect(page.locator('[data-testid="copero-site-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="copero-site-footer"]')).toBeVisible();
    await page.screenshot({
      path: path.join(OUT_DIR, '02-after-tap-play.png'),
      fullPage: true,
    });

    // Adjuntar el screenshot principal al report de Playwright.
    testInfo.attachments.push({
      name: 'mgc-394-home',
      path: path.join(OUT_DIR, '01-home-mgc394.png'),
      contentType: 'image/png',
    });
  });
});