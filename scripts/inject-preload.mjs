#!/usr/bin/env node
// MGC-483: inyecta <link rel="preload" as="script"> para los chunks lazy de Metro
// en dist/index.html. Reduce LCP al browser aligerar el fetch de RecommendedStrategy,
// JerseyPreview y route chunks no-entry en el parse idle.
//
// Metro emite bundles CommonJS (no ESM), por eso usamos `preload as=script` y NO
// `modulepreload` (que es para output ES modules con import estatico).
//
// Uso: node scripts/inject-preload.mjs <dist-dir>
// Por defecto <dist-dir> = ./dist

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const distDir = resolve(process.argv[2] ?? './dist');
const jsDir = join(distDir, '_expo', 'static', 'js', 'web');
const htmlPath = join(distDir, 'index.html');

const files = await readdir(jsDir);
const chunks = files.filter((f) => f.endsWith('.js'));

if (chunks.length === 0) {
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

const preloadTags = chunks
  .filter((f) => f !== entryFilename)
  .map(
    (f) =>
      `<link rel="preload" as="script" href="/_expo/static/js/web/${f}" crossorigin>`,
  )
  .join('');

if (!preloadTags) {
  console.log('[inject-preload] nothing to inject (only entry chunk present)');
  process.exit(0);
}

// Idempotencia: si ya inyectamos antes, limpiar.
html = html.replace(/<link rel="preload" as="script" href="\/[^"]+" crossorigin>/g, '');

const injected = html.replace(
  scriptRe,
  `${preloadTags}\n  ${scriptMatch[0]}`,
);

await writeFile(htmlPath, injected, 'utf8');

console.log(
  `[inject-preload] injected ${chunks.length - 1} preload tags (entry=${entryHref})`,
);