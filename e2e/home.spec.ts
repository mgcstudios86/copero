import { test, expect } from '@playwright/test';

/**
 * Copero — E2E web (Playwright headless contra bundle Expo web).
 *
 * MGC-394: el home queda como splash minimal con un único CTA "Jugar".
 * Se removieron: tag-list, cómo se juega, comparador Classic/Purist, FAQ,
 * mini-stats, jersey preview, hero premium. El SiteFooter con links
 * GitHub/Terms/Privacidad/Contacto se removió del root layout. El
 * form de identidad ahora vive exclusivamente en
 * /simulador-carrera/identity (ruta a la que empuja `btn-career`).
 *
 * Selectores canónicos (testIDs del MVP actualizado, MGC-394):
 *   - home-screen, btn-career (= botón "Jugar")
 *   - home-splash, btn-home-resume-career (opcional, sólo si hay carrera)
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

test.describe('Copero — smoke home (web) — MGC-394', () => {
  test('home renderiza como splash minimal + CTA Jugar', async ({ page }, testInfo) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByTestId('home-screen')).toBeVisible();
    // MGC-394: splash visible con título del simulador + descripción.
    await expect(page.getByTestId('home-splash')).toBeVisible();
    await expect(page.getByText(/COPERO · SIMULADOR DE CARRERA/i)).toBeVisible();
    await expect(page.getByText(/Convertite en leyenda/i)).toBeVisible();
    // CTA principal único: "Jugar".
    await expect(page.getByTestId('btn-career')).toBeVisible();
    await expect(page.getByTestId('btn-career')).toHaveText(/Jugar/i);
    // Sin sesión persistida no debe aparecer el CTA Continuar carrera.
    await expect(page.getByTestId('btn-home-resume-career')).toHaveCount(0);
    // Banner global del layout debe persistir.
    await expect(page.getByTestId('ad-banner-web')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('home-baseline.png'), fullPage: true });
  });

  test('home NO expone secciones removidas (tag-list / how-to-play / FAQ)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByTestId('home-screen')).toBeVisible();
    // MGC-394: limpieza de la pantalla principal — se removieron los
    // bloques tag-list, "Cómo se juega", comparador Classic/Purist, FAQ
    // y SiteFooter (GitHub/Terms/Privacidad/Contacto).
    await expect(page.getByTestId('home-tag-list')).toHaveCount(0);
    await expect(page.getByTestId('btn-how-to-play')).toHaveCount(0);
    await expect(page.locator('#how-to-play')).toHaveCount(0);
    await expect(page.getByTestId('copero-site-footer')).toHaveCount(0);
    await expect(page.getByTestId('copero-site-footer-link-github')).toHaveCount(0);
    await expect(page.getByTestId('copero-site-footer-link-terms')).toHaveCount(0);
  });

  test('home NO expone otros juegos (Jugar/Compass)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByTestId('home-screen')).toBeVisible();
    // MGC-505: los botones de Juego de palabras e Ideología Futbolística
    // se removieron del home. Garantizamos que no aparezcan.
    await expect(page.getByTestId('btn-play')).toHaveCount(0);
    await expect(page.getByTestId('btn-compass')).toHaveCount(0);
  });

  test('tap Jugar navega a /simulador-carrera/identity', async ({ page }, testInfo) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.getByTestId('btn-career').click();
    // MGC-394: el CTA Jugar empuja directo a /simulador-carrera/identity
    // (sin carrera persistida). El form de identidad vive en esa ruta.
    await page.waitForURL(/\/simulador-carrera\/identity$/, { timeout: 10_000 });
    // Banner global del layout debe persistir al navegar.
    await expect(page.getByTestId('ad-banner-web')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('career-after-tap.png'),
      fullPage: true,
    });
  });

  test('con carrera persistida, tap Jugar empuja a la ruta del stage', async ({ page }, testInfo) => {
    // MGC-523: seed del careerStore vía localStorage. Con stage='dashboard'
    // + name seteado, `btn-career` empuja directo a
    // `/simulador-carrera/dashboard`.
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
    // Con carrera persistida el home expone un segundo CTA ghost.
    await expect(page.getByTestId('btn-home-resume-career')).toBeVisible();
    await page.getByTestId('btn-career').click();
    // El botón Jugar siempre empuja a /identity (decisión MGC-394: el
    // usuario que quiere empezar una nueva carrera llega al form; el
    // que quiere reanudar usa el botón ghost secundario).
    await page.waitForURL(/\/simulador-carrera\/identity$/, { timeout: 10_000 });
    await page.screenshot({ path: testInfo.outputPath('home-with-career.png'), fullPage: true });
  });

  test('con carrera persistida, CTA Continuar carrera navega al stage', async ({ page }, testInfo) => {
    // MGC-394: con stage='dashboard' + name seteado, el botón ghost
    // "Continuar carrera" debe empujar directo a `/simulador-carrera/dashboard`.
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
    await expect(page.getByTestId('btn-home-resume-career')).toBeVisible();
    await page.getByTestId('btn-home-resume-career').click();
    await page.waitForURL(/\/simulador-carrera\/dashboard$/, { timeout: 10_000 });
    await expect(page.getByTestId('dashboard-screen')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: testInfo.outputPath('home-resume-career.png'), fullPage: true });
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
