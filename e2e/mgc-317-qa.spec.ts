import { test, expect } from '@playwright/test';
import path from 'node:path';

/**
 * MGC-505 — QA visual del home rediseñado + smoke del simulador de carrera.
 *
 * Reemplaza el spec MGC-317 original (validaba emoji 🍕 en /categoria,
 * timer de ronda, persistencia de highScore). Ese flujo fue removido del
 * home en MGC-505.
 *
 * MGC-1188: el home deja de ser visible y queda como dispatcher puro
 * (`<Redirect>` desde `/`). Sin carrera persistida aterriza directo en
 * `/simulador-carrera/identity` con su JerseyPreview y los 4 grupos
 * pos-{id} del field map. Este spec ahora arranca ahí directamente,
 * sin pasar por el splash del home.
 *
 * AC MGC-505 (actualizados):
 *  - El cold-start de `/` aterriza en /simulador-carrera/identity
 *    (sin carrera persistida).
 *  - El identity screen renderiza el JerseyPreview con los 4 grupos pos-{id}.
 */

const OUT_DIR = path.join(__dirname, '.results', 'mgc-505');

test.describe('MGC-505 — QA visual home + simulador-carrera', () => {
  test.beforeAll(() => {
    require('node:fs').mkdirSync(OUT_DIR, { recursive: true });
  });

  test('dispatcher `/` → /simulador-carrera/identity + JerseyPreview pos-{id}', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);

    // Estado limpio: cookies + storage.
    await page.context().clearCookies();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      try {
        window.localStorage.clear();
        window.sessionStorage.clear();
      } catch {
        /* noop */
      }
    });
    await page.reload({ waitUntil: 'domcontentloaded' });

    // 1) MGC-1188: el dispatcher de `/` redirige a /simulador-carrera/identity
    // porque no hay perfil persistido. Capturamos el landing para mantener
    // el artefacto histórico del spec.
    await page.waitForURL('**/simulador-carrera/identity', { timeout: 15_000 });
    await page.waitForSelector('[data-testid="identity-screen"]', { timeout: 15_000 });
    await page.screenshot({ path: path.join(OUT_DIR, '01-identity-mgc505.png'), fullPage: true });

    // Garantizar que NO están los botones del viejo flujo.
    const btnPlayCount = await page.locator('[data-testid="btn-play"]').count();
    const btnCompassCount = await page.locator('[data-testid="btn-compass"]').count();
    expect(btnPlayCount, 'home no debe exponer btn-play (MGC-505)').toBe(0);
    expect(btnCompassCount, 'home no debe exponer btn-compass (MGC-505)').toBe(0);

    // 2) JerseyPreview del identity screen con los 4 grupos pos-{id}.
    await page.waitForSelector('[data-testid="identity-jersey-preview"]', { timeout: 10_000 });
    await page.screenshot({ path: path.join(OUT_DIR, '02-identity-mgc505.png'), fullPage: true });

    // 3) Validar los 4 grupos pos-{id} (ataque / mediocampo / defensa / arquero).
    const groupIds = ['ST', 'CAM', 'CB', 'GK'];
    for (const id of groupIds) {
      const pos = page.locator(`[data-testid="pos-${id}"]`);
      await expect(pos, `pos-${id} debe existir en el field map`).toBeVisible();
      await pos.click();
      await page.waitForTimeout(120);
    }
    await page.screenshot({
      path: path.join(OUT_DIR, '03-identity-all-groups.png'),
      fullPage: true,
    });

    // Adjuntar el screenshot principal al report de Playwright.
    testInfo.attachments.push({
      name: 'mgc-505-identity',
      path: path.join(OUT_DIR, '01-identity-mgc505.png'),
      contentType: 'image/png',
    });
  });
});