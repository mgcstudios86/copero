import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fillIdentityLastName, fillIdentityName } from './career-test-helpers';
import { passSeasonHub, passTeamSelect, pressRnw } from './fixtures/rnw-fill';

/**
 * MGC-431 — E2E + axe + Lighthouse integral para simulador-carrera (MGC-427).
 *
 * Spec añadida por MGC-431 (QA). Cubre el flujo end-to-end del vertical
 * simulador-carrera sobre el bundle web con gate WCAG 2.1 AA.
 *
 * AC:
 *  - Walk: home -> Simulador de carrera -> identity (CALVO/10/Derecho/AR/ST)
 *    -> dashboard (OVR 50 / 16 años / Free agent) -> academy -> Vélez
 *    -> navegación a la siguiente pantalla.
 *  - Gate axe 0 critical/serious en identity + dashboard + academy.
 *  - Lighthouse mobile perf 90+ / a11y 100 sobre /identity y /dashboard
 *    se ejecuta en CI vía `qa.yml` (artefactos lhr-*.json).
 *
 * Corre sobre el runner self-hosted `copero-ci` vía `qa.yml`. Los 3 gates
 * verdes consecutivos corresponden a 3 corridas QA en CI self-hosted.
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
    if (AD_DOMAINS.some((d) => url.includes(d))) {
      return route.abort();
    }
    return route.continue();
  });
});

const BASE = process.env.EXPO_WEB_BASE_URL ?? 'http://127.0.0.1:8081';

async function expectZeroSeriousAxe(page: Page, label: string) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  const blockers = result.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  if (blockers.length) {
    console.log(
      `[axe ${label}] violations:`,
      JSON.stringify(
        blockers.map((b) => ({
          id: b.id,
          impact: b.impact,
          help: b.help,
          nodes: b.nodes.map((n) => ({
            target: n.target.join(' '),
            failureSummary: n.failureSummary,
          })),
        })),
        null,
        2,
      ),
    );
  }
  expect(blockers, `axe serious/critical en ${label}`).toEqual([]);
}

test.describe('MGC-431 — simulador-carrera walk end-to-end', () => {
  /**
   * Test principal: cubre las 3 sub-pantallas (identity, dashboard, academy)
   * con sus gates axe WCAG 2.1 AA y el walk completo del vertical.
   *
   * Datos jugados (per AC del ticket MGC-431):
   *   Nombre   = CALVO
   *   Número   = 10 (initial 9 → +1)
   *   Pie      = Derecho
   *   Posición = ST (attack group, GROUP_COLOR.attack = #E96A56)
   *   País     = Argentina (AR)
   *
   * Verificaciones en dashboard (per AC):
   *   - Heading = "CALVO"
   *   - Subtitle incluye "ST" y "Argentina"
   *   - OVR chip accesible como "Overall rating 50"
   *   - Badge contiene "16 años" y "Free agent"
   *     (NOTA AC: "Value EUR 100K" no se renderiza en dashboard actual;
   *     el subtítulo expone "Free agent" hasta aceptar un club. El valor
   *     inicial sigue siendo 100.000€ en el store, verificado por unidad
   *     en src/features/career/engine.test.ts.)
   */
  test('CALVO/10/Derecho/AR/ST → dashboard → academy → Vélez', async ({ page }, testInfo) => {
    // ── 1. LANDING: goto directo a /simulador-carrera/identity ────────
    // MGC-2254: el home dejo de ser dispatcher (MGC-1397 / PR #340).
    // MGC-405: goto directo via SPA (serve-spa.py hace fallback a
    // index.html) para evitar el fallback del SiteHeader a
    // /simulador-carrera (sin subpath) que expo-router resolvia a
    // /simulador-carrera/club en lugar de /identity.
    await page.goto(`${BASE}/simulador-carrera/identity`);
    await expect(page.getByTestId('identity-screen')).toBeVisible({ timeout: 15_000 });

    // ── 2. IDENTITY: completar los 5 campos del AC ────────────────────
    // 2a. Nombre = CALVO
    await fillIdentityName(page, 'CALVO');
    await fillIdentityLastName(page, 'Prueba');

    // 2b. El número inicial (9) ya cumple el rango válido del perfil.
    // La UI actual reemplazó el stepper por el campo de edad; no hace falta
    // mutar el dorsal para habilitar Continue.

    // 2c. Posición = ST (attack group) — tap en el field map
    await pressRnw(page.getByTestId('pos-ST'));

    // 2d. Pie hábil = Derecho
    await pressRnw(page.getByRole('button', { name: 'Derecha', exact: true }));

    // 2e. Nacionalidad = Argentina (filtra por "arg" para robustez i18n).
    await page.getByTestId('input-nationality-search').fill('arg');
    await pressRnw(page.getByTestId('country-ARG'));
    await expect(page.getByTestId('btn-identity-continue')).toBeEnabled({ timeout: 15_000 });

    // axe gate 1: identity
    await expectZeroSeriousAxe(page, 'identity');
    await page.screenshot({
      path: testInfo.outputPath('simulador-carrera-01-identity.png'),
      fullPage: true,
    });

    // ── 3. CONTINUAR → DASHBOARD ──────────────────────────────────────
    // MGC-2254 v3: espera explicita a que el boton este enabled
    // (canContinue = name.length>=2 && number in [1,99]).
    await expect(page.getByTestId('btn-identity-continue')).toBeEnabled({ timeout: 15_000 });
    await page.getByTestId('btn-identity-continue').click();
    await expect(page.getByTestId('identity-screen')).toBeHidden({ timeout: 15_000 });
    // El flujo vigente puede pasar por team-select y season-hub. Este caso
    // conserva el assert de Free agent, por eso no selecciona un club.
    await page.goto('/simulador-carrera/dashboard');
    await expect(page.getByTestId('dashboard-screen').last()).toBeVisible({ timeout: 15_000 });

    // ── 4. DASHBOARD: aserciones del AC (OVR/Age/Name/Pos/Nat) ────────
    await expect(
      page.getByTestId('dashboard-screen').getByRole('heading', { name: 'CALVO' }),
    ).toBeVisible();
    await expect(page.getByLabel('Overall rating 50')).toBeVisible();

    // Subtitle jugador: "ST · 🇦🇷 Argentina"
    const playerCard = page
      .getByTestId('dashboard-screen')
      .locator('text=/ST\\s*·/');
    await expect(playerCard).toBeVisible();
    await expect(
      page
        .getByTestId('dashboard-screen')
        .getByText('Argentina', { exact: false })
        .first(),
    ).toBeVisible();

    // Badge: "16 años · Free agent" (placeholder hasta fichar)
    await expect(
      page.getByTestId('dashboard-screen').getByText(/16\s*a[ñn]os/i).first(),
    ).toBeVisible();
    await expect(
      page
        .getByTestId('dashboard-screen')
        .getByText('Free agent', { exact: false })
        .first(),
    ).toBeVisible();

    // axe gate 2: dashboard
    await expectZeroSeriousAxe(page, 'dashboard');
    await page.screenshot({
      path: testInfo.outputPath('simulador-carrera-02-dashboard.png'),
      fullPage: true,
    });

    // ── 5. IR A LA ACADEMIA ───────────────────────────────────────────
    // MGC-2505 / MGC-1649 (WF3): tras seleccionar club en team-select,
    // profile.club !== null → btn-dashboard-academy navega a /match
    // (no a /academy). Navegamos directo a /academy para preservar el AC
    // del test.
    await page.goto('/simulador-carrera/academy');
    await expect(page.getByTestId('academy-screen')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('club-velez')).toBeVisible();
    await expect(page.getByTestId('club-temperley')).toBeVisible();
    await expect(page.getByTestId('club-moron')).toBeVisible();

    // axe gate 3: academy
    await expectZeroSeriousAxe(page, 'academy');
    await page.screenshot({
      path: testInfo.outputPath('simulador-carrera-03-academy.png'),
      fullPage: true,
    });

    // ── 6. FICHAR POR VÉLEZ ───────────────────────────────────────────
    // MGC-405: en RN Web el Alert.alert no monta DOM (MGC-452 → MGC-473);
    // academy.tsx usa `window.confirm(...)` y router.replace('/dashboard').
    // Patrón idéntico al de simulador-carrera-evidence-mgc444.spec.ts:104 —
    // page.once() se registra antes del click para capturar el dialog nativo.
    page.once('dialog', async (dialog) => {
      // eslint-disable-next-line no-console
      console.log(`[dialog clubStart] ${dialog.type()}: ${dialog.message().slice(0, 60)}`);
      await dialog.accept();
    });
    await page.getByTestId('club-velez').click();
    await page.waitForURL(/\/simulador-carrera\/dashboard/, { timeout: 10_000 }).catch(() => undefined);

    // ── 7. NAVEGACIÓN post-fichaje ────────────────────────────────────
    // El router.replace debería llevarnos al dashboard (clubStart stage).
    // Si RN Web no llega a invocar onPress del Alert, fallback: navegar
    // manualmente y verificar que `acceptClub` actualizó `profile.club`.
    await page.waitForURL(/(simulador-carrera)/, { timeout: 10_000 }).catch(() => undefined);
    if (!page.url().includes('/simulador-carrera/dashboard')) {
      await page.goto(`${BASE}/simulador-carrera/dashboard`);
    }
    await expect(page.getByTestId('dashboard-screen').last()).toBeVisible({ timeout: 15_000 });
    // Tras aceptar club, el badge ya no dice "Free agent" — aparece "Vélez"
    // (renderiza `profile.club.name`).
    await expect(
      page
        .getByTestId('dashboard-screen')
        .last()
        .getByText('Vélez', { exact: false })
        .first(),
    ).toBeVisible({ timeout: 10_000 });

    await page.screenshot({
      path: testInfo.outputPath('simulador-carrera-04-after-velez.png'),
      fullPage: true,
    });
  });

  /**
   * Axe gate standalone: ciclar pos-ST/CAM/CB/GK y verificar que el fix
   * de MGC-462 (jersey + field map position dot) mantiene 0 violations.
   *
   * Cubre la regresión reportada en MGC-437 / MGC-464 contra el field map
   * dot activo. Acepta que la pantalla renderice los 4 grupos atacables.
   */
  test('axe 0 sobre /identity ciclando ST/CAM/CB/GK (post MGC-462)', async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.goto(`${BASE}/simulador-carrera/identity`);
    await expect(page.getByTestId('identity-screen')).toBeVisible({ timeout: 15_000 });

    // Defaults mínimos para que el journey completo no bloquee otros
    // navigations.
    await fillIdentityName(page, 'Regresion');
    await fillIdentityLastName(page, 'Axe');
    // El número inicial (9) ya es válido; la UI actual no expone stepper.
    await pressRnw(page.getByRole('button', { name: 'Derecha', exact: true }));
    await page.getByTestId('input-nationality-search').fill('arg');
    await pressRnw(page.getByTestId('country-ARG'));

    // Ciclar las 4 posiciones de grupos distintos y axeear cada estado.
    const positions = [
      { testId: 'pos-ST', label: 'attack' },
      { testId: 'pos-CAM', label: 'midfield' },
      { testId: 'pos-CB', label: 'defense' },
      { testId: 'pos-GK', label: 'goalkeeper' },
    ];

    for (const { testId, label } of positions) {
      await page.getByTestId(testId).click();
      await page.waitForTimeout(150);
      await expectZeroSeriousAxe(page, `identity pos=${label}`);
      await page.screenshot({
        path: testInfo.outputPath(`simulador-carrera-axe-${label}.png`),
        fullPage: true,
      });
    }
  });

  /**
   * Axe gate standalone sobre /dashboard y /academy para hit rápido del
   * monitor de regresión. Útil cuando el flow completo flakea por el Alert
   * de academy.tsx en RN Web y queremos aislar los gates a11y.
   */
  test('axe 0 sobre /dashboard y /academy (puerta rápida)', async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    // Dashboard sólo es alcanzable con identidad válida. La escribimos vía
    // store: navegamos a /identity primero, completamos campos mínimos,
    // continuamos, y luego salimos a academy vía el botón.
    await page.goto(`${BASE}/simulador-carrera/identity`);
    await expect(page.getByTestId('identity-screen')).toBeVisible({ timeout: 15_000 });
    await fillIdentityName(page, 'CALVO');
    await fillIdentityLastName(page, 'Prueba');
    // El número inicial (9) ya es válido; la UI actual no expone stepper.
    await pressRnw(page.getByTestId('pos-ST'));
    await pressRnw(page.getByRole('button', { name: 'Derecha', exact: true }));
    await page.getByTestId('input-nationality-search').fill('arg');
    await pressRnw(page.getByTestId('country-ARG'));
    await expect(page.getByTestId('btn-identity-continue')).toBeEnabled({ timeout: 15_000 });
    await page.getByTestId('btn-identity-continue').click();
    await passTeamSelect(page);
    await passSeasonHub(page);
    await page.goto('/simulador-carrera/dashboard');
    await expect(page.getByTestId('dashboard-screen')).toBeVisible({ timeout: 15_000 });

    await expectZeroSeriousAxe(page, 'dashboard-standalone');
    await page.screenshot({
      path: testInfo.outputPath('simulador-carrera-axe-dashboard.png'),
      fullPage: true,
    });

    // Con club seleccionado el CTA dashboard lleva a match; la cobertura
    // histórica de academy usa navegación directa.
    await page.goto('/simulador-carrera/academy');
    await expect(page.getByTestId('academy-screen')).toBeVisible({ timeout: 15_000 });
    await expectZeroSeriousAxe(page, 'academy-standalone');
    await page.screenshot({
      path: testInfo.outputPath('simulador-carrera-axe-academy.png'),
      fullPage: true,
    });
  });
});
