import { chromium } from 'playwright';
import fs from 'fs';

const route = process.argv[2] || 'http://127.0.0.1:8084/';
const cwd = '/Users/matiasgonzalocalvo/.paperclip/instances/default/projects/5f4a6c8a-cec3-48de-bf5c-5bb8a96f9b2c/529fd29c-0df0-4556-8944-56ce675b7f4f/_default';
const out = {};
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(route, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);
await page.addScriptTag({ path: `${cwd}/qa/axe.min.js` });
const results = await page.evaluate(() => axe.run({ runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa'] } }));
out[route] = {
  violations: results.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length })),
  incomplete: results.incomplete.length,
  passes: results.passes.length,
  fullViolations: results.violations,
};
await page.screenshot({ path: `${cwd}/qa/lighthouse/mgc-762-pr115/r3/home.png`, fullPage: false });
await browser.close();
fs.writeFileSync(`${cwd}/qa/lighthouse/mgc-762-pr115/r3/axe-summary.json`, JSON.stringify(out, null, 2));
fs.writeFileSync(`${cwd}/qa/lighthouse/mgc-762-pr115/r3/axe-full.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(out[route], null, 2));
