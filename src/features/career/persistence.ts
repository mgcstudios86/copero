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

import type { CareerSaveState } from '@/types/career';
import { initialProfile } from './identity-state';

const STORAGE_KEY = 'copero:career:save:v1';

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
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CareerSaveState;
    if (parsed && parsed.v === 1) return parsed;
    return null;
  } catch {
    return null;
  }
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