/**
 * Captura wireframes HTML del simulador-carrera a PNG 375×812.
 * MGC-435 — designer.
 *
 * Uso: PROJ_ROOT="$PWD" node qa/capture-wireframes-mgc435.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PROJ_ROOT = process.env.PROJ_ROOT || process.cwd();
const SCREENS_DIR = resolve(PROJ_ROOT, 'design/simulador-carrera/screens');
const OUT_DIR = resolve(PROJ_ROOT, 'design/simulador-carrera/evidence/wireframes');

mkdirSync(OUT_DIR, { recursive: true });

const screens = [
  '01-splash.html',
  '02-nationality.html',
  '03-identity.html',
  '04-position.html',
  '05-dashboard-initial.html',
  '06-dashboard-active.html',
  '07-offer-youth.html',
  '08-loan-offer.html',
  '09-return-parent.html',
  '10-career-end.html',
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 2,
  locale: 'es-AR',
});
const page = await context.newPage();

let captured = 0;
for (const name of screens) {
  const url = `file://${join(SCREENS_DIR, name)}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500); // fonts
  const out = join(OUT_DIR, name.replace('.html', '.png'));
  await page.screenshot({ path: out, fullPage: true });
  console.log(`✓ ${name} → ${out}`);
  captured++;
}

await browser.close();
console.log(`\nDone. ${captured}/10 captured in ${OUT_DIR}`);