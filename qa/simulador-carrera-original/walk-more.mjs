// 3 corridas más para diversificar branching (distintos countries, modos, posiciones)
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = '/Users/matiasgonzalocalvo/.paperclip/instances/default/projects/5f4a6c8a-cec3-48de-bf5c-5bb8a96f9b2c/529fd29c-0df0-4556-8944-56ce675b7f4f/_default';
const URL = 'https://copero.com.ar/juegos/simulador-carrera';
const OUT = join(ROOT, 'design/simulador-carrera/evidence/original');
const OUT_PARTIALS = join(ROOT, 'design/simulador-carrera/evidence/partials');
const OUT_RUNS = join(ROOT, 'design/simulador-carrera/evidence/runs');
for (const d of [OUT, OUT_PARTIALS, OUT_RUNS]) if (!existsSync(d)) mkdirSync(d, { recursive: true });

const graph = { nodes: {}, edges: [], assets: new Set() };
function hash(s) { let h=0; for (let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))|0; return String(h); }

async function capture(page, label, parentKey = null, choice = null) {
  const text = await page.evaluate(() => (document.body.innerText || '').slice(0, 14000));
  const buttons = await page.evaluate(() => Array.from(document.querySelectorAll('button, [role="button"], a, label, [role="link"], [tabindex]')).filter((el) => { const r=el.getBoundingClientRect(); return r.width>=4&&r.height>=4; }).slice(0, 80).map((el) => ({ tag: el.tagName.toLowerCase(), text: (el.innerText || el.textContent || '').trim().slice(0, 120) })));
  const images = await page.evaluate(() => Array.from(document.querySelectorAll('img')).filter((i)=>{const r=i.getBoundingClientRect();return r.width>=4&&r.height>=4;}).slice(0,40).map((i)=>({src:i.currentSrc||i.src,alt:i.alt})));
  images.forEach((i) => i.src && graph.assets.add(i.src));
  const k = hash(text + '|' + buttons.slice(0, 14).map((b) => b.text).join('|'));
  const isNew = !graph.nodes[k];
  if (isNew) graph.nodes[k] = { id: k, label, firstSeen: new Date().toISOString(), url: page.url(), text, buttons, images, occurrences: 1 };
  else graph.nodes[k].occurrences++;
  if (parentKey && choice) graph.edges.push({ from: parentKey, to: k, choice, ts: new Date().toISOString() });
  const file = join(OUT_PARTIALS, `${String(Object.keys(graph.nodes).length).padStart(4, '0')}-${label.replace(/[^a-z0-9-]+/gi, '_')}.json`);
  writeFileSync(file, JSON.stringify({ key: k, label, isNew, text: text.slice(0, 4000), buttons: buttons.slice(0, 12), images: images.slice(0, 8), choice }, null, 2));
  return { key: k, isNew, text, buttons };
}
async function shot(page, name) { await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false }); }
async function clickByText(page, text, exact = false) {
  const handles = await page.locator('button, [role="button"], a, label, [role="link"], [tabindex]').all();
  const t = (text || '').trim();
  for (const h of handles) {
    const ht = ((await h.innerText().catch(() => '')) || '').trim();
    if ((exact && ht === t) || (!exact && (ht === t || ht.startsWith(t)))) {
      await h.click({ timeout: 2000 }).catch(() => {});
      return true;
    }
  }
  return false;
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
async function waitChange(page, prevKey, maxMs = 6500) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const text = await page.evaluate(() => (document.body.innerText || '').slice(0, 6000));
    const buttons = await page.evaluate(() => Array.from(document.querySelectorAll('button, [role="button"], a')).slice(0, 12).map((b) => (b.innerText || '').trim()).join('|'));
    const k = hash(text + '|' + buttons);
    if (k !== prevKey) return k;
    await page.waitForTimeout(200);
  }
  return prevKey;
}
async function clickAdvance(page) {
  for (const t of ['Confirmar identidad','Continuar','Siguiente','Empezar','Jugar','Iniciar','Aceptar']) {
    if (await clickByText(page, t, true)) return t;
  }
  return null;
}
async function clickDecision(page) {
  const EXCLUDE = ['Continuar','Confirmar','Siguiente','Empezar','Jugar','Aceptar','Volver','Rechazar','Cookies','Privacidad','Términos','Contacto','Sobre','Twitter','Instagram','cafecito','Invit','Volver a Juegos','ES','EN','PT','copero','Diccionario','Hostelería','Vino','stats','Fútbol','Simulador','Equipos','Juegos','Estrategia','Prode','Mundial','Ver logros'];
  const buttons = await page.locator('button, [role="button"]').all();
  for (const b of buttons) {
    const t = ((await b.innerText().catch(() => '')) || '').trim();
    if (!t) continue;
    if (EXCLUDE.some((e) => t === e || t.startsWith(e))) continue;
    await b.click({ timeout: 2000 }).catch(() => {});
    return t;
  }
  return null;
}

async function runOne(name, buildScript) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15', locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(`[${name}] CRASH:`, e.message));
  const log = [];
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3500);
  let s = await capture(page, `${name}-00-splash`);
  await shot(page, `${name}-00-splash`);
  log.push({ step: 0, label: 'splash', key: s.key, isNew: s.isNew });

  const script = buildScript(page);
  for (let i = 0; i < script.length && i < 80; i++) {
    const st = script[i];
    try {
      await st.action();
      await page.waitForTimeout(400);
      const newKey = await waitChange(page, s.key, 6500);
      const ns = await capture(page, `${name}-${String(i+1).padStart(2,'0')}-${st.label}`, newKey !== s.key ? s.key : null, st.label);
      await shot(page, `${name}-${String(i+1).padStart(2,'0')}-${st.label.replace(/[^a-z0-9-]+/gi,'_')}`);
      log.push({ step: i+1, label: st.label, key: ns.key, isNew: ns.isNew });
      s = ns;
    } catch (e) {
      log.push({ step: i+1, error: e.message });
      break;
    }
  }

  const finalText = await page.evaluate(() => document.body.innerText.slice(0, 6000));
  writeFileSync(join(OUT_RUNS, `${name}.json`), JSON.stringify({ name, log, finalText }, null, 2));
  await browser.close();
}

async function main() {
  // J: Italia + ED + TOTTI
  await runOne('J-IT-ED-TOTTI', (page) => [
    { label: 'mode-normal', action: async () => clickByText(page, 'Normal', false) },
    { label: 'start', action: async () => clickByText(page, 'Comenzar carrera', false) },
    { label: 'country-it', action: async () => clickByText(page, 'Italia', false) },
    { label: 'continue-country', action: async () => clickAdvance(page) },
    { label: 'fill-apellido', action: async () => fillFirst(page, 'TOTTI', 'Apellido') },
    { label: 'foot-right', action: async () => clickByText(page, 'Derecha', true) },
    { label: 'continue-identity', action: async () => clickAdvance(page) },
    { label: 'position-ED', action: async () => clickByText(page, 'ED', true) },
    { label: 'confirm-position', action: async () => clickAdvance(page) },
    { label: 'wait-dashboard', action: async () => page.waitForTimeout(1800) },
    { label: 'event-1-decision', action: async () => clickDecision(page) },
    { label: 'event-1-wait', action: async () => page.waitForTimeout(1800) },
    { label: 'event-2-decision', action: async () => clickDecision(page) },
    { label: 'event-2-wait', action: async () => page.waitForTimeout(1800) },
    { label: 'event-3-decision', action: async () => clickDecision(page) },
    { label: 'event-3-wait', action: async () => page.waitForTimeout(1800) },
    { label: 'event-4-decision', action: async () => clickDecision(page) },
    { label: 'event-4-wait', action: async () => page.waitForTimeout(1800) },
    { label: 'event-5-decision', action: async () => clickDecision(page) },
    { label: 'event-5-wait', action: async () => page.waitForTimeout(1800) },
  ]);

  // K: Francia + MC + MBAPPE
  await runOne('K-FR-MC-MBAPPE', (page) => [
    { label: 'mode-intensa', action: async () => clickByText(page, 'Intensa', false) },
    { label: 'start', action: async () => clickByText(page, 'Comenzar carrera', false) },
    { label: 'country-fr', action: async () => clickByText(page, 'Francia', false) },
    { label: 'continue-country', action: async () => clickAdvance(page) },
    { label: 'fill-apellido', action: async () => fillFirst(page, 'MBAPPE', 'Apellido') },
    { label: 'foot-right', action: async () => clickByText(page, 'Derecha', true) },
    { label: 'continue-identity', action: async () => clickAdvance(page) },
    { label: 'position-MC', action: async () => clickByText(page, 'MC', true) },
    { label: 'confirm-position', action: async () => clickAdvance(page) },
    { label: 'wait-dashboard', action: async () => page.waitForTimeout(1800) },
    { label: 'event-1-decision', action: async () => clickDecision(page) },
    { label: 'event-1-wait', action: async () => page.waitForTimeout(1800) },
    { label: 'event-2-decision', action: async () => clickDecision(page) },
    { label: 'event-2-wait', action: async () => page.waitForTimeout(1800) },
    { label: 'event-3-decision', action: async () => clickDecision(page) },
    { label: 'event-3-wait', action: async () => page.waitForTimeout(1800) },
  ]);

  // L: Inglaterra + LI + BECKHAM
  await runOne('L-EN-LI-BECKHAM', (page) => [
    { label: 'mode-expres', action: async () => clickByText(page, 'Exprés', false) },
    { label: 'start', action: async () => clickByText(page, 'Comenzar carrera', false) },
    { label: 'country-en', action: async () => clickByText(page, 'Inglaterra', false) },
    { label: 'continue-country', action: async () => clickAdvance(page) },
    { label: 'fill-apellido', action: async () => fillFirst(page, 'BECKHAM', 'Apellido') },
    { label: 'foot-right', action: async () => clickByText(page, 'Derecha', true) },
    { label: 'continue-identity', action: async () => clickAdvance(page) },
    { label: 'position-LI', action: async () => clickByText(page, 'LI', true) },
    { label: 'confirm-position', action: async () => clickAdvance(page) },
    { label: 'wait-dashboard', action: async () => page.waitForTimeout(1800) },
    { label: 'event-1-decision', action: async () => clickDecision(page) },
    { label: 'event-1-wait', action: async () => page.waitForTimeout(1800) },
    { label: 'event-2-decision', action: async () => clickDecision(page) },
    { label: 'event-2-wait', action: async () => page.waitForTimeout(1800) },
  ]);

  writeFileSync(join(ROOT, 'design/simulador-carrera/_graph-final.json'), JSON.stringify({
    nodes: Object.values(graph.nodes),
    edges: graph.edges,
    assets: Array.from(graph.assets),
  }, null, 2));
  console.log(`NODES=${Object.keys(graph.nodes).length} EDGES=${graph.edges.length} ASSETS=${graph.assets.size}`);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
