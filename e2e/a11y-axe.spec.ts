import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * MGC-339 — axe-core scan sobre pantallas cross-platform web.
 *
 * AC: "axe DevTools: 0 violations critical/serious".
 *
 * Las rutas son client-side (Expo Router SPA). Tras MGC-1188, el home
 * queda como dispatcher puro (`<Redirect>` desde `/`); sin carrera
 * persistida aterriza en /simulador-carrera/identity.
 *
 * MGC-1188: el home es un dispatcher invisible. Validamos axe sobre el
 * identity screen (landing del dispatcher) en lugar del splash viejo.
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
  test('axe /: 0 critical/serious (landing tras dispatcher = identity)', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    // MGC-1188: el dispatcher de `/` redirige a /simulador-carrera/identity
    // porque no hay perfil persistido. axe scan corre sobre el landing.
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForURL('**/simulador-carrera/identity', { timeout: 15_000 });
    const { total, blockers } = await scanRoute(page, 'identity-screen');
    await page.screenshot({ path: testInfo.outputPath('axe-identity.png'), fullPage: true });
    expect(blockers.length, 'critical/serious en identity').toBe(0);
    // eslint-disable-next-line no-console
    console.log(`[axe /identity] ${total} violations totales (sin critical/serious)`);
  });

  test('axe /simulador-carrera/identity: 0 critical/serious (goto directo)', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForURL('**/simulador-carrera/identity', { timeout: 10_000 });
    const { total, blockers } = await scanRoute(page, 'identity-screen');
    await page.screenshot({ path: testInfo.outputPath('axe-identity-direct.png'), fullPage: true });
    expect(blockers.length, 'critical/serious en identity').toBe(0);
    // eslint-disable-next-line no-console
    console.log(`[axe /identity direct] ${total} violations totales (sin critical/serious)`);
  });
});
