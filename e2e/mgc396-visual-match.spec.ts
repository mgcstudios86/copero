import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/**
 * MGC-396 — capturas visuales post-fix `palette.copero.primary` → verde.
 *
 * Recorre home → identity → draft (ronda 1) → tu-jugador → club con el
 * flow real (form + 8 picks + club pick). Deja cada PNG en `/tmp/mgc396/`
 * para comparar contra las 7 fotos de referencia de MGC-11.
 */

const OUT = '/tmp/mgc396';

test.describe('MGC-396 — capturas post-fix verde primario', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('home + identity (post-fix verde)', async ({ page }) => {
    test.setTimeout(90_000);
    mkdirSync(OUT, { recursive: true });

    await page.goto('/', { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="home-screen"]', { timeout: 15_000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/01-home.png`, fullPage: true });

    await page.locator('[data-testid="btn-career"]').click();
    await page.waitForURL('**/simulador-carrera/identity', { timeout: 10_000 });
    await page.waitForSelector('[data-testid="identity-screen"]', { timeout: 10_000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/02-identity.png`, fullPage: true });
  });

  test('flow completo: identity → 8 picks → tu-jugador → club', async ({ page }) => {
    test.setTimeout(180_000);
    mkdirSync(OUT, { recursive: true });

    // 1) Entrar por home → identity
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="home-screen"]', { timeout: 15_000 });
    await page.locator('[data-testid="btn-career"]').click();
    await page.waitForURL('**/simulador-carrera/identity', { timeout: 10_000 });
    await page.waitForSelector('[data-testid="identity-screen"]', { timeout: 10_000 });

    // 2) Llenar el form mínimo (testIDs canónicos de e2e/simulador-carrera.spec.ts)
    await page.locator('[data-testid="input-name"]').fill('Calvo');
    await page.locator('[data-testid="pos-ST"]').click();
    await page.locator('[data-testid="input-nationality-search"]').fill('arg');
    await page.waitForTimeout(400);
    await page.locator('[data-testid="btn-identity-continue"]').click();

    // 3) Draft ronda 1
    await page.waitForURL('**/simulador-carrera/draft', { timeout: 15_000 });
    await page.waitForSelector('[data-testid="draft-screen"]', { timeout: 10_000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/03-draft-ronda1.png`, fullPage: true });

    // 4) Confirmar 8 picks (loop)
    for (let i = 0; i < 8; i++) {
      const confirm = page.locator('[data-testid="btn-draft-confirm"]');
      try {
        if (await confirm.isDisabled({ timeout: 1000 })) break;
      } catch {
        break;
      }
      await confirm.click();
      await page.waitForTimeout(400);
    }

    // 5) Tu jugador (post draft)
    await page.waitForURL('**/simulador-carrera/tu-jugador', { timeout: 15_000 });
    await page.waitForSelector('[data-testid="tu-jugador-screen"]', { timeout: 10_000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/04-tu-jugador.png`, fullPage: true });

    // 6) Selección de club
    await page.locator('[data-testid="btn-tu-jugador-club"]').click();
    await page.waitForURL('**/simulador-carrera/club', { timeout: 15_000 });
    await page.waitForSelector('[data-testid="club-screen"]', { timeout: 10_000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/05-club.png`, fullPage: true });
  });
});