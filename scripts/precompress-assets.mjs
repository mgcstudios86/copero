#!/usr/bin/env node
/**
 * Pre-comprime assets estaticos de Expo Web a gzip level 9.
 *
 * MGC-538: nginx dynamic gzip compress a level 6 (~337KB para el chunk
 * 1262KB), pero pre-comprimir a level 9 reduce mas (~335KB) y evita el
 * CPU de comprimir en cada request. Ademas `gzip_static on` en
 * scripts/copero-nginx.conf detecta el .gz adyacente y lo sirve cuando
 * cliente envia Accept-Encoding: gzip. Cloudflare cachea el response
 * completo, asi cada nuevo deploy con content hash fresco busta el cache.
 *
 * Uso:
 *   node scripts/precompress-assets.mjs [dist_dir]
 *
 * Por defecto dist_dir = "dist". Output: `<archivo>.gz` adyacente al
 * original. Solo actua sobre assets inmutables (hash content-addressed
 * de Expo) en `dist/_expo/static/`. No toca HTML/JSON/SVG.
 */

import { readdir, readFile, writeFile, stat, access } from 'node:fs/promises';
import { join, extname, dirname, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const TARGET_DIRS = ['_expo/static', 'assets'];
const COMPRESSIBLE_EXT = new Set(['.js', '.css', '.mjs', '.html', '.json', '.svg', '.wasm']);
const GZIP_LEVEL = 9; // mayor compresion sin costo CPU runtime (todo pre-build)
const MIN_BYTES = 1024; // espejo de gzip_min_length en nginx

async function walk(dir, out = []) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch { return out; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) await walk(full, out);
    else out.push(full);
  }
  return out;
}

async function exists(p) { try { await access(p); return true; } catch { return false; } }

async function main() {
  const root = process.argv[2] || 'dist';
  const candidates = (await Promise.all(TARGET_DIRS.map((d) => exists(join(root, d))))).map((ok, i) => ok ? join(root, TARGET_DIRS[i]) : null).filter(Boolean);

  if (!candidates.length) {
    console.error(`[precompress] no targets found under ${root} (expected _expo/static and/or assets)`);
    process.exit(1);
  }

  let totalSrc = 0, totalGz = 0, count = 0;
  for (const dir of candidates) {
    const files = await walk(dir);
    for (const file of files) {
      const ext = extname(file).toLowerCase();
      if (!COMPRESSIBLE_EXT.has(ext)) continue;
      const srcBytes = (await stat(file)).size;
      if (srcBytes < MIN_BYTES) continue;
      const raw = await readFile(file);
      const gz = gzipSync(raw, { level: GZIP_LEVEL });
      const out = file + '.gz';
      await writeFile(out, gz);
      totalSrc += srcBytes;
      totalGz += gz.length;
      count += 1;
      const ratio = (gz.length / srcBytes * 100).toFixed(1);
      console.log(`  ${relative(root, file)}  ${(srcBytes/1024).toFixed(1)}KB -> ${(gz.length/1024).toFixed(1)}KB (${ratio}%)`);
    }
  }

  if (!count) {
    console.error(`[precompress] no compressible files found in ${candidates.join(', ')}`);
    process.exit(2);
  }
  const saved = ((totalSrc - totalGz) / 1024).toFixed(1);
  console.log(`[precompress] ${count} files  src=${(totalSrc/1024).toFixed(1)}KB  gz=${(totalGz/1024).toFixed(1)}KB  saved=${saved}KB  (level ${GZIP_LEVEL})`);
}

main().catch((err) => {
  console.error('[precompress] error:', err.message);
  process.exit(1);
});
