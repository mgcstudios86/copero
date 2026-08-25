// MGC-815 — axe-core wcag2a/aa/21aa sobre / post-fix isolation+zIndex
// Ejecuta contra http://localhost:8765 (python http.server sirviendo dist/).
// Vuelca axe-result.json en qa/axe/mgc-803/.
import { chromium } from 'playwright';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const PORT = 8765;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT_DIR = resolve('qa/axe/mgc-803');

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1600 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/`, { waitUntil: 'load' });
await page.waitForSelector('[data-testid="home-screen"]', { timeout: 30_000 });
await page.waitForSelector('[data-testid="homepage-career-starter"]', { timeout: 30_000 });
await page.evaluate(() => {
  const el = document.querySelector('[data-testid="homepage-career-starter"]');
  if (el) el.scrollIntoView({ block: 'center' });
});
await page.waitForTimeout(2500);
await page.waitForSelector('[data-testid="segment-draft-mode-classic"]', { state: 'attached', timeout: 15_000 });
await page.waitForSelector('[data-testid="segment-draft-mode-purist"]', { state: 'attached', timeout: 15_000 });

await page.screenshot({ path: `${OUT_DIR}/home-full-mgc815.png`, fullPage: false });

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
  process.exit(1);
}
await page.addScriptTag({ content: axeSrc });

const axeResult = await page.evaluate(async () => {
  // eslint-disable-next-line no-undef
  const results = await axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    resultTypes: ['violations', 'incomplete', 'inapplicable'],
  });
  return results;
});

writeFileSync(`${OUT_DIR}/axe-result-mgc815.json`, JSON.stringify(axeResult, null, 2));

console.log(`axe violations: ${axeResult.violations.length}`);
for (const v of axeResult.violations) {
  console.log(`  - [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodes)`);
}

await browser.close();
process.exit(axeResult.violations.length > 0 ? 1 : 0);
