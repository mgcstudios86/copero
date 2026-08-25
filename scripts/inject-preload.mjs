#!/usr/bin/env node
// scripts/inject-preload.mjs — Copero (MGC-483 + MGC-544 code-split + MGC-743 fonts)
//
// Inyecta preloads en dist/index.html:
//   1. <link rel="preload" as="script"> para chunks lazy de Metro <= 8 KB
//      (helpers, polyfills, shims). Chunks de route pesados (> 8 KB) se
//      cargan on-demand al navegar. MGC-544 introdujo este threshold.
//   2. MGC-743 — <link rel="preload" as="font" type="font/woff2" crossorigin>
//      para los pesos críticos del first paint:
//        - Inter-Regular.woff2 (body tokens.ts → body text)
//        - Poppins-Bold.woff2 (display tokens.ts → H1 hero Poppins 700)
//      Los otros 6 pesos (Medium/SemiBold de ambas familias) NO se pre-cargan
//      en este round porque sólo aparecen en interacciones post-paint. El
//      browser los pide on-demand al primer uso del selector CSS que los
//      refiera; el `font-display: swap` del layout (app/_layout.web.tsx)
//      evita FOIT en cualquier caso.
//
// Metro copia los assets referenciados vía `require()` a dist/assets/ con
// un hash de cache busting en el nombre (`Inter-Regular-<hash>.woff2`).
// Como el woff2 vive físicamente en `assets/fonts/woff2/`, el URL final
// termina siendo `dist/assets/assets/fonts/woff2/<name>-<hash>.woff2`.
// Caminamos el árbol recursivamente sin asumir profundidad.
//
// Uso: node scripts/inject-preload.mjs <dist-dir>
// Por defecto <dist-dir> = ./dist

import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const distDir = resolve(process.argv[2] ?? './dist');
const jsDir = join(distDir, '_expo', 'static', 'js', 'web');
const assetsDir = join(distDir, 'assets');
const htmlPath = join(distDir, 'index.html');

const PRELOAD_MAX_BYTES = 8 * 1024;

// Pesos críticos para el FCP/LCP de /. La familia coincide con la convención
// tokens.ts: body (Regular 400) y display (Bold 700). Si en el futuro el primer
// render depende de otro peso, agregalo acá y mantén en sync con
// app/_layout.web.tsx.
const CRITICAL_FONTS = ['Inter-Regular', 'Poppins-Bold'];

const files = await readdir(jsDir);
const jsFiles = files.filter((f) => f.endsWith('.js'));

if (jsFiles.length === 0) {
  console.error(`[inject-preload] no chunks found in ${jsDir}`);
  process.exit(1);
}

let html = await readFile(htmlPath, 'utf8');

// Detectar el script entry tag para excluirlo del preload (ya tiene <script defer>).
const scriptRe = /<script\s+src="(\/_expo\/static\/js\/web\/([^"']+))"\s+defer><\/script>/;
const scriptMatch = html.match(scriptRe);
if (!scriptMatch) {
  console.error('[inject-preload] entry <script> tag not found in index.html');
  process.exit(1);
}
const entryFilename = scriptMatch[2];

const candidates = await Promise.all(
  jsFiles
    .filter((f) => f !== entryFilename)
    .map(async (f) => {
      const s = await stat(join(jsDir, f));
      return { file: f, size: s.size };
    }),
);

const preloadFiles = candidates
  .filter((c) => c.size <= PRELOAD_MAX_BYTES)
  .map((c) => c.file);

const skippedFiles = candidates
  .filter((c) => c.size > PRELOAD_MAX_BYTES)
  .map((c) => `${c.file} (${(c.size / 1024).toFixed(1)} KB)`);

// MGC-743 — localizar woff2 críticos en dist/assets/.
async function findWoff2(rootDir) {
  const out = [];
  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.isFile() && e.name.endsWith('.woff2')) {
        out.push({ full, rel: full.slice(distDir.length + 1) });
      }
    }
  }
  await walk(rootDir);
  return out;
}

const woff2Files = await findWoff2(assetsDir);
const woff2ByBase = new Map();
for (const { rel } of woff2Files) {
  const basename = rel.split('/').pop();
  // Metro produce `Inter-Regular.<32-hex>.woff2` (separador `.`, no `-`).
  const base = basename.replace(/(\.[0-9a-f]{16,})?\.woff2$/, '');
  if (base) woff2ByBase.set(base, rel);
}

const criticalFontTags = CRITICAL_FONTS.map((base) => {
  const rel = woff2ByBase.get(base);
  if (!rel) {
    console.warn(`[inject-preload] critical font not found in dist/assets: ${base}.woff2`);
    return '';
  }
  const url = '/' + rel.split('\\').join('/');
  return `<link rel="preload" as="font" type="font/woff2" href="${url}" crossorigin>`;
}).filter(Boolean);

// Idempotencia: limpiar preloads previos (script + font) antes de re-inyectar.
html = html.replace(/<link rel="preload" as="script" href="\/[^"]+" crossorigin>/g, '');
html = html.replace(/<link rel="preload" as="font" type="font\/woff2" href="\/[^"]+" crossorigin>/g, '');

const scriptPreloadTags = preloadFiles
  .map((f) => `<link rel="preload" as="script" href="/_expo/static/js/web/${f}" crossorigin>`)
  .join('');

const allPreloadTags = [...criticalFontTags, ...(scriptPreloadTags ? [scriptPreloadTags] : [])]
  .filter(Boolean)
  .join('\n  ');

if (allPreloadTags) {
  html = html.replace(scriptRe, `${allPreloadTags}\n  ${scriptMatch[0]}`);
  await writeFile(htmlPath, html, 'utf8');
}

const foundCriticalFonts = CRITICAL_FONTS.filter((b) => woff2ByBase.has(b));
console.log(
  `[inject-preload] entry=${scriptMatch[1]} preloaded-js=${preloadFiles.length} preloaded-fonts=${foundCriticalFonts.length}/${CRITICAL_FONTS.length} (${foundCriticalFonts.join(', ')}) skipped-js=${skippedFiles.length} (threshold=${PRELOAD_MAX_BYTES}B)`,
);
if (skippedFiles.length > 0) {
  console.log(`[inject-preload] on-demand chunks: ${skippedFiles.join(', ')}`);
}
if (foundCriticalFonts.length < CRITICAL_FONTS.length) {
  const missing = CRITICAL_FONTS.filter((b) => !woff2ByBase.has(b));
  console.warn(`[inject-preload] critical fonts missing: ${missing.join(', ')} (esperadas en dist/assets/ tras build:web)`);
}
