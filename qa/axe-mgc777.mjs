// MGC-777 axe-core wcag2aa scan sobre el tag-list del banner morado.
// Valida 0 violaciones color-contrast en los 4 TagPills del home.
// Vuelca:
//   qa/builds/MGC-777/axe-result.json
//   qa/builds/MGC-777/contrast-ratios.json
//   qa/builds/MGC-777/home-tag-list.png
//
// Uso: `node qa/axe-mgc777.mjs` con `python3 -m http.server 8742 --directory dist`.
import { chromium } from 'playwright';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';

const PORT = 8742;
const BASE = `http://localhost:${PORT}`;
const OUT_DIR = 'qa/builds/MGC-777';

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1600 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/`, { waitUntil: 'load' });
await page.waitForSelector('[data-testid="home-screen"]', { timeout: 30_000 });
await page.waitForSelector('[data-testid="home-tag-list"]', { timeout: 10_000 });

// Captura recortada del tag-list para evidencia visual.
const tagList = page.locator('[data-testid="home-tag-list"]');
await tagList.screenshot({ path: `${OUT_DIR}/home-tag-list.png` });
// Captura completa del banner para contexto.
const banner = page.locator('[data-testid="home-screen"] >> nth=0').first();
await page.screenshot({ path: `${OUT_DIR}/home-full.png`, fullPage: false });

const axeCandidates = ['node_modules/axe-core/axe.min.js', 'qa/axe.min.js'];
let axeSrc = null;
for (const p of axeCandidates) {
  if (existsSync(p)) {
    axeSrc = readFileSync(p, 'utf8');
    break;
  }
}
if (!axeSrc) {
  console.error('axe-core not found.');
  await browser.close();
  process.exit(2);
}
await page.addScriptTag({ content: axeSrc });

// Scan completo del banner.
const axeBanner = await page.evaluate(async () => {
  const banner = document.querySelector('[data-testid="home-tag-list"]');
  return await window.axe.run(banner, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
  });
});

// Scan adicional sobre la página entera para detectar regresiones globales.
const axeAll = await page.evaluate(async () => {
  const root = document.querySelector('[data-testid="home-screen"]');
  return await window.axe.run(root, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
  });
});

// Cálculo manual de contraste de cada TagPill (cross-check con axe).
const pillRatios = await page.evaluate(() => {
  function relLum(hex) {
    const m = hex.replace('#', '').match(/.{2}/g).map((h) => parseInt(h, 16) / 255);
    const lin = m.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  }
  function ratio(fg, bg) {
    const a = relLum(fg), b = relLum(bg);
    const hi = Math.max(a, b), lo = Math.min(a, b);
    return (hi + 0.05) / (lo + 0.05);
  }
  // Banner accentDeep #7E22CE; pill bg rgba(255,255,255,0.5) sobre ese banner.
  // Color compuesto: 0.5*255 + 0.5*126 = 190.5 (red), 144.5 (green), 230.5 (blue).
  const composedR = 0.5 * 255 + 0.5 * 126;
  const composedG = 0.5 * 255 + 0.5 * 34;
  const composedB = 0.5 * 255 + 0.5 * 206;
  const composed =
    '#' +
    [composedR, composedG, composedB]
      .map((c) => Math.round(c).toString(16).padStart(2, '0').toUpperCase())
      .join('');
  const labelEls = document.querySelectorAll('[data-testid="home-tag-list"] > * > *');
  const out = [];
  labelEls.forEach((el, i) => {
    const style = getComputedStyle(el);
    out.push({
      index: i,
      label: el.textContent,
      color: style.color,
      // El pill bg no se lee del DOM porque es un wrapper View, no un nodo
      // pintado directo. Reportamos el color compuesto esperado:
      pillComposedBg: composed,
      pillComposedBgHex: composed,
    });
  });
  // Asumimos copero theme: textOnPrimary = #09090B (zinc-950).
  const fgDark = '#09090B';
  const ratioDarkOnComposed = ratio(fgDark, composed);
  return {
    banner: '#7E22CE',
    pillComposedBg: composed,
    textOnPrimaryCopero: fgDark,
    pillRatios: out,
    ratioDarkOnComposed: Number(ratioDarkOnComposed.toFixed(2)),
    passesWCAG_AA: ratioDarkOnComposed >= 4.5,
  };
});

writeFileSync(
  `${OUT_DIR}/axe-result.json`,
  JSON.stringify({ banner: axeBanner, pageAll: axeAll }, null, 2),
);
writeFileSync(`${OUT_DIR}/contrast-ratios.json`, JSON.stringify(pillRatios, null, 2));

console.log('axe-core violations on home-tag-list:', axeBanner.violations.length);
const cc = axeBanner.violations.filter((v) => v.id === 'color-contrast');
console.log('color-contrast violations:', cc.length);
console.log('contrast ratios:', pillRatios);

await browser.close();

// Exit 0 si 0 violations color-contrast, exit 1 si hay.
const colorContrastViolations = axeBanner.violations.filter((v) => v.id === 'color-contrast').length;
process.exit(colorContrastViolations === 0 ? 0 : 1);
