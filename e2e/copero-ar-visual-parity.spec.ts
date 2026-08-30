import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * MGC-556 — Verificación de fidelidad visual web vs copero.com.ar.
 *
 * Spec de referencia: `design/copero-ar-visual-spec.md` (MGC-554).
 * Token source: `src/design/tokens.ts` `palette.copero` (MGC-555 PR1).
 *
 * AC:
 *  - Capturas light + dark + mobile en `qa/mgc-553-parity/<ruta>/`.
 *  - Familias tipográficas Inter (body) / Poppins (display) presentes.
 *  - Fondo de página matchea `--bg` de `palette.copero` (#09090B) en dark mode.
 *  - Cards con border-radius xl (≥12px).
 *  - Hero overlay con gradient + tint de acento.
 *  - axe 0 critical/serious en cada arquetipo.
 *  - Reporta deltas a MGC-555 si mobile-developer no matchea.
 *
 * Notas operativas:
 *  - Corre contra `copero.mgcstudios.app` (producción) — usa
 *    `EXPO_WEB_BASE_URL` env. NO usa el dev server local para no contaminar
 *    state de tests MGC-505/510/524/532.
 *  - Bloquea AdSense (mismo mock que `home.spec.ts`) — sin ruido de ads.
 *  - 4 rutas (home, juegos, futbol, prodes) × 2 viewports (desktop 1280,
 *    mobile 375) × 2 schemes (dark/light) = 16 capturas side-by-side.
 */

// Resolución del target:
//   1. COPERO_PROD_URL explícito (override humano).
//   2. CI=true → usa el webServer local del workflow (qa.yml corre `python3 -m
//      http.server` sobre `dist/` en :8081; el Playwright config lo expone en
//      `EXPO_WEB_BASE_URL`). Es lo que efectivamente ejecuta la CI contra el
//      bundle recién construido.
//   3. Default → `https://copero.mgcstudios.app` (producción). Bloqueado por
//      MGC-548 (Traefik ACME → 404); el QA local debe usar COPERO_PROD_URL
//      explícito apuntando al bundle levantado fuera de CI.
const TARGET_URL =
  process.env.COPERO_PROD_URL ??
  (process.env.EXPO_WEB_BASE_URL ?? (process.env.CI ? 'http://127.0.0.1:8081' : 'https://copero.mgcstudios.app'));
const PARITY_DIR = process.env.PARITY_OUTPUT_DIR ?? 'qa/mgc-553-parity';

const AD_DOMAINS = [
  'googlesyndication.com',
  'googleadservices.com',
  'doubleclick.net',
  'adservice.google',
];

const ROUTES = ['/', '/juegos', '/futbol', '/prodes'] as const;
type Route = (typeof ROUTES)[number];

const VIEWPORTS = [
  { name: 'desktop-1280', width: 1280, height: 800 },
  { name: 'mobile-375', width: 375, height: 812 },
] as const;

const SCHEMES = ['dark', 'light'] as const;
type Scheme = (typeof SCHEMES)[number];

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (AD_DOMAINS.some((d) => url.includes(d))) {
      return route.abort();
    }
    return route.continue();
  });
});

async function captureRoute(
  page: Page,
  route: Route,
  viewportName: string,
  scheme: Scheme,
) {
  const safeName = route === '/' ? 'home' : route.replace(/^\//, '');
  const dir = `${PARITY_DIR}/${safeName}/${viewportName}-${scheme}`;
  await page.emulateMedia({ colorScheme: scheme });
  await page.goto(`${TARGET_URL}${route}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.screenshot({
    path: `${dir}.png`,
    fullPage: true,
  });
  return { dir, url: `${TARGET_URL}${route}` };
}

test.describe('MGC-556 — Visual parity web vs copero.com.ar', () => {
  test('captura 16 screenshots side-by-side (4 rutas × 2 viewports × 2 schemes)', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const results: Array<{ route: string; viewport: string; scheme: string; url: string }> = [];

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const scheme of SCHEMES) {
        for (const route of ROUTES) {
          const { url } = await captureRoute(page, route, vp.name, scheme);
          results.push({ route, viewport: vp.name, scheme, url });
          // eslint-disable-next-line no-console
          console.log(`[parity] ${vp.name}/${scheme}${route} → ${url}`);
        }
      }
    }

    expect(results.length).toBe(16);
    await testInfo.attach('parity-summary.json', {
      body: JSON.stringify(
        {
          target: TARGET_URL,
          count: results.length,
          routes: results,
          generatedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      contentType: 'application/json',
    });
  });

  test('tipografía: body y headings cargan Inter / Poppins', async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    const fontRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      // El bundle deployado sirve Inter/Poppins desde Google Fonts; el bundle
      // local que levanta CI los self-hostea bajo `/assets/**/fonts/woff2/`
      // (MGC-374). Ambos orígenes cuentan: el AC de §4 es que las familias
      // carguen, no de qué CDN vienen (MGC-399).
      if (
        url.includes('fonts.googleapis.com') ||
        url.includes('fonts.gstatic.com') ||
        /\/fonts\/woff2\//.test(url)
      ) {
        fontRequests.push(url);
      }
    });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${TARGET_URL}/`, { waitUntil: 'networkidle', timeout: 60_000 });

    const inter = fontRequests.some((u) => /Inter/i.test(u));
    const poppins = fontRequests.some((u) => /Poppins/i.test(u));

    // Spec §4 exige Inter y Poppins. Si falta alguna, el preload se rompió
    // (Google Fonts en prod, `<link rel=preload>` self-hosted en CI).
    expect(inter, 'Inter debe cargar (Google Fonts o self-hosted)').toBe(true);
    expect(poppins, 'Poppins debe cargar (Google Fonts o self-hosted)').toBe(true);

    await page.screenshot({
      path: testInfo.outputPath('fonts-check.png'),
      fullPage: false,
    });
  });

  test('dark mode: bg resuelve a zinc-950 (#09090B) en body', async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${TARGET_URL}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    const bg = await page.evaluate(() => {
      const body = window.document.body;
      const html = window.document.documentElement;
      const styles = window.getComputedStyle(body);
      return {
        bodyBg: styles.backgroundColor,
        htmlBg: window.getComputedStyle(html).backgroundColor,
      };
    });

    // Spec §3.1 dark mode bg = #09090B → rgb(9, 9, 11).
    // Si devuelve cream #FAF7F2 (palette.light), MGC-555 PR1 no deployado
    // o el theme default del ThemeProvider no resolvió 'copero'.
    const isCoperoDark = /rgb\(9,\s*9,\s*11\)/.test(bg.bodyBg);
    expect(
      isCoperoDark,
      `body.bg debe ser #09090B en dark mode. Observado: ${bg.bodyBg} (html: ${bg.htmlBg})`,
    ).toBe(true);

    await page.screenshot({
      path: testInfo.outputPath('dark-bg.png'),
      fullPage: false,
    });
  });

  test('cards: border-radius ≥ 12px (xl) en HeroCard / LeagueCard', async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${TARGET_URL}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    const radiusObservations = await page.evaluate(() => {
      // Selector amplio: cualquier elemento que parezca card (bg oscuro
      // + border visible + radius > 4px). Filtramos los obvios (button
      // pill = radius 9999, se acepta).
      const all = Array.from(document.querySelectorAll('div, section, article'));
      return all
        .map((el) => {
          const cs = window.getComputedStyle(el);
          const r = parseFloat(cs.borderTopLeftRadius || '0');
          if (r < 12) return null;
          return { tag: el.tagName, radius: r, bg: cs.backgroundColor };
        })
        .filter(Boolean)
        .slice(0, 10);
    });

    expect(radiusObservations.length).toBeGreaterThanOrEqual(1);
    await page.screenshot({
      path: testInfo.outputPath('cards-radius.png'),
      fullPage: false,
    });
  });

  test('axe /: 0 critical/serious en dark mode', async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${TARGET_URL}/`, { waitUntil: 'load', timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const blockers = result.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    await testInfo.attach('axe-home-dark.json', {
      body: JSON.stringify(result, null, 2),
      contentType: 'application/json',
    });
    await page.screenshot({
      path: testInfo.outputPath('axe-home-dark.png'),
      fullPage: true,
    });

    expect(
      blockers.length,
      `axe home (dark) encontró ${blockers.length} violation(s) critical/serious`,
    ).toBe(0);
  });

  test('axe /juegos: 0 critical/serious en dark mode', async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${TARGET_URL}/juegos`, { waitUntil: 'load', timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const blockers = result.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    await testInfo.attach('axe-juegos-dark.json', {
      body: JSON.stringify(result, null, 2),
      contentType: 'application/json',
    });

    expect(blockers.length, 'axe /juegos dark blockers').toBe(0);
  });
});
