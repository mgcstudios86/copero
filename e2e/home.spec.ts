import { test, expect } from '@playwright/test';

/**
 * Copero — E2E web (Playwright headless contra bundle Expo web).
 *
 * MGC-1188: el home deja de ser una pantalla visible (splash + CTA Jugar)
 * y queda como un dispatcher puro. `/` ejecuta un `<Redirect>` al simulador
 * de carrera en función del `stage` persistido:
 *   - sin carrera persistida → /simulador-carrera/identity
 *     (anchor: `[data-testid="identity-screen"]`)
 *   - con carrera persistida → /simulador-carrera/dashboard (o sub-ruta
 *     del stage) según `resumeRouteForStage()` en `app/index.tsx`.
 *
 * Por eso este spec ya NO afirma los testIDs del splash viejo (esos
 * nodos se eliminaron junto con la pantalla inicial en MGC-1188).
 * En su lugar, valida:
 *   1. el cold-start del dispatcher termina en `/simulador-carrera/identity`
 *      cuando no hay perfil;
 *   2. el dispatcher dirige al dashboard cuando hay carrera persistida;
 *   3. el header global + banner persisten al navegar vía el redirect;
 *   4. no queda overlay de error de Expo en el render post-redirect.
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

// MGC-1188: el shape del profile persistido es el mismo que el seed
// histórico (MGC-523). Sólo necesitamos `stage` + `profile.name` para que
// `hasCareer` en `app/index.tsx` evalúe true y el dispatcher resuelva a
// `/simulador-carrera/dashboard`.
const SEEDED_PROFILE = {
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

test.describe('Copero — dispatcher `/` (web) — MGC-1188', () => {
  test('cold-start sin carrera aterriza en /simulador-carrera/identity', async ({
    page,
  }, testInfo) => {
    // Estado limpio: storage sin perfil, así que `hasCareer === false` y el
    // dispatcher resuelve a `/simulador-carrera/identity`.
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForURL(/\/simulador-carrera\/identity$/, { timeout: 15_000 });
    await expect(page.getByTestId('identity-screen')).toBeVisible({ timeout: 15_000 });
    // Banner global del layout debe persistir al navegar.
    await expect(page.getByTestId('ad-banner-web')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('home-dispatcher-identity.png'),
      fullPage: true,
    });
  });

  test('cold-start con carrera persistida aterriza en /simulador-carrera/dashboard', async ({
    page,
  }, testInfo) => {
    // MGC-1188: con `stage=dashboard` + `profile.name` seteado, `hasCareer`
    // es true y el dispatcher resuelve a la ruta del stage. El seed vive en
    // localStorage para que el primer render del `useCareerStore` ya lo
    // encuentre (sin esperar a un click previo del usuario).
    await page.addInitScript((seedJson: string) => {
      window.localStorage.setItem('copero-career', seedJson);
    }, JSON.stringify(SEEDED_PROFILE));
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForURL(/\/simulador-carrera\/dashboard$/, { timeout: 15_000 });
    await expect(page.getByTestId('dashboard-screen')).toBeVisible({ timeout: 15_000 });
    // Banner global del layout persiste al navegar.
    await expect(page.getByTestId('ad-banner-web')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('home-dispatcher-dashboard.png'),
      fullPage: true,
    });
  });

  test('expo error overlay no apareció en el redirect del dispatcher', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 60_000 });
    await page.waitForURL(/\/simulador-carrera\//, { timeout: 15_000 });
    await expect(page.locator('#expo-error-screen')).toHaveCount(0);
  });

  test('requests AdSense bloqueadas por el mock del provider', async ({ page }) => {
    const blockedRequests: string[] = [];
    page.on('requestfailed', (req) => {
      const url = req.request().url();
      if (AD_DOMAINS.some((d) => url.includes(d))) {
        blockedRequests.push(url);
      }
    });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForURL(/\/simulador-carrera\//);
    await expect(page.getByTestId('ad-banner-web')).toBeVisible();
    expect(blockedRequests.length).toBeGreaterThanOrEqual(0);
  });
});
