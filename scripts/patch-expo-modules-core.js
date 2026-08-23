#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Patch SDK 57 expo-modules-core 57.0.12 worklets executeSync bug.
 *
 * expo-modules-core 57.0.12 source calls `workletRuntime->executeSync(...)` in two
 * files (Android + iOS), but no released version of react-native-worklets exposes
 * `executeSync` — the API was renamed to `runSync` in worklets 0.10+. The result
 * is a hard compile-time error in expo-modules-core's own C++/Obj-C++ regardless
 * of which worklets version we install.
 *
 * SDK 57 bug interno (expo-modules-core 57.0.12). Hasta que upstream publique
 * una versión con peer dep + API consistente, aplicamos este patch idempotente
 * en postinstall.
 *
 * Ver: MGC-366, MGC-338.
 */

const fs = require('fs');
const path = require('path');

const PATCHES = [
  {
    file: 'node_modules/expo-modules-core/android/src/main/cpp/worklets/WorkletJSCallInvoker.cpp',
    from: /workletRuntime->executeSync\(/g,
    to: 'workletRuntime->runSync(',
  },
  {
    file: 'node_modules/expo-modules-core/ios/WorkletsAdapter/ExpoWorkletsBridgeProvider.mm',
    from: /workletRuntime->executeSync\(/g,
    to: 'workletRuntime->runSync(',
  },
];

let patched = 0;
let skipped = 0;
let failed = 0;

for (const { file, from, to } of PATCHES) {
  const abs = path.resolve(process.cwd(), file);
  if (!fs.existsSync(abs)) {
    console.warn(`[patch-expo-modules-core] skip: ${file} (no existe)`);
    skipped++;
    continue;
  }
  const original = fs.readFileSync(abs, 'utf8');
  if (!from.test(original)) {
    // Ya parchado (idempotente) o API cambió upstream.
    console.log(`[patch-expo-modules-core] no-op: ${file}`);
    skipped++;
    continue;
  }
  const updated = original.replace(from, to);
  try {
    fs.writeFileSync(abs, updated, 'utf8');
    console.log(`[patch-expo-modules-core] patched: ${file}`);
    patched++;
  } catch (err) {
    console.error(`[patch-expo-modules-core] FAIL: ${file} — ${err.message}`);
    failed++;
  }
}

console.log(`[patch-expo-modules-core] done: ${patched} patched, ${skipped} skipped, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
