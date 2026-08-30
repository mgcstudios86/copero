import { test, expect } from '@playwright/test';

/**
 * Copero — E2E web (Playwright headless contra bundle Expo web).
 *
 * MGC-394: el home queda como splash + botón Jugar. Se removieron del
 * landing la hero card premium, tag-list, comparador Classic/Purist,
 * FAQ, "Ver cómo se juega", "Continuar carrera", dorsal, form de
 * identidad (HomepageCareerStarter) y el chrome global (SiteHeader con
 * 7 nav links + SiteFooter con Privacy · Terms · Contacto · GitHub +
 * Banner de ads). El chrome vive ahora solo en rutas internas — ver
 * `app/_layout.tsx`, `_layout.native.tsx`, `_layout.web.tsx` (usan
 * `usePathname()` para ocultarlo cuando pathname === '/').
 *
 * Selectores canónicos (testIDs del home limpio, MGC-394):
 *   - home-screen-clean, home-splash-image
 *   - btn-home-play (label "Jugar", navega a /simulador-carrera)
 *
 * Selectores removidos (ya no aplican):
 *   - home-tag-list, home-jersey, home-draft-* (cards del fold)
 *   - btn-career, btn-how-to-play, btn-home-resume-career
 *   - copero-site-header, copero-site-footer (chrome global)
 */

// Bloquea requests a proveedores de ads externos. Determinismo en CI.
const AD_DOMAINS = [
  'googlesyndication.com',
  'googleadservices.com',
  'doubleclick.net',
  'adservice.google',
];

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (AD_DOMAINS.some((d) => url.includes(d))) {
      return route.abort();
    }
    return route.continue();
  });
});

test.describe('Copero — smoke home (web) — MGC-394 splash + Jugar', () => {
  test('home renderiza splash + botón Jugar sin chrome', async ({ page }, testInfo) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    // El landing limpio expone el contenedor + el splash + el CTA.
    await expect(page.getByTestId('home-screen-clean')).toBeVisible();
    await expect(page.getByTestId('home-splash-image')).toBeVisible();
    await expect(page.getByTestId('btn-home-play')).toBeVisible();
    // Chrome global NO debe estar en home (MGC-394 AC: sin links GitHub/Terms).
    await expect(page.getByTestId('copero-site-header')).toHaveCount(0);
    await expect(page.getByTestId('copero-site-footer')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('home-clean.png'), fullPage: true });
  });

  test('home NO expone los controles del landing anterior', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByTestId('home-screen-clean')).toBeVisible();
    // AC MGC-394: ningún elemento del home anterior debe quedar visible.
    await expect(page.getByTestId('home-tag-list')).toHaveCount(0);
    await expect(page.getByTestId('home-jersey')).toHaveCount(0);
    await expect(page.getByTestId('btn-career')).toHaveCount(0);
    await expect(page.getByTestId('btn-how-to-play')).toHaveCount(0);
    await expect(page.getByTestId('btn-home-resume-career')).toHaveCount(0);
  });

  test('tap Jugar navega a /simulador-carrera y chrome reaparece', async ({ page }, testInfo) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.getByTestId('btn-home-play').click();
    // Landing chrome-less empuja a /simulador-carrera; las sub-rutas
    // (identity/dashboard/...) las resuelve el flow de carrera existente.
    await page.waitForURL(/\/simulador-carrera(\/.*)?$/, { timeout: 10_000 });
    // Al entrar a una ruta interna el chrome global reaparece.
    await expect(page.getByTestId('copero-site-header')).toBeVisible();
    await expect(page.getByTestId('copero-site-footer')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('home-after-tap-play.png'),
      fullPage: true,
    });
  });

  test('expo error overlay no apareció en home limpio', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 60_000 });
    await expect(page.locator('#expo-error-screen')).toHaveCount(0);
    await page.getByTestId('btn-home-play').click();
    await page.waitForURL(/\/simulador-carrera/);
    await expect(page.locator('#expo-error-screen')).toHaveCount(0);
  });
});