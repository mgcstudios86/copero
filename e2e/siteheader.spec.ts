import { test, expect } from '@playwright/test';

/**
 * MGC-676 — QA validation post-merge del SiteHeader global + LanguageSwitcher
 * (PR #92 mergeado en d9486f9).
 *
 * Acceptance a validar (MGC-676):
 *  - 7 nav links renderizan en desktop (>= 720 px).
 *  - LanguageSwitcher toggle ES/EN/zh-CN funciona y refleja locale activo.
 *  - CTA Jugar verde visible en header (testID `copero-site-header-play`).
 *  - Mobile breakpoint < 720 px: hamburger toggle abre/cierra menu, a11y
 *    state `expanded` se anuncia.
 *
 * Selectores canónicos (testIDs del SiteHeader.tsx):
 *   - copero-site-header, copero-site-header-nav, copero-site-header-mobile-nav
 *   - copero-site-header-play, copero-site-header-toggle
 *   - copero-language-switcher, copero-language-switcher-{es,en,zh-CN}
 *
 * Nota sobre anclas `#how-to-play`, `#mechanics`, `#faq`: como la app
 * corre en SPA estática y los anchors cuelgan del home, el toggle de
 * locale + navegación al simulador son los asserts de humo. La nav links
 * solo se asegura visibles (no se valida que cada anchor scrollee, eso
 * es scope del review de MGC-653, no de QA post-merge).
 */

const ES_LINKS = [
  'Simulador de carrera',
  'Crea tu carrera',
  'Carrera completa',
  'Carrera rápida',
  'Cómo jugar',
  'Mecánicas',
  'FAQ',
] as const;

const EN_LINKS = [
  'Career Simulator',
  'Build your career',
  'Full career',
  'Quick career',
  'How to play',
  'Mechanics',
  'FAQ',
] as const;

const ZH_LINKS = [
  '足球生涯模拟器',
  '创建你的足球生涯',
  '完整生涯',
  '快速生涯',
  '玩法',
  '机制',
  '常见问题',
] as const;

// Bloquea requests a proveedores de ads externos (mismo patrón que home.spec.ts).
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

// MGC-684: el click del hamburger toggle NO debe disparar PAGEERROR ni dejar
// `document.body.innerText` vacío. Antes del fix, RN-web 0.21.x fallaba al
// reconciliar el array-style del Pressable dentro de <Link asChild> con
// "Failed to set an indexed property [0] on 'CSSStyleDeclaration'", lo que
// desmontaba el árbol React y dejaba la app en blanco.
async function attachMobileErrorSentinel(page: import('@playwright/test').Page) {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

// MGC-676: usa Chrome del sistema (Playwright download hosted en Playwright es lento en este runner).
// Override a nivel de spec (no dentro de describe) por restricción de Playwright.
test.use({ channel: 'chrome' });

test.describe('Copero — SiteHeader + LanguageSwitcher parity (MGC-676)', () => {
  test('desktop (1440x900): 7 nav links + LanguageSwitcher + CTA Jugar visible', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    // MGC-2254: goto directo a identity (home ya no es dispatcher
    // tras MGC-1397 / PR #340). El SiteHeader vive en el root layout,
    // así que persiste a través de la navegación.
    await page.goto('/simulador-carrera/identity', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByTestId('identity-screen')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('copero-site-header')).toBeVisible();
    await expect(page.getByTestId('copero-site-header-nav')).toBeVisible();
    // CTA Jugar con fondo primario (verde). El testID basta para asegurar
    // mount; el color se valida por el axe scan + visual parity spec.
    const playCta = page.getByTestId('copero-site-header-play');
    await expect(playCta).toBeVisible();
    // El contenedor de nav en desktop muestra 7 <a>/role="link".
    const navLinks = page.getByTestId('copero-site-header-nav').getByRole('link');
    await expect(navLinks).toHaveCount(ES_LINKS.length);
    for (const label of ES_LINKS) {
      await expect(
        page.getByTestId('copero-site-header-nav').getByRole('link', { name: label }),
      ).toBeVisible();
    }
    // LanguageSwitcher con sus 3 tabs ES/EN/中文.
    await expect(page.getByTestId('copero-language-switcher')).toBeVisible();
    await expect(page.getByTestId('copero-language-switcher-es')).toBeVisible();
    await expect(page.getByTestId('copero-language-switcher-en')).toBeVisible();
    await expect(page.getByTestId('copero-language-switcher-zh-CN')).toBeVisible();
    // Locale default es 'es': ES marcado como selected.
    await expect(page.getByTestId('copero-language-switcher-es')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.screenshot({
      path: testInfo.outputPath('siteheader-desktop-1440.png'),
      fullPage: false,
    });
  });

  test('LanguageSwitcher toggle ES → EN → zh-CN refleja locale activo', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByTestId('copero-site-header')).toBeVisible({ timeout: 15_000 });

    const switcher = page.getByTestId('copero-language-switcher');

    // ES (default).
    await expect(switcher.getByTestId('copero-language-switcher-es')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(
      page.getByTestId('copero-site-header-nav').getByRole('link', {
        name: ES_LINKS[0],
      }),
    ).toBeVisible();

    // → EN.
    await switcher.getByTestId('copero-language-switcher-en').click();
    await expect(switcher.getByTestId('copero-language-switcher-en')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(switcher.getByTestId('copero-language-switcher-es')).toHaveAttribute(
      'aria-selected',
      'false',
    );
    for (const label of EN_LINKS) {
      await expect(
        page.getByTestId('copero-site-header-nav').getByRole('link', { name: label }),
      ).toBeVisible();
    }

    // → zh-CN.
    await switcher.getByTestId('copero-language-switcher-zh-CN').click();
    await expect(switcher.getByTestId('copero-language-switcher-zh-CN')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    for (const label of ZH_LINKS) {
      await expect(
        page.getByTestId('copero-site-header-nav').getByRole('link', { name: label }),
      ).toBeVisible();
    }

    // Vuelve a ES para no contaminar el siguiente spec.
    await switcher.getByTestId('copero-language-switcher-es').click();
    await page.screenshot({
      path: testInfo.outputPath('siteheader-langswitcher-cycle.png'),
      fullPage: false,
    });
  });

  test('CTA Jugar navega a /simulador-carrera', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByTestId('copero-site-header')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('copero-site-header-play').click();
    await page.waitForURL(/\/simulador-carrera/, { timeout: 15_000 });
    // SiteHeader persiste al navegar.
    await expect(page.getByTestId('copero-site-header')).toBeVisible();
  });

  test('mobile (390x844 < 720): nav links colapsan, hamburger toggle abre/cierra + a11y expanded', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    // MGC-2254: goto directo a identity (home ya no es dispatcher).
    await page.goto('/simulador-carrera/identity', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByTestId('identity-screen')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('copero-site-header')).toBeVisible();

    // En compact (<720) la nav inline se oculta, sólo queda el toggle.
    await expect(page.getByTestId('copero-site-header-nav')).toHaveCount(0);
    const toggle = page.getByTestId('copero-site-header-toggle');
    await expect(toggle).toBeVisible();
    // Estado inicial: collapsed.
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    // MGC-684: el click no debe disparar PAGEERROR ni dejar body en blanco.
    const errors = await attachMobileErrorSentinel(page);

    // Abre el menu mobile.
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const mobileNav = page.getByTestId('copero-site-header-mobile-nav');
    await expect(mobileNav).toBeVisible();
    // El árbol React debe seguir montado: body NO debe quedar en blanco.
    const bodyText = await page.evaluate(() => document.body.innerText.trim());
    expect(bodyText.length).toBeGreaterThan(0);
    expect(errors, `PAGEERROR tras toggle: ${errors.join(' | ')}`).toEqual([]);
    // 7 links + CTA Jugar renderizados en el drawer mobile.
    const mobileLinks = mobileNav.getByRole('link');
    await expect(mobileLinks).toHaveCount(ES_LINKS.length + 1); // +1 = CTA Jugar
    for (const label of ES_LINKS) {
      await expect(mobileNav.getByRole('link', { name: label })).toBeVisible();
    }
    // MGC-701: exact:true evita que 'Jugar' matchee por substring a "Cómo jugar"
    // (mismo drawer mobile-nav) y dispare strict-mode violation en Playwright.
    await expect(mobileNav.getByRole('link', { name: 'Jugar', exact: true })).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('siteheader-mobile-open-390.png'),
      fullPage: false,
    });

    // Cierra el menu (segundo click togglea).
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(mobileNav).toHaveCount(0);
  });

  test('mobile: tap en link dentro del drawer cierra el menu (closeMenu onPress)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByTestId('copero-site-header')).toBeVisible({ timeout: 15_000 });
    const toggle = page.getByTestId('copero-site-header-toggle');
    await toggle.click();
    await expect(page.getByTestId('copero-site-header-mobile-nav')).toBeVisible();
    // Tap en "Cómo jugar" (#how-to-play) que queda dentro del home.
    await page
      .getByTestId('copero-site-header-mobile-nav')
      .getByRole('link', { name: 'Cómo jugar' })
      .click();
    // Tras click, el drawer mobile se desmonta (closeMenu).
    await expect(page.getByTestId('copero-site-header-mobile-nav')).toHaveCount(0);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('breakpoint boundary: viewport 720 revela nav inline, 719 la colapsa', async ({
    page,
  }) => {
    // >= 720: nav inline visible.
    await page.setViewportSize({ width: 720, height: 900 });
    // MGC-2254: goto directo a identity (home ya no es dispatcher).
    await page.goto('/simulador-carrera/identity', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByTestId('copero-site-header-nav')).toBeVisible();

    // < 720: nav colapsada, toggle visible.
    await page.setViewportSize({ width: 719, height: 900 });
    await expect(page.getByTestId('copero-site-header-nav')).toHaveCount(0);
    await expect(page.getByTestId('copero-site-header-toggle')).toBeVisible();
  });
});
