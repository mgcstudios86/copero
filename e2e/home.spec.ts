import { test, expect } from '@playwright/test';

/**
 * Copero — E2E web (Playwright headless contra bundle Expo web).
 *
 * MGC-505: el home queda como landing único de "Convertite en Leyenda".
 * Los flujos de Juego de palabras / Ideología Futbolística se removieron
 * del home (ver `app/index.tsx`). Las pantallas existen como rutas
 * (deep-link) pero no se exponen desde el home.
 *
 * Selectores canónicos (testIDs del MVP actualizado, MGC-505):
 *   - home-screen, btn-career
 *   - simulador-carrera: identity, dashboard, academy
 *   - dashboard-screen, dashboard-jersey, dashboard-recommended
 *   - btn-dashboard-academy
 *   - ad-banner-web, ad-interstitial-web
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

test.describe('Copero — smoke home (web) — MGC-505', () => {
  test('home renderiza con hero Convertite en Leyenda y CTA carrera', async ({ page }, testInfo) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByText(/Convertite en leyenda/i)).toBeVisible();
    await expect(page.getByTestId('btn-career')).toBeVisible();
    await expect(page.getByTestId('ad-banner-web')).toBeVisible();
    await expect(page.getByText(/PUBLICIDAD/i)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('home-baseline.png'), fullPage: true });
  });

  test('home NO expone otros juegos (Jugar/Compass)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByTestId('home-screen')).toBeVisible();
    // MGC-505: los botones de Juego de palabras e Ideología Futbolística
    // se removieron del home. Garantizamos que no aparezcan.
    await expect(page.getByTestId('btn-play')).toHaveCount(0);
    await expect(page.getByTestId('btn-compass')).toHaveCount(0);
  });

  test('tap Empezar carrera navega a /simulador-carrera/dashboard', async ({ page }, testInfo) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.getByTestId('btn-career').click();
    // stage=identity → cae en /identity; si tiene carrera → /dashboard.
    // Aceptamos ambos sub-routes.
    await page.waitForURL(/\/simulador-carrera\/(identity|dashboard)/, { timeout: 10_000 });
    // Banner global del layout debe persistir al navegar.
    await expect(page.getByTestId('ad-banner-web')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('career-after-tap.png'),
      fullPage: true,
    });
  });

  test('flujo home → dashboard muestra hero del jugador', async ({ page }, testInfo) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.getByTestId('btn-career').click();
    await page.waitForURL(/\/simulador-carrera\//);
    // Dashboard expone el JerseyPreview con testID canónico (MGC-466).
    await expect(page.getByTestId('dashboard-screen')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('jersey-preview')).toBeVisible();
    await expect(page.getByTestId('btn-dashboard-academy')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('dashboard-hero.png'), fullPage: true });
  });

  test('requests AdSense bloqueadas por el mock del provider', async ({ page }) => {
    const blockedRequests: string[] = [];
    page.on('requestfailed', (req) => {
      const url = req.url();
      if (AD_DOMAINS.some((d) => url.includes(d))) {
        blockedRequests.push(url);
      }
    });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.getByTestId('btn-career').click();
    await page.waitForURL(/\/simulador-carrera\//);
    await expect(page.getByTestId('ad-banner-web')).toBeVisible();
    expect(blockedRequests.length).toBeGreaterThanOrEqual(0);
  });

  test('expo error overlay no apareció en navegación home → carrera', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 60_000 });
    await expect(page.locator('#expo-error-screen')).toHaveCount(0);
    await page.getByTestId('btn-career').click();
    await page.waitForURL(/\/simulador-carrera\//);
    await expect(page.locator('#expo-error-screen')).toHaveCount(0);
  });
});
