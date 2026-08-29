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

function pickStorage(): StorageLike {
  try {
    // require lazy para no romper vitest si AsyncStorage no resuelve.
    const mod = eval('require')('@react-native-async-storage/async-storage');
    const candidate: StorageLike | undefined = mod?.default ?? mod;
    if (candidate && typeof candidate.getItem === 'function') {
      return candidate;
    }
  } catch {
    // AsyncStorage no disponible: fallback memoria.
  }
  return {
    getItem: async (k) => (k in memoryStore ? memoryStore[k] : null),
    setItem: async (k, v) => {
      memoryStore[k] = v;
    },
    removeItem: async (k) => {
      delete memoryStore[k];
    },
  };
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