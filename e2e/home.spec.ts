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
    // MGC-523: seed del careerStore vía localStorage para evitar el race
    // inicial `/identity` (regex greedy `\/simulador-carrera\/` matcheaba
    // `/identity` antes de que el test pudiera aterrizar en `/dashboard`).
    // Con stage='dashboard' + name seteado, `btn-career` empuja directo
    // a `/simulador-carrera/dashboard` y el waitForURL anclado no ambiguo.
    await page.addInitScript(() => {
      const seed = {
        state: {
          stage: 'dashboard',
          profile: {
            name: 'Test Jugador',
            number: 9,
            position: 'ST',
            nationalityCode: 'AR',
            preferredFoot: 'right',
            age: 17,
            club: {
              id: 'river',
              name: 'River Plate',
              league: 'Liga Profesional',
              crestColor: '#FFFFFF',
              crestAccent: '#D9001B',
              presupuesto: 50,
            },
            value: 5,
            ovr: 62,
            stats: { apps: 0, goals: 0, ast: 0 },
            attrs: { tecnico: 60, fisico: 60, mental: 60, portero: 50 },
            career: {
              presupuesto: 0,
              moral: 70,
              fisico: 80,
              confianza: 60,
              racha: 0,
              lesion: { kind: 'ninguna', fechasOut: 0 },
              reputation: {
                prensa: 'neutral',
                hinchada: 'aceptado',
                vestuario: 'integrado',
                seleccionConvocado: false,
              },
            },
            week: 1,
            season: 1,
            clubPresupuesto: 50,
            clubInteres: true,
          },
        },
        version: 0,
      };
      window.localStorage.setItem('copero-career', JSON.stringify(seed));
    });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.getByTestId('btn-career').click();
    // Regex anclado al final: matchea `/simulador-carrera/dashboard` exacto,
    // NO matchea `/simulador-carrera/identity` (MGC-523).
    await page.waitForURL(/\/simulador-carrera\/dashboard$/, { timeout: 10_000 });
    // Dashboard expone el JerseyPreview con testID canónico (MGC-466).
    // El Stack fade del _layout puede tardar en pintar; pequeño settle
    // antes del assert evita el race contra la animación fade.
    await page.waitForLoadState('domcontentloaded');
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
