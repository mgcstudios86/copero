import { test, expect } from '@playwright/test';
import path from 'node:path';

/**
 * MGC-505 — QA visual del home rediseñado + smoke del simulador de carrera.
 *
 * Reemplaza el spec MGC-317 original (validaba emoji 🍕 en /categoria,
 * timer de ronda, persistencia de highScore). Ese flujo fue removido del
 * home en MGC-505: el único camino accesible desde el landing es
 * `btn-career` → /simulador-carrera/identity.
 *
 * AC MGC-505:
 *  - Home muestra el H1 multi-línea del simulador + CTA carrera.
 *  - Home NO expone botones viejos (btn-play / btn-compass) — esos
 *    routes persisten como deep-links pero el landing no los linkea.
 *  - Tap en btn-career navega al simulador de carrera y el identity
 *    screen renderiza el JerseyPreview con los 4 grupos pos-{id}.
 */

const OUT_DIR = path.join(__dirname, '.results', 'mgc-505');

test.describe('MGC-505 — QA visual home + simulador-carrera', () => {
  test.beforeAll(() => {
    require('node:fs').mkdirSync(OUT_DIR, { recursive: true });
  });

  test('home rediseñado + navegación a simulador-carrera/identity', async ({ page }, testInfo) => {
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

    // 1) HOME rediseñado
    await page.waitForSelector('[data-testid="home-screen"]', { timeout: 15_000 });
    await page.screenshot({ path: path.join(OUT_DIR, '01-home-mgc505.png'), fullPage: true });

    const homeText = await page.locator('[data-testid="home-screen"]').innerText();
    // MGC-394 (#174) reemplazó el home por splash + botón Jugar con copy
    // "copero · simulador de carrera / convertite en leyenda / jugar".
    // home.spec.ts:41 ya asserta el copy actual; este spec alinea con la
    // nueva presentación visual.
    expect(homeText.toLowerCase()).toContain('simulador de carrera');
    expect(homeText.toLowerCase()).toContain('convertite en leyenda');

    // Garantizar que NO están los botones del viejo flujo.
    const btnPlayCount = await page.locator('[data-testid="btn-play"]').count();
    const btnCompassCount = await page.locator('[data-testid="btn-compass"]').count();
    expect(btnPlayCount, 'home no debe exponer btn-play (MGC-505)').toBe(0);
    expect(btnCompassCount, 'home no debe exponer btn-compass (MGC-505)').toBe(0);

    // CTA único al simulador de carrera.
    await expect(page.locator('[data-testid="btn-career"]')).toBeVisible();

    // 2) Navegación al simulador-carrera/identity.
    await page.locator('[data-testid="btn-career"]').click();
    await page.waitForURL('**/simulador-carrera/identity', { timeout: 10_000 });
    await page.waitForSelector('[data-testid="identity-screen"]', { timeout: 10_000 });
    await page.waitForSelector('[data-testid="jersey-preview"]', { timeout: 10_000 });
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
      name: 'mgc-505-home',
      path: path.join(OUT_DIR, '01-home-mgc505.png'),
      contentType: 'image/png',
    });
  });
});