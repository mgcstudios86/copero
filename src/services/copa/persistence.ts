/**
 * Persistencia AsyncStorage para el Modo Copero (MGC-497).
 *
 * Key estable: `copero.copa.v1`. Versión va embebida en el payload
 * (`CopaBracketSerialized.v`) para futuras migraciones silenciosas.
 *
 * Patrón tomado de `src/features/career/persistence.ts`: cuando
 * AsyncStorage no está disponible (vitest, SSR, build web), caemos a
 * un fallback en memoria que mantiene la misma API.
 *
 * Logs `[copa] save=ok|fail` y `[copa] hydrate=ok|null` visibles en
 * cualquier bundle nativo (MGC-421 AC4). Silenciados en vitest.
 */

import type { CopaBracket } from './CopaBracket';
import { serialize as serializeBracket } from './CopaBracket';

export const COPA_STORAGE_KEY = 'copero.copa.v1';

export type StoredCopaState = {
  /** Versión del payload. Por ahora siempre 1. */
  v: 1;
  bracket: ReturnType<typeof serializeBracketToState>['bracket'];
  /** Timestamp de persistencia (epoch ms). */
  savedAt: number;
};

function serializeBracketToState(bracket: CopaBracket) {
  return { bracket: JSON.parse(serializeBracket(bracket)) };
}

export type CopaSaveResult =
  | { ok: true }
  | { ok: false; reason: 'serialization' | 'storage' };

export type CopaLoadResult =
  | { ok: true; state: StoredCopaState }
  | { ok: false; reason: 'empty' | 'parse' | 'version' };

export interface CopaStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** Fallback en memoria (vitest, SSR, web build sin NativeModule). */
function memoryAdapter(): CopaStorageAdapter {
  const store = new Map<string, string>();
  return {
    async getItem(key) {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    async setItem(key, value) {
      store.set(key, value);
    },
    async removeItem(key) {
      store.delete(key);
    },
  };
}

/** Resuelve el adapter disponible. AsyncStorage nativo si existe, memoria si no. */
async function resolveAdapter(): Promise<{
  adapter: CopaStorageAdapter;
  isFallback: boolean;
}> {
  try {
    // Static import: build-time resolution (no eval). MGC-282 lesson.
    // AsyncStorage expone tipos vía `@react-native-async-storage/async-storage`,
    // pero en algunos runtimes de testing el paquete no resuelve → fallback.
    const mod = await import(
      '@react-native-async-storage/async-storage' as string
    );
    const AsyncStorage = mod?.default ?? mod;
    if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
      return { adapter: AsyncStorage as CopaStorageAdapter, isFallback: false };
    }
  } catch {
    // Fall through to in-memory.
  }
  return { adapter: memoryAdapter(), isFallback: true };
}

let cachedAdapter: CopaStorageAdapter | null = null;
let cachedIsFallback = false;

async function getAdapter(): Promise<CopaStorageAdapter> {
  if (cachedAdapter) return cachedAdapter;
  const { adapter, isFallback } = await resolveAdapter();
  cachedAdapter = adapter;
  cachedIsFallback = isFallback;
  return adapter;
}

function isTestEnv(): boolean {
  return (
    typeof process !== 'undefined' &&
    process.env?.NODE_ENV === 'test' &&
    typeof process.env?.VITEST === 'string'
  );
}

function log(line: string): void {
  if (isTestEnv()) return;
  // eslint-disable-next-line no-console
  console.log(`[copa] ${line}`);
}

export async function saveCopaState(bracket: CopaBracket): Promise<CopaSaveResult> {
  let serializedBracket: string;
  try {
    serializedBracket = serializeBracket(bracket);
  } catch (err) {
    log(`save=fail reason=serialization err=${(err as Error).message}`);
    return { ok: false, reason: 'serialization' };
  }

  const state: StoredCopaState = {
    v: 1,
    bracket: JSON.parse(serializedBracket),
    savedAt: Date.now(),
  };

  try {
    const adapter = await getAdapter();
    await adapter.setItem(COPA_STORAGE_KEY, JSON.stringify(state));
    log(`save=ok bracketSize=${bracket.size} fallback=${bracket.usedFallback}`);
    return { ok: true };
  } catch (err) {
    log(`save=fail reason=storage err=${(err as Error).message}`);
    return { ok: false, reason: 'storage' };
  }
}

export async function loadCopaState(): Promise<CopaLoadResult> {
  let raw: string | null;
  try {
    const adapter = await getAdapter();
    raw = await adapter.getItem(COPA_STORAGE_KEY);
  } catch (err) {
    log(`hydrate=fail reason=storage err=${(err as Error).message}`);
    return { ok: false, reason: 'parse' };
  }

  if (raw === null) {
    log('hydrate=null key=missing');
    return { ok: false, reason: 'empty' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    log(`hydrate=fail reason=parse err=${(err as Error).message}`);
    return { ok: false, reason: 'parse' };
  }

  if (!isStoredCopaState(parsed)) {
    log('hydrate=fail reason=shape');
    return { ok: false, reason: 'parse' };
  }

  if (parsed.v !== 1) {
    log(`hydrate=fail reason=version v=${parsed.v}`);
    return { ok: false, reason: 'version' };
  }

  log(`hydrate=ok size=${parsed.bracket.size}`);
  return { ok: true, state: parsed };
}

export async function clearCopaState(): Promise<void> {
  const adapter = await getAdapter();
  await adapter.removeItem(COPA_STORAGE_KEY);
  log('clear=ok');
}

/** Test helper: resetea el adapter cacheado (vitest). */
export function __resetCopaStorageForTests(): void {
  cachedAdapter = null;
  cachedIsFallback = false;
}

function isStoredCopaState(value: unknown): value is StoredCopaState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.v !== 1) return false;
  if (typeof v.savedAt !== 'number') return false;
  if (typeof v.bracket !== 'object' || v.bracket === null) return false;
  return true;
}

export const __testing = { memoryAdapter, isStoredCopaState };
