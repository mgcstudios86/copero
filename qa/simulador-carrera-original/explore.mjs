// Walkthrough completo del simulador-carrera original.
// Estrategia: arrancar fresh cada corrida, tomar decisiones distintas, capturar cada pantalla única.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.env.PROJ_ROOT || '/Users/matiasgonzalocalvo/.paperclip/instances/default/projects/5f4a6c8a-cec3-48de-bf5c-5bb8a96f9b2c/529fd29c-0df0-4556-8944-56ce675b7f4f/_default';
const URL = 'https://copero.com.ar/juegos/simulador-carrera';
const OUT = join(ROOT, 'design/simulador-carrera/evidence/original');
const OUT_PARTIALS = join(ROOT, 'design/simulador-carrera/evidence/partials');
const OUT_RUNS = join(ROOT, 'design/simulador-carrera/evidence/runs');

for (const d of [OUT, OUT_PARTIALS, OUT_RUNS]) if (!existsSync(d)) mkdirSync(d, { recursive: true });

const graph = {
  nodes: {},
  edges: [],
  stateVars: new Set(),
  endConditions: new Set(),
  assets: new Set(),
  textSnippets: [],
};

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h);
}

async function capture(page, label, parentHash = null, choice = null) {
  const text = await page.evaluate(() => (document.body.innerText || '').slice(0, 8000));
  const buttons = await page.evaluate(() => {
    const arr = [];
    document.querySelectorAll('button, [role="button"], a, [role="link"], label, input, select, textarea').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      const t = (el.innerText || el.textContent || el.placeholder || el.value || '').trim().slice(0, 120);
      const tag = el.tagName.toLowerCase();
      const type = el.getAttribute('type') || '';
      if (tag === 'script' || tag === 'style') return;
      arr.push({
        tag,
        type,
        text: t,
        name: el.getAttribute('name'),
        role: el.getAttribute('role'),
        aria: el.getAttribute('aria-label'),
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      });
    });
    return arr.slice(0, 80);
  });
  const images = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('img').forEach((i) => {
      const r = i.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      out.push({ src: i.currentSrc || i.src, alt: i.alt, w: Math.round(r.width), h: Math.round(r.height) });
    });
    return out.slice(0, 30);
  });
  const inputs = await page.evaluate(() => {
    const arr = [];
    document.querySelectorAll('input, select, textarea').forEach((el) => {
      arr.push({
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type'),
        name: el.getAttribute('name'),
        placeholder: el.getAttribute('placeholder'),
        value: el.value,
        options: el.tagName === 'SELECT' ? Array.from(el.options).map((o) => ({ v: o.value, t: o.textContent.trim() })) : null,
      });
    });
    return arr;
  });
  const key = hash(text + '|' + buttons.slice(0, 8).map((b) => b.text).join('|'));
  const nodeId = parentHash ? `${parentHash}->${key}` : key;
  const isNew = !graph.nodes[key];
  if (isNew) {
    graph.nodes[key] = {
      id: key,
      label,
      firstSeen: new Date().toISOString(),
      url: page.url(),
      text,
      buttons,
      images,
      inputs,
      occurrences: 1,
    };
  } else {
    graph.nodes[key].occurrences++;
  }
  if (parentHash && choice) {
    graph.edges.push({ from: parentHash, to: key, choice, ts: new Date().toISOString() });
  }
  const file = join(OUT_PARTIALS, `${String(Object.keys(graph.nodes).length).padStart(4, '0')}-${label.replace(/[^a-z0-9-]+/gi, '_')}.json`);
  writeFileSync(file, JSON.stringify({ key, label, isNew, text, buttons, images, inputs, choice }, null, 2));
  return { key, isNew, text, buttons, inputs, images, label };
}

async function shot(page, name) {
  const p = join(OUT, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

async function clickByText(page, text, exact = false) {
  const handles = await page.locator('button, [role="button"], a, label, [role="link"]').all();
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

async function clickByIndex(page, idx) {
  const handles = await page.locator('button, [role="button"], a, label, [role="link"], input[type="radio"], input[type="checkbox"]').all();
  if (idx >= handles.length) return false;
  await handles[idx].click({ timeout: 2000 }).catch(() => {});
  return true;
}

async function fill(page, value, idx = 0) {
  const inputs = await page.locator('input, textarea').all();
  if (idx >= inputs.length) return false;
  await inputs[idx].fill(value).catch(() => {});
  return true;
}

async function selectValue(page, value, idx = 0) {
  const sels = await page.locator('select').all();
  if (idx >= sels.length) return false;
  await sels[idx].selectOption(value).catch(() => {});
  return true;
}

async function waitForNewScreen(page, prevHash, maxMs = 7000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const text = await page.evaluate(() => (document.body.innerText || '').slice(0, 8000));
    const buttons = await page.evaluate(() => Array.from(document.querySelectorAll('button, [role="button"], a')).slice(0, 8).map((b) => (b.innerText || '').trim()).join('|'));
    const k = hash(text + '|' + buttons);
    if (k !== prevHash) return k;
    await page.waitForTimeout(150);
  }
  return prevHash;
}

async function dismissCookies(page) {
  // try several known cookie labels
  const candidates = ['Aceptar', 'Aceptar todas', 'Aceptar cookies', 'Accept', 'OK'];
  for (const c of candidates) {
    if (await clickByText(page, c, false)) return c;
  }
  return null;
}

async function runOne(strategyName, steps) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(`[${strategyName}] CRASH:`, e.message));

  const runLog = [];
  let parent = null;

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3500);

  // 1. initial
  let s = await capture(page, `${strategyName}-00-initial`);
  runLog.push({ step: 'initial', key: s.key, isNew: s.isNew });
  await shot(page, `${strategyName}-00-initial`);

  // dismiss cookies if present (non-blocking)
  await dismissCookies(page).catch(() => {});
  await page.waitForTimeout(500);

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    let didAct = false;
    if (step.action === 'clickText') {
      didAct = await clickByText(page, step.text, step.exact === true);
    } else if (step.action === 'clickIndex') {
      didAct = await clickByIndex(page, step.idx);
    } else if (step.action === 'fill') {
      didAct = await fill(page, step.value, step.idx || 0);
    } else if (step.action === 'select') {
      didAct = await selectValue(page, step.value, step.idx || 0);
    } else if (step.action === 'wait') {
      await page.waitForTimeout(step.ms || 1500);
      didAct = true;
    }
    await page.waitForTimeout(500);
    const newKey = await waitForNewScreen(page, s.key, 4500);
    const ns = await capture(page, `${strategyName}-${String(i + 1).padStart(2, '0')}-${step.label || 'step'}`, newKey !== s.key ? s.key : null, step.choice || step.text || step.value);
    runLog.push({ step: i, action: step.action, target: step.text || step.value || step.idx, didAct, key: ns.key, isNew: ns.isNew });
    parent = ns.key;
    s = ns;
    if (ns.text && /fin|career.*end|retir|champion|ganaste|campe[oó]n|fin de carrera|termin/i.test(ns.text) && step.stopOnFinish) {
      runLog.push({ step: 'finish', text: ns.text.slice(0, 200) });
      await shot(page, `${strategyName}-${String(i + 1).padStart(2, '0')}-finish`);
      break;
    }
    if (i < 5) await shot(page, `${strategyName}-${String(i + 1).padStart(2, '0')}-${(step.label || 'step').replace(/[^a-z0-9-]+/gi, '_')}`);
  }

  // final dump
  const finalText = await page.evaluate(() => document.body.innerText.slice(0, 6000));
  writeFileSync(join(OUT_RUNS, `${strategyName}.json`), JSON.stringify({ strategyName, log: runLog, finalText }, null, 2));
  await browser.close();
}

async function main() {
  // Run A: modo Normal, name "CALVO", age 16, position ST, country Argentina
  await runOne('A-Normal-ST-CALVO', [
    { action: 'clickText', text: 'Normal', exact: false, label: 'mode-normal' },
    { action: 'clickText', text: 'Comenzar carrera', exact: false, label: 'start' },
    { action: 'wait', ms: 1200, label: 'after-start' },
  ]);

  // Run B: modo Intensa
  await runOne('B-Intensa', [
    { action: 'clickText', text: 'Intensa', exact: false, label: 'mode-intensa' },
    { action: 'clickText', text: 'Comenzar carrera', exact: false, label: 'start' },
    { action: 'wait', ms: 1200, label: 'after-start' },
  ]);

  // Run C: modo Exprés
  await runOne('C-Expres', [
    { action: 'clickText', text: 'Exprés', exact: false, label: 'mode-expres' },
    { action: 'clickText', text: 'Comenzar carrera', exact: false, label: 'start' },
    { action: 'wait', ms: 1200, label: 'after-start' },
  ]);

  writeFileSync(join(ROOT, 'design/simulador-carrera/_graph-partial.json'), JSON.stringify({
    nodes: Object.values(graph.nodes),
    edges: graph.edges,
  }, null, 2));

  console.log(`\nNODES=${Object.keys(graph.nodes).length} EDGES=${graph.edges.length} PARTIALS=${Object.keys(graph.nodes).length}`);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
