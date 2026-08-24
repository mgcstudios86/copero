import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import fs from 'fs';

const routes = [
  'https://copero.mgcstudios.app/simulador-carrera/identity',
  'https://copero.mgcstudios.app/simulador-carrera/dashboard',
];
const out = {};
for (const route of routes) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  console.log('scan', route);
  await page.goto(route, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  out[route] = {
    violations: results.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length })),
    incomplete: results.incomplete.length,
    passes: results.passes.length,
  };
  await browser.close();
}
fs.writeFileSync('qa/lighthouse/mgc-482-prod/r4/axe-summary.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
