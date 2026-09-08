import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fillRnw, pressRnw } from './fixtures/rnw-fill';

/**
 * Copero — Evidencia E2E simulador-carrera (MGC-444).
 *
 * Ejecuta el happy path completo y captura screenshots + axe scans + persistencia.
 * Ramo: qa/mgc-444-simulador-carrera (basado en origin/main @ 36428343).
 *
 *   home → CTA Simulador → identity → dashboard → academy → clubStart → dashboard.
 *
 * Artefactos:
 *   - e2e/.results/<test>-*.png       (screenshots)
 *   - logs de axe violations totales  (consola)
 *   - persistencia: profile name visible tras reload
 */

const AD_DOMAINS = [
  'googlesyndication.com',
  'googleadservices.com',
  'doubleclick.net',
  'adservice.google',
];

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (AD_DOMAINS.some((d) => url.includes(d))) return route.abort();
    return route.continue();
  });
  // MGC-620: NO registrar handler global de 'dialog' aquí — generaba race con el
  // page.once() del test #3 (ambos consumen el mismo Alert del clubStart, el
  // segundo lanza "Cannot accept dialog which is already handled"). Cada test
  // que dispara Alert registra su propio handler antes del click.
});

async function completeIdentity(page: any, name: string) {
  // MGC-2254: goto directo a identity (home ya no es dispatcher
  // tras MGC-1397 / PR #340). El serve-spa.py del workflow hace
  // SPA fallback a index.html para rutas como /simulador-carrera/identity.
  await page.goto('/simulador-carrera/identity', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('identity-screen')).toBeVisible({ timeout: 15_000 });
  // MGC-2254 v3 / MGC-2356: en el runner self-hosted (copero-heavy, Mac mini
  // ARM64, Chromium headless) ni `fill` ni pressSequentially disparan
  // `onChangeText` antes del primer paint post-hidratacion. `fillRnw`
  // (fixtures/rnw-fill.ts) hace click + fill + dispatchEvent('input')
  // con el setter nativo de HTMLInputElement.value, lo que fuerza a
  // React a reconciliar el state y deja canContinue()=true.
  await fillRnw(page.getByTestId('input-name'), name);
  // MGC-2475: input-lastname es required por isIdentityComplete post MGC-1628.
  // Derivamos del param `name` (siempre "First Last") para no romper callers.
  const lastName = name.includes(' ') ? name.split(' ').slice(-1)[0] : 'Apellido';
  await fillRnw(page.getByTestId('input-lastname'), lastName);
  await page.locator('[data-testid^="pos-"]').first().click();
  await fillRnw(page.getByTestId('input-nationality-search'), 'arg');
  await page.waitForTimeout(400);
  // MGC-2254: click country-ARG tras el fill. MGC-1348 v3 — `force:true`
  // por hit-test RNW.
  // MGC-2494: `force: true` salta el hit-test y el onPress del Pressable
    // RNW nunca corría → nationalityCode quedaba null. `pressRnw` clickea de
    // verdad (con fallbacks).
    await pressRnw(page.getByTestId('country-ARG'));
  // Espera explicita a que el boton se habilite (canContinue = true).
  await expect(page.getByTestId('btn-identity-continue')).toBeEnabled({ timeout: 15_000 });
  await page.getByTestId('btn-identity-continue').click();
  await page.waitForURL(/\/simulador-carrera\/dashboard/, { timeout: 10_000 });
  await expect(page.getByTestId('dashboard-screen')).toBeVisible({ timeout: 10_000 });
}

async function scanRoute(page: any, testId: string, label: string) {
  await page.waitForSelector(`[data-testid="${testId}"]`, { timeout: 15_000 });
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blockers = result.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );
  // eslint-disable-next-line no-console
  console.log(
    `[axe ${label}] ${result.violations.length} violations totales, ${blockers.length} critical/serious`,
  );
  return { total: result.violations.length, blockers };
}

test.describe('MGC-444 — simulador-carrera evidencia E2E', () => {
  test('1) identity (MGC-2254)', async ({ page }, testInfo) => {
    // MGC-2254: goto directo a identity (home ya no es dispatcher).
    await page.goto('/simulador-carrera/identity', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await expect(page.getByTestId('identity-screen')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('mgc444-01-identity.png'),
      fullPage: true,
    });
  });

  test('2) identity → dashboard con player card', async ({ page }, testInfo) => {
    await completeIdentity(page, 'Mateo Romero');
    await page.screenshot({
      path: testInfo.outputPath('mgc444-02-dashboard.png'),
      fullPage: true,
    });
  });

  test('3) dashboard → academy → clubStart → dashboard', async ({ page }, testInfo) => {
    await completeIdentity(page, 'Mateo Romero');
    await page.getByTestId('btn-dashboard-academy').click();
    await page.waitForURL(/\/simulador-carrera\/academy/, { timeout: 10_000 });
    await expect(page.getByTestId('academy-screen')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('mgc444-03-academy.png'),
      fullPage: true,
    });
    const firstClub = page.locator('[data-testid^="club-"]').first();
    // MGC-620: handler único (sin race con beforeEach). page.once() se registra
    // antes del click; click espera al listener registrado vía Playwright.
    page.once('dialog', async (dialog) => {
      // eslint-disable-next-line no-console
      console.log(`[dialog clubStart] ${dialog.type()}: ${dialog.message().slice(0, 60)}`);
      await dialog.accept();
    });
    await firstClub.click();
    // router.replace('/simulador-carrera/dashboard') triggereado tras aceptar Alert
    await page.waitForURL(/\/simulador-carrera\/dashboard/, { timeout: 15_000 });
    // MGC-405: durante la animación academy → dashboard quedan 2 elementos
    // con testid `dashboard-screen` en DOM (el viejo academy-screen fade
    // out y el nuevo dashboard fade in coexisten). `.first()` picks DOM-order
    // que suele ser el hidden. Usamos `.last()` para tomar el nuevo
    // dashboard (renderizado después en el Stack). Adicionalmente esperamos
    // a que academy-screen quede hidden para que no haya ambigüedad.
    await expect(page.getByTestId('academy-screen')).toBeHidden({ timeout: 10_000 });
    await expect(page.getByTestId('dashboard-screen').last()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({
      path: testInfo.outputPath('mgc444-04-dashboard-after-club.png'),
      fullPage: true,
    });
  });

  test('4) axe-core: 0 critical/serious en 2 pantallas (dark mode)', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    // MGC-1188: el home es un dispatcher invisible, así que ya no hay una
    // pantalla `home` propia para escanear. El landing del dispatcher es
    // el identity screen, que ya cubrimos como segundo axe scan.

    // identity (estado limpio) — MGC-2254: goto directo (serve-spa.py hace fallback)
    await page.goto('/simulador-carrera/identity', { waitUntil: 'domcontentloaded' });
    const axeIdentity = await scanRoute(page, 'identity-screen', 'identity');
    await page.screenshot({
      path: testInfo.outputPath('mgc444-06-axe-identity.png'),
      fullPage: true,
    });

    // dashboard (con perfil completo)
    await completeIdentity(page, 'Mateo Romero QA');
    const axeDashboard = await scanRoute(page, 'dashboard-screen', 'dashboard');
    await page.screenshot({
      path: testInfo.outputPath('mgc444-07-axe-dashboard.png'),
      fullPage: true,
    });

    expect(axeIdentity.blockers.length, 'identity critical/serious').toBe(0);
    expect(axeDashboard.blockers.length, 'dashboard critical/serious').toBe(0);
  });

  test('5) persistencia: reload conserva profile (zustand persist)', async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await completeIdentity(page, 'Mateo Romero Persistente');
    // MGC-532: el nombre aparece en 4 lugares (home-jersey kept-alive + jersey
    // preview dashboard + h1 player card + aria-label dorsal). Usar el heading
    // del player card como anchor estable para evitar strict-mode violation.
    await expect(page.getByRole('heading', { name: 'Mateo Romero Persistente' })).toBeVisible();
    // Validar que zustand persist guardó el storage antes de recargar
    // MGC-385 / PR #162 (cddc2b3): saveCareerSave escribe a
    // `copero:career:save:v1` (key versionada). El spec original leía la key
    // legacy `copero-career` (zustand persist middleware), que queda vacía en
    // un browser context fresco porque save nunca la toca. Ver
    // src/features/career/persistence.ts:15 STORAGE_KEY.
    const lsState = await page.evaluate(() =>
      localStorage.getItem('copero:career:save:v1'),
    );
    // eslint-disable-next-line no-console
    console.log(`[persist] localStorage copero:career:save:v1 length=${lsState?.length ?? 0}`);
    expect(lsState, 'zustand persist key debe existir').toBeTruthy();
    // Reload full — dashboard debe sobrevivir porque el store está persistido
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
    await expect(page.getByTestId('dashboard-screen')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Mateo Romero Persistente' })).toBeVisible({ timeout: 10_000 });
    await page.screenshot({
      path: testInfo.outputPath('mgc444-08-persistence-after-reload.png'),
      fullPage: true,
    });
  });
});
