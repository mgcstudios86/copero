#!/usr/bin/env node
// scripts/inject-preload.mjs — Copero (MGC-483 + MGC-544 code-split)
//
// Inyecta <link rel="preload" as="script"> para los chunks lazy de Metro
// en dist/index.html. Reduce LCP al browser aligerar el fetch de
// RecommendedStrategy, JerseyPreview y route chunks no-entry en el parse
// idle.
//
// Metro emite bundles CommonJS (no ESM), por eso usamos `preload as=script`
// y NO `modulepreload` (que es para output ES modules con import estatico).
//
// MGC-544: con `serializerOptions.splitChunks: true` activo, Metro parte el
// bundle en chunks async por cada `import()` dinámico. El entry chunk queda
// en ~600 KB uncompressed y el resto se descarga on-demand. Para evitar
// penalizar el LCP por pre-cargar chunks pesados que el usuario quizá no
// visite en la primera interacción, esta versión del script SOLO pre-carga:
//   - Entry chunk (siempre, ya viene con <script defer>).
//   - Chunks de route críticos para el primer paint (si los marca metro).
//   - Chunks lazy <= 8 KB uncompressed (helpers, polyfills, shims).
// Los chunks > 8 KB (route chunks de /dashboard, /academy, engine) NO se
// pre-cargan; el navegador los pide on-demand al navegar a la ruta.
//
// Uso: node scripts/inject-preload.mjs <dist-dir>
// Por defecto <dist-dir> = ./dist

import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const distDir = resolve(process.argv[2] ?? './dist');
const jsDir = join(distDir, '_expo', 'static', 'js', 'web');
const htmlPath = join(distDir, 'index.html');

// Umbral derivado del bundle secundario `index-950205d6` (206 KB uncompressed
// / 47 KB gz). Cualquier chunk por encima de este tamaño se considera
// "route" y se carga on-demand, no al inicio. Tunear aquí si LH muestra que
// el LCP requiere más pre-loading.
const PRELOAD_MAX_BYTES = 8 * 1024;

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
const entryHref = scriptMatch[1];
const entryFilename = scriptMatch[2];

// Filtrar chunks candidatos a preload: solo los <= PRELOAD_MAX_BYTES uncompressed.
// Excluir el entry (ya viene con <script defer>).
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

const preloadTags = preloadFiles
  .map(
    (f) =>
      `<link rel="preload" as="script" href="/_expo/static/js/web/${f}" crossorigin>`,
  )
  .join('');

if (preloadTags) {
  // Idempotencia: si ya inyectamos antes, limpiar.
  html = html.replace(/<link rel="preload" as="script" href="\/[^"]+" crossorigin>/g, '');

  html = html.replace(scriptRe, `${preloadTags}\n  ${scriptMatch[0]}`);
  await writeFile(htmlPath, html, 'utf8');
}

console.log(
  `[inject-preload] entry=${entryHref} preloaded=${preloadFiles.length} skipped=${skippedFiles.length} (threshold=${PRELOAD_MAX_BYTES}B)`,
);
if (skippedFiles.length > 0) {
  console.log(
    `[inject-preload] on-demand chunks: ${skippedFiles.join(', ')}`,
  );
}
