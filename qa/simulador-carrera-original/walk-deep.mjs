// Walkthrough full desde splash hasta fin de carrera (o hasta agotar presupuesto).
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = '/Users/matiasgonzalocalvo/.paperclip/instances/default/projects/5f4a6c8a-cec3-48de-bf5c-5bb8a96f9b2c/529fd29c-0df0-4556-8944-56ce675b7f4f/_default';
const URL = 'https://copero.com.ar/juegos/simulador-carrera';
const OUT = join(ROOT, 'design/simulador-carrera/evidence/original');
const OUT_PARTIALS = join(ROOT, 'design/simulador-carrera/evidence/partials');
const OUT_RUNS = join(ROOT, 'design/simulador-carrera/evidence/runs');
for (const d of [OUT, OUT_PARTIALS, OUT_RUNS]) if (!existsSync(d)) mkdirSync(d, { recursive: true });

const graph = { nodes: {}, edges: [], textCorpus: [], assets: new Set() };
function hash(s) { let h=0; for (let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))|0; return String(h); }

async function capture(page, label, parentKey = null, choice = null) {
  const text = await page.evaluate(() => (document.body.innerText || '').slice(0, 12000));
  const buttons = await page.evaluate(() => Array.from(document.querySelectorAll('button, [role="button"], a, label, [role="link"], [tabindex]')).filter((el) => { const r=el.getBoundingClientRect(); return r.width>=4&&r.height>=4; }).slice(0, 80).map((el) => ({ tag: el.tagName.toLowerCase(), text: (el.innerText || el.textContent || '').trim().slice(0, 120), aria: el.getAttribute('aria-label') })));
  const inputs = await page.evaluate(() => Array.from(document.querySelectorAll('input, select, textarea')).map((el) => ({ tag: el.tagName.toLowerCase(), type: el.getAttribute('type'), placeholder: el.getAttribute('placeholder'), value: el.value })));
  const images = await page.evaluate(() => Array.from(document.querySelectorAll('img')).filter((i)=>{const r=i.getBoundingClientRect();return r.width>=4&&r.height>=4;}).slice(0,40).map((i)=>({src:i.currentSrc||i.src,alt:i.alt})));
  images.forEach((i) => i.src && graph.assets.add(i.src));
  const k = hash(text + '|' + buttons.slice(0, 12).map((b) => b.text).join('|'));
  const isNew = !graph.nodes[k];
  if (isNew) graph.nodes[k] = { id: k, label, firstSeen: new Date().toISOString(), url: page.url(), text, buttons, inputs, images, occurrences: 1 };
  else graph.nodes[k].occurrences++;
  if (parentKey && choice) graph.edges.push({ from: parentKey, to: k, choice, ts: new Date().toISOString() });
  const file = join(OUT_PARTIALS, `${String(Object.keys(graph.nodes).length).padStart(4, '0')}-${label.replace(/[^a-z0-9-]+/gi, '_')}.json`);
  writeFileSync(file, JSON.stringify({ key: k, label, isNew, text: text.slice(0, 4000), buttons, inputs, images: images.slice(0, 8), choice }, null, 2));
  graph.textCorpus.push(text.slice(0, 1500));
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

async function fillFirstInput(page, value, placeholder = null) {
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

async function clickAnyVisible(page, exclude = ['Cookies', 'Privacidad', 'Términos', 'Contacto', 'Bases Prode', 'X / Twitter', 'Instagram', 'cafecito', 'Sobre nos', 'copero', 'ES', 'EN', 'PT']) {
  // heurística: elegir primer botón relevante no excluido
  const handles = await page.locator('button, [role="button"], a').all();
  for (const h of handles) {
    const ht = ((await h.innerText().catch(() => '')) || '').trim();
    if (!ht) continue;
    if (exclude.some((e) => ht.includes(e))) continue;
    await h.click({ timeout: 2000 }).catch(() => {});
    return ht;
  }
  return null;
}

async function runOne(name, plan, maxSteps = 80) {
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

  for (let i = 0; i < plan.length && i < maxSteps; i++) {
    const st = plan[i];
    try {
      if (st.action === 'clickText') await clickByText(page, st.target, st.exact === true);
      else if (st.action === 'fillPlaceholder') await fillFirstInput(page, st.value, st.placeholder);
      else if (st.action === 'wait') await page.waitForTimeout(st.ms || 1200);
      else if (st.action === 'clickAny') await clickAnyVisible(page);
      await page.waitForTimeout(400);
      const newKey = await waitForChange(page, s.key, 5500);
      const ns = await capture(page, `${name}-${String(i+1).padStart(2,'0')}-${(st.label||'step').replace(/[^a-z0-9-]+/gi,'_')}`, newKey !== s.key ? s.key : null, st.choice || st.target || (st.value||''));
      log.push({ step: i + 1, label: st.label, key: ns.key, isNew: ns.isNew, choice: st.choice || st.target });
      await shot(page, `${name}-${String(i+1).padStart(2,'0')}-${(st.label||'step').replace(/[^a-z0-9-]+/gi,'_')}`);
      s = ns;
      if (s.text && /(^|\s)(retir(o|aste|aste)?|fin de (la )?carrera|campe[oó]n mundial|fin de tu carrera|career summary|resumen de carrera|logros finales)/i.test(s.text)) {
        log.push({ step: 'finish-detected', text: s.text.slice(0, 300) });
        if (st.stopOnFinish !== false) break;
      }
    } catch (e) {
      log.push({ step: i + 1, error: e.message });
      break;
    }
  }

  const finalText = await page.evaluate(() => document.body.innerText.slice(0, 6000));
  writeFileSync(join(OUT_RUNS, `${name}.json`), JSON.stringify({ name, log, finalText }, null, 2));
  await browser.close();
  return log;
}

async function main() {
  // Run A: Argentina → CALVO → 10 → Derecha → Continuar → cualquier decisión automática
  await runOne('D-AR-full-flow', [
    { action: 'clickText', target: 'Normal', label: 'mode-normal' },
    { action: 'clickText', target: 'Comenzar carrera', label: 'start' },
    { action: 'clickText', target: 'Argentina', label: 'country-ar' },
    { action: 'clickText', target: 'Continuar', label: 'continue-country' },
    { action: 'wait', ms: 1200, label: 'wait-identity' },
    { action: 'fillPlaceholder', value: 'CALVO', placeholder: 'Apellido', label: 'fill-apellido' },
    { action: 'clickText', target: 'Derecha', label: 'foot-right' },
    { action: 'clickText', target: 'Continuar', label: 'continue-identity' },
    { action: 'wait', ms: 1500, label: 'wait-dashboard' },
    // tomar decisiones automáticamente: primer botón visible (que no sea cookie/legal)
    { action: 'clickAny', label: 'auto-decision-1' },
    { action: 'wait', ms: 1500, label: 'wait-after-auto-1' },
    { action: 'clickAny', label: 'auto-decision-2' },
    { action: 'wait', ms: 1500, label: 'wait-after-auto-2' },
    { action: 'clickAny', label: 'auto-decision-3' },
    { action: 'wait', ms: 1500, label: 'wait-after-auto-3' },
  ], 80);

  // Run E: same but Intensa
  await runOne('E-ES-Intensa-full', [
    { action: 'clickText', target: 'Intensa', label: 'mode-intensa' },
    { action: 'clickText', target: 'Comenzar carrera', label: 'start' },
    { action: 'clickText', target: 'España', label: 'country-es' },
    { action: 'clickText', target: 'Continuar', label: 'continue-country' },
    { action: 'wait', ms: 1200, label: 'wait-identity' },
    { action: 'fillPlaceholder', value: 'LAMINE', placeholder: 'Apellido', label: 'fill-apellido' },
    { action: 'clickText', target: 'Izquierda', label: 'foot-left' },
    { action: 'clickText', target: 'Continuar', label: 'continue-identity' },
    { action: 'wait', ms: 1500, label: 'wait-dashboard' },
    { action: 'clickAny', label: 'auto-decision-1' },
    { action: 'wait', ms: 1500, label: 'wait-after-auto-1' },
    { action: 'clickAny', label: 'auto-decision-2' },
    { action: 'wait', ms: 1500, label: 'wait-after-auto-2' },
  ], 80);

  // Run F: Exprés — más rápido
  await runOne('F-BR-Expres-full', [
    { action: 'clickText', target: 'Exprés', label: 'mode-expres' },
    { action: 'clickText', target: 'Comenzar carrera', label: 'start' },
    { action: 'clickText', target: 'Brasil', label: 'country-br' },
    { action: 'clickText', target: 'Continuar', label: 'continue-country' },
    { action: 'wait', ms: 1200, label: 'wait-identity' },
    { action: 'fillPlaceholder', value: 'NEYMAR', placeholder: 'Apellido', label: 'fill-apellido' },
    { action: 'clickText', target: 'Derecha', label: 'foot-right' },
    { action: 'clickText', target: 'Continuar', label: 'continue-identity' },
    { action: 'wait', ms: 1500, label: 'wait-dashboard' },
    { action: 'clickAny', label: 'auto-decision-1' },
    { action: 'wait', ms: 1500, label: 'wait-after-auto-1' },
    { action: 'clickAny', label: 'auto-decision-2' },
    { action: 'wait', ms: 1500, label: 'wait-after-auto-2' },
  ], 80);

  writeFileSync(join(ROOT, 'design/simulador-carrera/_graph-full.json'), JSON.stringify({
    nodes: Object.values(graph.nodes),
    edges: graph.edges,
    assets: Array.from(graph.assets),
    textCorpusSample: graph.textCorpus.slice(0, 30),
  }, null, 2));

  console.log(`NODES=${Object.keys(graph.nodes).length} EDGES=${graph.edges.length} ASSETS=${graph.assets.size}`);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
