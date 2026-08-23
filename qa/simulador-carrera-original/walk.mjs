// Walkthrough profundo: nationality → position/foot → name/age → club → decision events.
// Estrategia: modo Normal fixed, variar país + nombre + posición para maximizar branching.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.env.PROJ_ROOT || '/Users/matiasgonzalocalvo/.paperclip/instances/default/projects/5f4a6c8a-cec3-48de-bf5c-5bb8a96f9b2c/529fd29c-0df0-4556-8944-56ce675b7f4f/_default';
const URL = 'https://copero.com.ar/juegos/simulador-carrera';
const OUT = join(ROOT, 'design/simulador-carrera/evidence/original');
const OUT_PARTIALS = join(ROOT, 'design/simulador-carrera/evidence/partials');
const OUT_RUNS = join(ROOT, 'design/simulador-carrera/evidence/runs');
for (const d of [OUT, OUT_PARTIALS, OUT_RUNS]) if (!existsSync(d)) mkdirSync(d, { recursive: true });

const graph = { nodes: {}, edges: [] };
function hash(s) { let h=0; for (let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))|0; return String(h); }

async function capture(page, label, parentKey = null, choice = null) {
  const text = await page.evaluate(() => (document.body.innerText || '').slice(0, 9000));
  const buttons = await page.evaluate(() => {
    const arr = [];
    document.querySelectorAll('button, [role="button"], a, label, [role="link"], [tabindex]').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      const t = (el.innerText || el.textContent || '').trim().slice(0, 120);
      const tag = el.tagName.toLowerCase();
      if (tag === 'script' || tag === 'style') return;
      if (!t && tag !== 'input') return;
      arr.push({ tag, text: t, aria: el.getAttribute('aria-label'), role: el.getAttribute('role') });
    });
    return arr.slice(0, 100);
  });
  const inputs = await page.evaluate(() => {
    const arr = [];
    document.querySelectorAll('input, select, textarea').forEach((el) => {
      arr.push({ tag: el.tagName.toLowerCase(), type: el.getAttribute('type'), name: el.getAttribute('name'), placeholder: el.getAttribute('placeholder'), value: el.value });
    });
    return arr;
  });
  const images = await page.evaluate(() => Array.from(document.querySelectorAll('img')).filter((i)=>{ const r=i.getBoundingClientRect(); return r.width>=4&&r.height>=4;}).slice(0,40).map((i) => ({ src: i.currentSrc || i.src, alt: i.alt, w: Math.round(i.getBoundingClientRect().width), h: Math.round(i.getBoundingClientRect().height) })));
  const k = hash(text + '|' + buttons.slice(0, 10).map((b) => b.text).join('|'));
  const isNew = !graph.nodes[k];
  if (isNew) graph.nodes[k] = { id: k, label, firstSeen: new Date().toISOString(), url: page.url(), text, buttons, inputs, images, occurrences: 1 };
  else graph.nodes[k].occurrences++;
  if (parentKey && choice) graph.edges.push({ from: parentKey, to: k, choice, ts: new Date().toISOString() });
  const file = join(OUT_PARTIALS, `${String(Object.keys(graph.nodes).length).padStart(4, '0')}-${label.replace(/[^a-z0-9-]+/gi, '_')}.json`);
  writeFileSync(file, JSON.stringify({ key: k, label, isNew, text, buttons, inputs, images, choice }, null, 2));
  return { key: k, isNew, text, buttons, inputs, images };
}

async function shot(page, name) { await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false }); }

async function clickByText(page, text, exact = false) {
  const handles = await page.locator('button, [role="button"], a, label, [role="link"], [tabindex]').all();
  const t = (text || '').trim();
  for (const h of handles) {
    const ht = ((await h.innerText().catch(() => '')) || '').trim();
    if ((exact && ht === t) || (!exact && (ht === t || ht.startsWith(t) || ht.includes(t)))) {
      await h.click({ timeout: 2000 }).catch(() => {});
      return true;
    }
  }
  return false;
}

async function clickButtonByExactText(page, t) {
  // usa evaluate para click directo via getByText (más confiable que iterar handles)
  try {
    const el = page.getByText(t, { exact: true }).first();
    await el.click({ timeout: 2000 });
    return true;
  } catch { return false; }
}

async function fillFirst(page, value, placeholder = null) {
  const inputs = await page.locator('input, textarea').all();
  for (const i of inputs) {
    const ph = await i.getAttribute('placeholder').catch(() => '');
    if (placeholder && ph !== placeholder) continue;
    await i.fill(value).catch(() => {});
    return true;
  }
  return false;
}

async function waitForChange(page, prevKey, maxMs = 6000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const text = await page.evaluate(() => (document.body.innerText || '').slice(0, 6000));
    const buttons = await page.evaluate(() => Array.from(document.querySelectorAll('button, [role="button"], a')).slice(0, 10).map((b) => (b.innerText || '').trim()).join('|'));
    const k = hash(text + '|' + buttons);
    if (k !== prevKey) return k;
    await page.waitForTimeout(200);
  }
  return prevKey;
}

async function step(page, parent, label, action, target, choice) {
  let ok = false;
  try {
    if (action === 'clickText') ok = await clickByText(page, target);
    else if (action === 'clickExact') ok = await clickButtonByExactText(page, target);
    else if (action === 'fillPlaceholder') ok = await fillFirst(page, target.value, target.placeholder);
    else if (action === 'fill') ok = await fillFirst(page, target);
    else if (action === 'wait') { await page.waitForTimeout(target || 1000); ok = true; }
  } catch (e) { ok = false; }
  await page.waitForTimeout(400);
  const newKey = await waitForChange(page, parent.key, 5500);
  const s = await capture(page, label, newKey !== parent.key ? parent.key : null, choice || target);
  return s;
}

async function runOne(name, script, maxSteps = 50) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(`[${name}] CRASH:`, e.message));
  const log = [];

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3500);
  let s = await capture(page, `${name}-00-splash`);
  await shot(page, `${name}-00-splash`);
  log.push({ step: 0, label: 'splash', key: s.key, isNew: s.isNew });

  for (let i = 0; i < script.length && i < maxSteps; i++) {
    const st = script[i];
    try {
      s = await step(page, s, `${name}-${String(i+1).padStart(2,'0')}-${st.label||'step'}`, st.action, st.target, st.choice);
      log.push({ step: i + 1, label: st.label, key: s.key, isNew: s.isNew, action: st.action, target: typeof st.target === 'string' ? st.target : (st.target && st.target.value) });
      await shot(page, `${name}-${String(i+1).padStart(2,'0')}-${(st.label||'step').replace(/[^a-z0-9-]+/gi,'_')}`);
    } catch (e) {
      log.push({ step: i + 1, error: e.message });
      break;
    }
  }

  const finalText = await page.evaluate(() => document.body.innerText.slice(0, 6000));
  writeFileSync(join(OUT_RUNS, `${name}.json`), JSON.stringify({ name, log, finalText }, null, 2));
  await browser.close();
}

async function main() {
  // A: Argentina → ST → CALVO → 16 → Right
  await runOne('A-ARgentina-ST-CALVO', [
    { action: 'clickText', target: 'Normal', choice: 'mode:Normal', label: 'mode-normal' },
    { action: 'clickText', target: 'Comenzar carrera', choice: 'start', label: 'start' },
    { action: 'clickText', target: 'Argentina', choice: 'country:Argentina', label: 'country-ar' },
    { action: 'clickText', target: 'Continuar', choice: 'continue', label: 'continue-after-country' },
    { action: 'wait', target: 1500, label: 'wait-next-screen' },
  ]);

  // B: Brasil → GK → NEYMAR → 18 → Left
  await runOne('B-Brasil-GK-NEYMAR', [
    { action: 'clickText', target: 'Normal', choice: 'mode:Normal', label: 'mode-normal' },
    { action: 'clickText', target: 'Comenzar carrera', choice: 'start', label: 'start' },
    { action: 'clickText', target: 'Brasil', choice: 'country:Brasil', label: 'country-br' },
    { action: 'clickText', target: 'Continuar', choice: 'continue', label: 'continue-after-country' },
    { action: 'wait', target: 1500, label: 'wait-next-screen' },
  ]);

  // C: España → CB → Lamine → 20 → Right
  await runOne('C-Espana-CB-Lamine', [
    { action: 'clickText', target: 'Normal', choice: 'mode:Normal', label: 'mode-normal' },
    { action: 'clickText', target: 'Comenzar carrera', choice: 'start', label: 'start' },
    { action: 'clickText', target: 'España', choice: 'country:España', label: 'country-es' },
    { action: 'clickText', target: 'Continuar', choice: 'continue', label: 'continue-after-country' },
    { action: 'wait', target: 1500, label: 'wait-next-screen' },
  ]);

  writeFileSync(join(ROOT, 'design/simulador-carrera/_graph-walk.json'), JSON.stringify({
    nodes: Object.values(graph.nodes),
    edges: graph.edges,
  }, null, 2));

  console.log(`NODES=${Object.keys(graph.nodes).length} EDGES=${graph.edges.length}`);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
