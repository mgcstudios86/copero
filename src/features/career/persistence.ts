/**
 * Persistencia de la partida (MGC-208 §5).
 *
 * Usa `@react-native-async-storage/async-storage`. Como el motor es puro
 * y se testea en Node (vitest), el módulo detecta la disponibilidad del
 * runtime: si AsyncStorage no está (por ejemplo en `vitest run` o en
 * SSR), cae a un fallback en memoria que mantiene la misma API.
 *
 * La forma del payload está versionada (`v: 1`) para futuras migraciones.
 */

import type { CareerSaveState, SeasonLog } from '@/types/career';
import { initialProfile } from './identity-state';

const STORAGE_KEY = 'copero:career:save:v1';
// MGC-227 migró la key `copero-career` (zustand persist middleware, formato
// `{ state, version }`) a `copero:career:save:v1` (formato versionado manual).
// Tests Playwright existentes (MGC-523/523/444) siguen sembrando
// `copero-career` desde addInitScript. Sin back-compat, esos seeds quedan
// huérfanos y el store arranca en initialSnapshot() con `stage: 'identity'`,
// rompiendo `home.spec.ts:92` (espera stage='dashboard' → /dashboard) y
// `simulador-carrera-evidence-mgc444.spec.ts:154` (lee `copero-career`
// directo). MGC-385: loadCareerSave intenta primero la key nueva, y si
// está vacía, lee la legacy + convierte al shape v1 + migra silenciosamente.
const LEGACY_STORAGE_KEYS = ['copero-career'] as const;

type StorageLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

let memoryStore: Record<string, string> = {};

const memoryStorage: StorageLike = {
  getItem: async (k) => (k in memoryStore ? memoryStore[k] : null),
  setItem: async (k, v) => {
    memoryStore[k] = v;
  },
  removeItem: async (k) => {
    delete memoryStore[k];
  },
};

/** Backend resuelto una sola vez (AsyncStorage real o memoria). */
let resolved: StorageLike | null = null;

/**
 * MGC-282 — root cause del bug "la partida no se restaura tras force-stop".
 *
 * Antes esta función resolvía AsyncStorage con `eval('require')(...)`. En
 * device eso NUNCA funciona:
 *  1. Hermes (motor por defecto de RN 0.86) no compila JS en runtime, así
 *     que `eval` tira excepción.
 *  2. Aun si `eval` estuviera habilitado, devuelve el `require` GLOBAL del
 *     bundle de Metro, que en release espera un id numérico de módulo — no
 *     un string.
 *
 * El `catch` se tragaba las dos fallas y devolvía el fallback en memoria.
 * Resultado: la partida se guardaba en un objeto del proceso, la sesión
 * en curso se veía bien, y al matar la app el snapshot desaparecía. Por eso
 * MGC-257/259/270/273/277 (todos fixes de timing del flush) no movieron la
 * aguja: el flush escribía correctamente… a memoria.
 *
 * `require` a secas es estático: Metro lo resuelve en build time y Hermes
 * nunca ve un `eval`. En node/vitest `require` no existe en el scope ESM y
 * el `ReferenceError` cae al mismo fallback de memoria de siempre, así que
 * los tests no cambian de comportamiento.
 */
function pickStorage(): StorageLike {
  if (resolved) return resolved;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-async-storage/async-storage');
    const candidate: StorageLike | undefined = mod?.default ?? mod;
    if (candidate && typeof candidate.getItem === 'function') {
      resolved = candidate;
      return candidate;
    }
  } catch {
    // AsyncStorage no disponible (node/vitest): fallback memoria.
  }
  resolved = memoryStorage;
  return memoryStorage;
}

/** Backend activo. `true` = AsyncStorage real (persiste a disco). */
export function isPersistentStorage(): boolean {
  return pickStorage() !== memoryStorage;
}

/** Devuelve la partida guardada o `null` si no hay nada. */
export async function loadCareerSave(): Promise<CareerSaveState | null> {
  const storage = pickStorage();
  const raw = await storage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as CareerSaveState;
      if (parsed && parsed.v === 1) return parsed;
    } catch {
      // cae a back-compat abajo.
    }
  }
  // MGC-385 back-compat: si la key nueva está vacía o corrupta, intenta la
  // legacy (`copero-career`, formato zustand persist `{ state, version }`).
  // Si la legacy tiene el shape esperado, la convertimos a v1 + migramos
  // silenciosamente a la key nueva para que el próximo load haga fast-path.
  for (const legacyKey of LEGACY_STORAGE_KEYS) {
    const legacyRaw = await storage.getItem(legacyKey);
    if (!legacyRaw) continue;
    try {
      const legacy = JSON.parse(legacyRaw) as { state?: unknown; version?: number };
      const inner = legacy?.state;
      if (!inner || typeof inner !== 'object') continue;
      const migrated = migrateLegacyToV1(inner as Record<string, unknown>);
      if (!migrated) continue;
      // Migración silenciosa: escribe nueva key, deja legacy por si otra
      // surface (e.g. devtools) la inspecciona. clearCareerSave() borra ambas.
      await storage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    } catch {
      // legacy corrupto, seguir al próximo candidato.
      continue;
    }
  }
  return null;
}

/**
 * MGC-385 — convierte el payload legacy de zustand persist
 * (`{ state: { stage, profile, draft, card, log, seed, ... }, version }`)
 * al shape versionado manual `v: 1`. Devuelve `null` si el payload no tiene
 * los campos mínimos (stage + profile) — en ese caso el caller lo trata
 * como "no hay partida guardada".
 */
export function migrateLegacyToV1(legacy: Record<string, unknown>): CareerSaveState | null {
  const stage = legacy.stage;
  const profile = legacy.profile;
  if (typeof stage !== 'string' || !profile || typeof profile !== 'object') {
    return null;
  }
  return {
    v: 1,
    stage: stage as CareerSaveState['stage'],
    profile: profile as CareerSaveState['profile'],
    draft: (legacy.draft as CareerSaveState['draft']) ?? null,
    card: (legacy.card as CareerSaveState['card']) ?? null,
    clubId: (legacy.clubId as CareerSaveState['clubId']) ?? null,
    log: normalizeLegacyLog(legacy.log),
    seed: typeof legacy.seed === 'number' ? legacy.seed : Math.floor(Math.random() * 1_000_000),
  };
}

/**
 * MGC-399 — normaliza el `log` legacy al shape `SeasonLog`
 * (`{ timeline, events }`). Payloads viejos lo guardaban como array plano
 * de temporadas; otros lo omitían. Devuelve siempre un `SeasonLog` válido.
 */
function normalizeLegacyLog(raw: unknown): SeasonLog {
  if (Array.isArray(raw)) {
    return { timeline: raw as SeasonLog['timeline'], events: [] };
  }
  if (!raw || typeof raw !== 'object') {
    return { timeline: [], events: [] };
  }
  const obj = raw as Partial<SeasonLog>;
  return {
    timeline: Array.isArray(obj.timeline) ? obj.timeline : [],
    events: Array.isArray(obj.events) ? obj.events : [],
  };
}

/** Guarda la partida. Idempotente. */
export async function saveCareerSave(state: CareerSaveState): Promise<void> {
  const storage = pickStorage();
  await storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** Borra la partida guardada. */
export async function clearCareerSave(): Promise<void> {
  const storage = pickStorage();
  await storage.removeItem(STORAGE_KEY);
  // MGC-385: borra también las keys legacy para no dejar basura en storage.
  for (const legacyKey of LEGACY_STORAGE_KEYS) {
    await storage.removeItem(legacyKey);
  }
  memoryStore = {};
}

/**
 * Snapshot mínimo para arrancar la persistencia desde un stage inicial.
 * El caller completa luego con draft/card/log según corresponda.
 */
export function blankCareerSave(): CareerSaveState {
  return {
    v: 1,
    stage: 'identity',
    profile: { ...initialProfile },
    draft: null,
    card: null,
    clubId: null,
    log: { timeline: [], events: [] },
    seed: 0,
  };
}