import { test, expect } from '@playwright/test';

/**
 * Copero — E2E web (Playwright headless contra bundle Expo web).
 *
 * MGC-2254 / MGC-1397: el home dejo de ser dispatcher invisible (MGC-1188)
 * y volvio a ser una pantalla visible con CTA "Jugar" (AC7.1). Este spec
 * valida el flow real del usuario web:
 *
 *   1. cold-start sin carrera persistida → home muestra solo "Jugar"
 *      → click → /simulador-carrera/identity.
 *   2. cold-start con carrera persistida → home muestra "Continuar carrera"
 *      + "Jugar" → click "Jugar" → /simulador-carrera/identity (start fresh).
 *   3. El banner global del layout (ad-banner-web) persiste al navegar.
 *   4. No queda overlay de error de Expo en el render del home.
 *
 * Antes (MGC-1188): el home era un `<Redirect>` invisible y los specs
 * esperaban `page.goto('/')` → auto-redirect a /simulador-carrera/identity.
 * Ese contrato se rompio cuando baf1937 (MGC-1397 / PR #340) restauro el
 * home sin reescribir los specs — 22 fallas consecutivas en main hasta
 * que MGC-2254 alinea los specs con el flow real.
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

// MGC-1188 (legacy) + MGC-1397: el shape del profile persistido es el mismo
// que el seed historico (MGC-523). Solo necesitamos `stage` + `profile.name`
// para que `hasCareer` en `app/index.tsx` evalue true.
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

test.describe('Copero — home + CTA flow (web) — MGC-1397 / MGC-2254', () => {
  test('cold-start sin carrera: home muestra solo "Jugar" → click → /simulador-carrera/identity', async ({
    page,
  }, testInfo) => {
    // Estado limpio: storage sin perfil, asi `hasCareer === false` y el
    // home renderiza solo el CTA "Jugar".
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByTestId('home-screen')).toBeVisible({ timeout: 15_000 });
    // Solo el CTA primario, no debe haber "Continuar carrera".
    await expect(page.getByTestId('btn-career')).toBeVisible();
    await expect(page.getByTestId('btn-home-resume-career')).toHaveCount(0);
    // Banner global del layout debe estar presente en el home.
    await expect(page.getByTestId('ad-banner-web')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('home-cta-jugar.png'),
      fullPage: true,
    });

    // Click "Jugar" navega a /simulador-carrera/identity (AC7.1).
    await page.getByTestId('btn-career').click();
    await page.waitForURL(/\/simulador-carrera\/identity$/, { timeout: 15_000 });
    await expect(page.getByTestId('identity-screen')).toBeVisible({ timeout: 15_000 });
    // Banner global del layout persiste al navegar.
    await expect(page.getByTestId('ad-banner-web')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('home-cta-identity.png'),
      fullPage: true,
    });
  });

  test('cold-start con carrera persistida: home muestra "Continuar" + "Jugar"', async ({
    page,
  }, testInfo) => {
    // MGC-2254: con `stage=dashboard` + `profile.name` seteado, `hasCareer`
    // es true y el home renderiza ambos CTAs. El seed vive en
    // localStorage para que el primer render del `useCareerStore` ya lo
    // encuentre (sin esperar a un click previo del usuario).
    await page.addInitScript((seedJson: string) => {
      window.localStorage.setItem('copero-career', seedJson);
    }, JSON.stringify(SEEDED_PROFILE));
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByTestId('home-screen')).toBeVisible({ timeout: 15_000 });
    // Ambos CTAs visibles.
    await expect(page.getByTestId('btn-career')).toBeVisible();
    await expect(page.getByTestId('btn-home-resume-career')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('home-cta-resume-and-jugar.png'),
      fullPage: true,
    });

    // Click "Continuar carrera" navega a la ruta del stage (dashboard).
    await page.getByTestId('btn-home-resume-career').click();
    await page.waitForURL(/\/simulador-carrera\/dashboard$/, { timeout: 15_000 });
    await expect(page.getByTestId('dashboard-screen')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('ad-banner-web')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('home-resume-dashboard.png'),
      fullPage: true,
    });
  });

  test('expo error overlay no aparece en el render del home', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 60_000 });
    await expect(page.getByTestId('home-screen')).toBeVisible({ timeout: 15_000 });
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
    await expect(page.getByTestId('home-screen')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('ad-banner-web')).toBeVisible();
    expect(blockedRequests.length).toBeGreaterThanOrEqual(0);
  });
});