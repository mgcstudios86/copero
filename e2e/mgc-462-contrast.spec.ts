import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * MGC-462 — axe contrast scan sobre /simulador-carrera/identity.
 *
 * AC del bug ticket MGC-437:
 *   - Texto sobre GROUP_COLOR cumple WCAG AA (>= 4.5:1) para los 4 grupos
 *   - axe 0 critical/serious en /simulador-carrera/identity
 *
 * Cubre los 4 grupos del jersey preview (attack/midfield/defense/goalkeeper).
 * Usa los testIDs pos-<id> que ya emite el field map (ver
 * app/simulador-carrera/identity.tsx) para conmutar de grupo sin
 * depender del aspecto visual.
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

type Group = {
  label: string;
  posId: 'ST' | 'CAM' | 'CB' | 'GK';
};

const GROUPS: Group[] = [
  { label: 'attack', posId: 'ST' },
  { label: 'midfield', posId: 'CAM' },
  { label: 'defense', posId: 'CB' },
  { label: 'goalkeeper', posId: 'GK' },
];

test.describe('MGC-462 — axe contrast /simulador-carrera/identity', () => {
  test('axe 0 critical/serious sobre jersey preview en los 4 grupos', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);

    // MGC-522: usar baseURL del config (EXPO_WEB_PORT default 8081 en CI)
    // en lugar de hardcodear :8082. Otros specs navegan con '/' relativo.
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForSelector('[data-testid="home-screen"]', { timeout: 10_000 });
    await page.getByTestId('btn-home-play').click();
    await page.waitForURL('**/simulador-carrera/identity', { timeout: 10_000 });
    await page.waitForSelector('[data-testid="identity-screen"]', { timeout: 10_000 });
    await page.waitForSelector('[data-testid="jersey-preview"]', { timeout: 10_000 });

    const totalByGroup: Record<string, number> = {};
    const blockersByGroup: Record<string, number> = {};

    for (const group of GROUPS) {
      // Conmuta al grupo vía field map.
      await page.getByTestId(`pos-${group.posId}`).click();
      // Espera a que el jersey renderice con el color nuevo (el View re-renderiza
      // en el siguiente tick al cambiar el color de fondo).
      await page.waitForTimeout(150);

      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        // Limita el scan al subtree del jersey preview para aislar el hallazgo.
        .include('[data-testid="jersey-preview"]')
        .analyze();

      const blockers = result.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );
      totalByGroup[group.label] = result.violations.length;
      blockersByGroup[group.label] = blockers.length;

      await page.screenshot({
        path: testInfo.outputPath(`jersey-${group.label}.png`),
        clip: { x: 0, y: 0, width: 400, height: 600 },
      });

      expect(
        blockers.length,
        `axe encontro ${blockers.length} violation(s) critical/serious sobre jersey ${group.label}:\n` +
          blockers
            .map(
              (v) =>
                `  - [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodes)\n` +
                v.nodes
                  .slice(0, 3)
                  .map((n) => `    ${n.target.join(' ')}`)
                  .join('\n'),
            )
            .join('\n'),
      ).toBe(0);
    }

    // eslint-disable-next-line no-console
    console.log(
      `[MGC-462] axe jersey preview — violations totales por grupo: ${JSON.stringify(totalByGroup)}`,
    );
    // Garantiza que seguimos en /identity y que el preview nunca desapareció.
    await expect(page.getByTestId('jersey-preview')).toBeVisible();
  });
});
