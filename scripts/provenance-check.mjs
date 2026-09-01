#!/usr/bin/env node
// provenance-check.mjs — gate de provenance del bundle Android (MGC-1206, origen MGC-957).
//
// Problema que resuelve: un APK etiquetado con un commit nuevo pero que embebe un
// index.android.bundle viejo (workspace reusado del runner self-hosted, cache de
// metro, artefacto residual en dist/). QA instala, no ve el fix, y el ticket rebota.
//
// El gate valida cuatro cosas y falla el job con mensaje explicito:
//   1. El artefacto (APK/AAB) se produjo EN ESTE run (mtime >= inicio del build).
//   2. El commit checkouteado == el commit fuente declarado por el job.
//   3. Los testIDs canonicos que ya existen en source estan dentro del bundle.
//      (si un testID esta en source y NO en el bundle => bundle stale).
//   4. Emite SHA256 del APK y del bundle a step summary + manifiesto JSON para QA.
//
// Variables de entorno:
//   PROVENANCE_ARTIFACT        path del APK/AAB (opcional; si falta, busca el mas reciente)
//   PROVENANCE_SEARCH_DIRS     dirs a buscar, separados por ':' (default '.:dist:android/app/build/outputs')
//   PROVENANCE_EXPECTED_COMMIT SHA fuente declarado por el job (default GITHUB_SHA)
//   PROVENANCE_BUILD_STARTED_AT epoch segundos del inicio del build (opcional pero recomendado)
//   PROVENANCE_OUT             path del manifiesto JSON (default provenance/provenance.json)
//   PROVENANCE_STRICT          '1' => exige TODOS los canonicalStrings aunque no esten en source
//   PROVENANCE_CONFIG          path del contrato (default .github/provenance-expected.json)
//
// Nota Hermes: en SDK 57 el bundle es bytecode HBC, no JS plano. Los literales string
// siguen presentes en la string table, por eso el match se hace sobre bytes crudos.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const REPO_ROOT = process.cwd();
const CONFIG_PATH = process.env.PROVENANCE_CONFIG || '.github/provenance-expected.json';
const OUT_PATH = process.env.PROVENANCE_OUT || 'provenance/provenance.json';
const STRICT = process.env.PROVENANCE_STRICT === '1';
const ARTIFACT_EXTS = ['.apk', '.aab'];

const failures = [];
const warnings = [];

function log(msg) {
  process.stdout.write(`[provenance] ${msg}\n`);
}

function fail(msg) {
  failures.push(msg);
  process.stdout.write(`[provenance] FAIL: ${msg}\n`);
}

function warn(msg) {
  warnings.push(msg);
  process.stdout.write(`[provenance] WARN: ${msg}\n`);
}

function readConfig() {
  const full = path.resolve(REPO_ROOT, CONFIG_PATH);
  if (!fs.existsSync(full)) {
    throw new Error(`contrato de provenance ausente: ${CONFIG_PATH}`);
  }
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// --- 1. localizar el artefacto -------------------------------------------------

function findArtifact() {
  const declared = process.env.PROVENANCE_ARTIFACT;
  if (declared) {
    const full = path.resolve(REPO_ROOT, declared);
    if (!fs.existsSync(full)) {
      throw new Error(`PROVENANCE_ARTIFACT declarado pero inexistente: ${declared}`);
    }
    return full;
  }
  const dirs = (process.env.PROVENANCE_SEARCH_DIRS || '.:dist:android/app/build/outputs')
    .split(':')
    .filter(Boolean);
  const found = [];
  for (const dir of dirs) {
    const base = path.resolve(REPO_ROOT, dir);
    if (!fs.existsSync(base)) continue;
    walk(base, 4, (file) => {
      if (ARTIFACT_EXTS.includes(path.extname(file).toLowerCase())) {
        found.push({ file, mtimeMs: fs.statSync(file).mtimeMs });
      }
    });
  }
  if (found.length === 0) {
    throw new Error(
      `no se encontro APK/AAB en [${dirs.join(', ')}]. ` +
        'Pasa PROVENANCE_ARTIFACT o usa `eas build --local --output <path>`.',
    );
  }
  found.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return found[0].file;
}

function walk(dir, depth, visit) {
  if (depth < 0) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, depth - 1, visit);
    else if (entry.isFile()) visit(full);
  }
}

// --- 2. extraer el bundle del APK/AAB ------------------------------------------
//
// Lector ZIP en Node puro: el runner copero-ci es un pool mixto (Linux VPS + macOS
// ARM64) y no queremos que el gate dependa de que `unzip` este instalado en ambos.
// Solo se parsea el central directory y se inflan las entradas que interesan.

const EOCD_SIG = 0x06054b50;
const CD_SIG = 0x02014b50;
const LFH_SIG = 0x04034b50;
const ZIP64_EOCD_LOCATOR_SIG = 0x07064b50;
const ZIP64_EOCD_SIG = 0x06064b50;

function findEocd(buf) {
  const maxComment = 0xffff;
  const start = Math.max(0, buf.length - (maxComment + 22));
  for (let i = buf.length - 22; i >= start; i -= 1) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i;
  }
  throw new Error('el artefacto no es un ZIP valido (no se encontro el End Of Central Directory).');
}

function centralDirectoryLocation(buf) {
  const eocd = findEocd(buf);
  let entryCount = buf.readUInt16LE(eocd + 10);
  let cdOffset = buf.readUInt32LE(eocd + 16);

  // ZIP64: los campos de 32 bits saturados apuntan al EOCD64.
  if (cdOffset === 0xffffffff || entryCount === 0xffff) {
    const locator = eocd - 20;
    if (locator < 0 || buf.readUInt32LE(locator) !== ZIP64_EOCD_LOCATOR_SIG) {
      throw new Error('ZIP64 esperado pero el locator del EOCD64 no esta presente.');
    }
    const eocd64 = Number(buf.readBigUInt64LE(locator + 8));
    if (buf.readUInt32LE(eocd64) !== ZIP64_EOCD_SIG) {
      throw new Error('ZIP64 EOCD invalido.');
    }
    entryCount = Number(buf.readBigUInt64LE(eocd64 + 32));
    cdOffset = Number(buf.readBigUInt64LE(eocd64 + 48));
  }
  return { entryCount, cdOffset };
}

function readZip64Extra(extra, needs) {
  // needs: array de flags en orden [uncompressed, compressed, localHeaderOffset].
  let cursor = 0;
  while (cursor + 4 <= extra.length) {
    const headerId = extra.readUInt16LE(cursor);
    const size = extra.readUInt16LE(cursor + 2);
    if (headerId === 0x0001) {
      const values = [];
      let p = cursor + 4;
      for (const needed of needs) {
        if (needed && p + 8 <= cursor + 4 + size) {
          values.push(Number(extra.readBigUInt64LE(p)));
          p += 8;
        } else {
          values.push(null);
        }
      }
      return values;
    }
    cursor += 4 + size;
  }
  return [null, null, null];
}

function listZipEntries(buf) {
  const { entryCount, cdOffset } = centralDirectoryLocation(buf);
  const entries = [];
  let cursor = cdOffset;
  for (let i = 0; i < entryCount; i += 1) {
    if (cursor + 46 > buf.length || buf.readUInt32LE(cursor) !== CD_SIG) break;
    const method = buf.readUInt16LE(cursor + 10);
    let compressedSize = buf.readUInt32LE(cursor + 20);
    let uncompressedSize = buf.readUInt32LE(cursor + 24);
    const nameLen = buf.readUInt16LE(cursor + 28);
    const extraLen = buf.readUInt16LE(cursor + 30);
    const commentLen = buf.readUInt16LE(cursor + 32);
    let localOffset = buf.readUInt32LE(cursor + 42);
    const name = buf.toString('utf8', cursor + 46, cursor + 46 + nameLen);
    if (
      uncompressedSize === 0xffffffff ||
      compressedSize === 0xffffffff ||
      localOffset === 0xffffffff
    ) {
      const extra = buf.subarray(cursor + 46 + nameLen, cursor + 46 + nameLen + extraLen);
      const [u, c, o] = readZip64Extra(extra, [
        uncompressedSize === 0xffffffff,
        compressedSize === 0xffffffff,
        localOffset === 0xffffffff,
      ]);
      if (u !== null) uncompressedSize = u;
      if (c !== null) compressedSize = c;
      if (o !== null) localOffset = o;
    }
    entries.push({ name, method, compressedSize, uncompressedSize, localOffset });
    cursor += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function readZipEntry(buf, entry) {
  const lfh = entry.localOffset;
  if (buf.readUInt32LE(lfh) !== LFH_SIG) {
    throw new Error(`local file header invalido para ${entry.name}`);
  }
  const nameLen = buf.readUInt16LE(lfh + 26);
  const extraLen = buf.readUInt16LE(lfh + 28);
  const dataStart = lfh + 30 + nameLen + extraLen;
  const raw = buf.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) return Buffer.from(raw);
  if (entry.method === 8) return zlib.inflateRawSync(raw);
  throw new Error(`metodo de compresion no soportado (${entry.method}) para ${entry.name}`);
}

function extractBundle(archiveBuf, candidateEntries) {
  const entries = listZipEntries(archiveBuf);
  const byName = new Map(entries.map((e) => [e.name, e]));
  const match =
    candidateEntries.map((c) => byName.get(c)).find(Boolean) ||
    entries.find((e) => e.name.endsWith('index.android.bundle'));
  if (!match) {
    throw new Error(
      `el artefacto no contiene index.android.bundle (entries: ${entries.length}). ` +
        'El APK no es un build RN valido.',
    );
  }
  return { entry: match.name, buf: readZipEntry(archiveBuf, match) };
}

function bundleFormat(buf) {
  // Hermes bytecode magic: c6 1f bc 03 c1 03 bc 1f (little endian).
  if (buf.length >= 8 && buf.readUInt32LE(0) === 0x03bc1fc6) return 'hermes-bytecode';
  return 'plain-js';
}

// --- 3. presencia de los testIDs canonicos -------------------------------------

function collectSourceFiles(config) {
  const files = [];
  for (const dir of config.sourceDirs || []) {
    const base = path.resolve(REPO_ROOT, dir);
    if (!fs.existsSync(base)) continue;
    walk(base, 12, (file) => {
      if ((config.sourceExtensions || []).includes(path.extname(file))) files.push(file);
    });
  }
  return files;
}

function stringInSource(sourceFiles, needle) {
  for (const file of sourceFiles) {
    if (fs.readFileSync(file, 'utf8').includes(needle)) return true;
  }
  return false;
}

// --- 4. commit declarado --------------------------------------------------------

function headCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

// --- main ----------------------------------------------------------------------

function main() {
  const config = readConfig();
  const expectedCommit = (process.env.PROVENANCE_EXPECTED_COMMIT || process.env.GITHUB_SHA || '').trim();
  const head = headCommit();

  if (!expectedCommit) {
    warn('sin PROVENANCE_EXPECTED_COMMIT ni GITHUB_SHA; se omite el check de commit fuente.');
  } else if (!head) {
    warn('no se pudo resolver git HEAD; se omite el check de commit fuente.');
  } else if (head !== expectedCommit) {
    fail(
      `commit fuente no coincide: el job declara ${expectedCommit.slice(0, 7)} ` +
        `pero el working tree esta en ${head.slice(0, 7)}. El artefacto no representa el commit del PR.`,
    );
  } else {
    log(`commit fuente OK: ${head.slice(0, 7)}`);
  }

  const artifact = findArtifact();
  const artifactStat = fs.statSync(artifact);
  const artifactBuf = fs.readFileSync(artifact);
  const artifactSha = sha256(artifactBuf);
  log(`artefacto: ${path.relative(REPO_ROOT, artifact)} (${artifactStat.size} bytes)`);
  log(`sha256 apk: ${artifactSha}`);

  const startedAt = Number(process.env.PROVENANCE_BUILD_STARTED_AT || 0);
  if (startedAt > 0) {
    const artifactEpoch = Math.floor(artifactStat.mtimeMs / 1000);
    if (artifactEpoch < startedAt) {
      fail(
        `artefacto STALE: mtime ${new Date(artifactStat.mtimeMs).toISOString()} es anterior al ` +
          `inicio del build ${new Date(startedAt * 1000).toISOString()}. ` +
          'Es un residuo del workspace del runner self-hosted, no el build de este run.',
      );
    } else {
      log(`frescura OK: artefacto producido en este run (${artifactEpoch - startedAt}s despues del inicio).`);
    }
  } else {
    warn('sin PROVENANCE_BUILD_STARTED_AT; no se puede verificar frescura del artefacto.');
  }

  const { entry, buf: bundleBuf } = extractBundle(artifactBuf, config.bundleEntries || []);
  const bundleSha = sha256(bundleBuf);
  const format = bundleFormat(bundleBuf);
  log(`bundle: ${entry} (${bundleBuf.length} bytes, ${format})`);
  log(`sha256 bundle: ${bundleSha}`);

  const sourceFiles = collectSourceFiles(config);
  const canonical = (config.canonicalStrings || []).map((value) => {
    const inSource = stringInSource(sourceFiles, value);
    const inBundle = bundleBuf.includes(Buffer.from(value, 'utf8'));
    let status;
    if (inBundle) {
      status = 'ok';
    } else if (inSource || STRICT) {
      status = 'fail';
      fail(
        inSource
          ? `bundle STALE: el testID "${value}" existe en source pero NO en index.android.bundle. ` +
              'El JS embebido en el APK es anterior al commit del PR.'
          : `PROVENANCE_STRICT: el testID canonico "${value}" no esta en el bundle ni en source.`,
      );
    } else {
      status = 'pending';
      warn(`testID canonico "${value}" todavia no existe en source; se difiere el assert (no bloquea).`);
    }
    return { value, inSource, inBundle, status };
  });

  const result = {
    schema: 'mgc.provenance/v1',
    result: failures.length === 0 ? 'pass' : 'fail',
    commit: {
      expected: expectedCommit || null,
      head,
      short: (head || expectedCommit || '').slice(0, 7) || null,
    },
    artifact: {
      path: path.relative(REPO_ROOT, artifact),
      sha256: artifactSha,
      size: artifactStat.size,
      mtime: new Date(artifactStat.mtimeMs).toISOString(),
    },
    bundle: {
      entry,
      sha256: bundleSha,
      size: bundleBuf.length,
      format,
    },
    canonicalStrings: canonical,
    strict: STRICT,
    failures,
    warnings,
    ci: {
      runId: process.env.GITHUB_RUN_ID || null,
      workflow: process.env.GITHUB_WORKFLOW || null,
      ref: process.env.GITHUB_REF || null,
    },
  };

  const outFull = path.resolve(REPO_ROOT, OUT_PATH);
  fs.mkdirSync(path.dirname(outFull), { recursive: true });
  fs.writeFileSync(outFull, `${JSON.stringify(result, null, 2)}\n`);
  log(`manifiesto escrito en ${OUT_PATH}`);

  writeSummary(result);

  if (failures.length > 0) {
    process.stdout.write(
      `\n[provenance] GATE ROJO — ${failures.length} assert(s) fallaron:\n` +
        failures.map((f) => `  - ${f}\n`).join('') +
        '\nAccion: rebuildear desde limpio (borrar dist/ y el APK residual) y verificar que\n' +
        'metro no este sirviendo un bundle cacheado. Detalle: ' + OUT_PATH + '\n',
    );
    process.exit(1);
  }
  log('GATE VERDE — provenance del bundle verificada.');
}

function writeSummary(result) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  const icon = result.result === 'pass' ? 'PASS' : 'FAIL';
  const lines = [
    `## Provenance gate (Android) — ${icon}`,
    '',
    `- commit: \`${result.commit.short || 'n/a'}\``,
    `- artefacto: \`${result.artifact.path}\` (${result.artifact.size} bytes)`,
    `- sha256 apk: \`${result.artifact.sha256}\``,
    `- bundle: \`${result.bundle.entry}\` (${result.bundle.size} bytes, ${result.bundle.format})`,
    `- sha256 bundle: \`${result.bundle.sha256}\``,
    '',
    '| testID canonico | en source | en bundle | estado |',
    '| --- | --- | --- | --- |',
    ...result.canonicalStrings.map(
      (c) => `| \`${c.value}\` | ${c.inSource ? 'si' : 'no'} | ${c.inBundle ? 'si' : 'no'} | ${c.status} |`,
    ),
  ];
  if (result.warnings.length > 0) {
    lines.push('', '### Warnings', ...result.warnings.map((w) => `- ${w}`));
  }
  if (result.failures.length > 0) {
    lines.push('', '### Fallas', ...result.failures.map((f) => `- ${f}`));
  }
  lines.push('', `Manifiesto para QA: artifact \`provenance-android\` (${OUT_PATH}).`);
  fs.appendFileSync(summaryPath, `${lines.join('\n')}\n`);
}

try {
  main();
} catch (err) {
  process.stderr.write(`[provenance] ERROR: ${err.message}\n`);
  process.exit(1);
}
