import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * MGC-339 — axe-core scan sobre pantallas cross-platform web.
 *
 * AC: "axe DevTools: 0 violations critical/serious".
 *
 * Las rutas son client-side (Expo Router SPA). Por eso esperamos
 * a `home-screen` y luego navegamos con clicks en vez de `goto`
 * directo a /categoria (404 en static export).
 *
 * Visita cada ruta principal y corre WCAG 2.1 AA + best-practices.
 * Falla si encuentra critical o serious.
 */

async function scanRoute(page: any, label: string) {
  // Espera específica al testID de la pantalla destino
  await page.waitForSelector(`[data-testid="${label}"]`, { timeout: 15_000 });
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blockers = result.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );
  if (blockers.length > 0) {
    const summary = blockers
      .map(
        (v) =>
          `  - [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodes)\n    ${v.nodes
            .slice(0, 2)
            .map((n) => n.target.join(' '))
            .join('\n    ')}`,
      )
      .join('\n');
    throw new Error(
      `axe encontró ${blockers.length} violation(s) critical/serious en ${label}:\n${summary}\n\nViolations totales: ${result.violations.length} (${result.violations
        .map((v) => `${v.id}:${v.impact ?? 'minor'}`)
        .join(', ')})`,
    );
  }
  return { total: result.violations.length, blockers };
}

test.describe('Copero — axe-core scan (web)', () => {
  test('axe /: 0 critical/serious', async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.goto('/', { waitUntil: 'load' });
    const { total, blockers } = await scanRoute(page, 'home-screen');
    await page.screenshot({ path: testInfo.outputPath('axe-home.png'), fullPage: true });
    expect(blockers.length, 'critical/serious en home').toBe(0);
    // eslint-disable-next-line no-console
    console.log(`[axe /] ${total} violations totales (sin critical/serious)`);
  });

  test('axe /categoria: 0 critical/serious', async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="home-screen"]', { timeout: 10_000 });
    await page.locator('[data-testid="btn-play"]').click();
    await page.waitForURL('**/categoria', { timeout: 10_000 });
    const { total, blockers } = await scanRoute(page, 'categoria-screen');
    await page.screenshot({ path: testInfo.outputPath('axe-categoria.png'), fullPage: true });
    expect(blockers.length, 'critical/serious en categoria').toBe(0);
    // eslint-disable-next-line no-console
    console.log(`[axe /categoria] ${total} violations totales (sin critical/serious)`);
  });
});
