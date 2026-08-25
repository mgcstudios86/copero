import { chromium } from 'playwright';

const BASE = 'http://localhost:8742';
const OUT = 'qa/builds/MGC-760';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/`, { waitUntil: 'load' });
await page.waitForSelector('[data-testid="home-screen"]', { timeout: 30000 });
await page.screenshot({ path: `${OUT}/web-1440-light.png`, fullPage: false });

await page.emulateMedia({ colorScheme: 'dark' });
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('[data-testid="home-screen"]', { timeout: 30000 });
await page.screenshot({ path: `${OUT}/web-1440-dark.png`, fullPage: false });

await browser.close();
console.log('Captured 1440 light + dark');