import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const path = 'design/simulador-carrera/assets/screenshots/preview.html';
const url = 'file://' + process.cwd() + '/' + path;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1600 } });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
await page.screenshot({ path: 'design/simulador-carrera/assets/screenshots/preview-full.png', fullPage: true });
const axePath = 'node_modules/axe-core/axe.min.js';
let axeSrc = null;
if (existsSync(axePath)) axeSrc = readFileSync(axePath, 'utf8');
if (axeSrc) {
  await page.addScriptTag({ content: axeSrc });
  const results = await page.evaluate(async () => await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }));
  const v = results.violations;
  writeFileSync('design/simulador-carrera/assets/screenshots/axe-report.json', JSON.stringify({ violations: v, passes: results.passes.length }, null, 2));
  console.log('axe violations:', v.length, 'passes:', results.passes.length);
  for (const x of v) console.log('  -', x.id, x.impact, x.help);
} else {
  console.log('axe-core not installed; skipping axe scan');
}
await browser.close();
