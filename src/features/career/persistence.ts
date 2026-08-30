/**
 * Persistencia de la partida (MGC-208 §5, MGC-282, MGC-363).
 *
 * Usa `@react-native-async-storage/async-storage`. Como el motor es puro
 * y se testea en Node (vitest), el módulo detecta la disponibilidad del
 * runtime: si AsyncStorage nativo no está (vitest / SSR / web sin
 * localStorage) cae a un fallback en memoria que mantiene la misma API.
 *
 * MGC-282 — Bug original: la función resolvía AsyncStorage con
 * `eval('require')(...)`. Hermes no compila JS en runtime, así que la
 * llamada tiraba excepción y el `catch` caía al fallback de memoria.
 *
 * MGC-270 → MGC-363 — Root cause ACTUAL en v3.x: el `default` export de
 * `@react-native-async-storage/async-storage@3` ya NO es el TurboModule
 * nativo. Es `getLegacyStorage()` (un shim web que envuelve
 * `window.localStorage`). En Android/iOS ese shim intenta acceder a
 * `localStorage`, que no existe, y `setItem` arroja "Cannot read property
 * 'localStorage' of undefined" apenas se invoca. El catch silencioso de
 * `persistSnapshot` (`saveCareerSave(...).catch(() => {})`) se traga la
 * excepción y queda la IMPRESIÓN de que el snapshot se guardó. Resultado
 * real: la sesión en memoria funcionaba; al matar la app todo se
 * evaporaba. `hydrated` se flippeaba OK y la home renderizaba vacía.
 *
 * Fix: usar el named export `createAsyncStorage(databaseName)`, que
 * retorna una instancia del TurboModule `RNCAsyncStorage` nativo. Si el
 * factory no existe (versión <3 / mock de vitest) o el probe falla,
 * caemos explícitamente al fallback de memoria. El probe ejecuta un
 * `setItem`/`getItem` real en una key dummy para confirmar que el bridge
 * responde antes de aceptar el backend. Logs `[persistence]` ahora
 * reportan `storage={native|memory}` para distinguir "save no se invocó"
 * de "save falló en la nativa".
 */

import { Platform } from 'react-native';
import type { CareerSaveState } from '@/types/career';
import { initialProfile } from './identity-state';

const STORAGE_KEY = 'copero:career:save:v1';
const STORAGE_DB = 'copero';
const PROBE_KEY = 'copero:career:probe:v1';

type StorageLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const memoryStore: Record<string, string> = {};

const memoryStorage: StorageLike = {
  getItem: async (k) => (k in memoryStore ? memoryStore[k] : null),
  setItem: async (k, v) => {
    memoryStore[k] = v;
  },
  removeItem: async (k) => {
    delete memoryStore[k];
  },
};

/**
 * Backend resuelto una sola vez (AsyncStorage nativo o memoria). Se elige
 * en el primer load: si el probe async contra la nativa falla, vuelve a
 * memoria y queda fijo para el resto de la sesión.
 */
let resolved: StorageLike | null = null;
let resolvedProbe: Promise<StorageLike> | null = null;

function logBackend(reason: string, backend: 'native' | 'memory'): void {
  // MGC-262 + MGC-363: loguear en consola para QA. Si aparece
  // recurrentemente en modo memory en device, el bridge nativo no está
  // disponible y el save nunca llega a disco — cruzarlo con logcat.
  // eslint-disable-next-line no-console
  console.log(`[persistence] storage=${backend} reason=${reason}`);
}

async function probeNative(factory: (dbName: string) => StorageLike): Promise<StorageLike | null> {
  // MGC-270 + MGC-363 — confirmamos que el TurboModule responde antes de
  // aceptar el backend. Si la nativa no está linkeada (autolinking
  // faltó durante `eas build --local` o Metro no siguió el require), el
  // factory retorna una instancia pero `setItem` arroja "Native module
  // is null" al primer uso. Probamos con un cycle set→get→remove. Sin
  // este check, el `resolved` quedaba en el shim web y setItem tiraba al
  // primer uso → AC7 fallaba en device aunque vitest verdes.
  try {
    const instance = factory(STORAGE_DB);
    if (!instance || typeof instance.setItem !== 'function') return null;
    await instance.setItem(PROBE_KEY, 'ok');
    const echo = await instance.getItem(PROBE_KEY);
    await instance.removeItem(PROBE_KEY);
    if (echo !== 'ok') return null;
    return instance;
  } catch {
    return null;
  }
}

async function pickStorage(): Promise<StorageLike> {
  if (resolved) return resolved;
  if (!resolvedProbe) {
    resolvedProbe = (async () => {
      // Web no tiene bridge nativo. Caer directo a memoria sin probe.
      if (Platform.OS === 'web') {
        logBackend('web-platform', 'memory');
        return memoryStorage;
      }
      try {
        // MGC-282 + MGC-363 — `require` estático analizable por Metro.
        // Hermes lo pre-resuelve en build time al module ID nativo; `eval`
        // no compila y por eso volvimos a `require(...)` sin eval. Si
        // Metro no resuelve (vitest sin mock), el catch cae a memoria y
        // los tests siguen verdes.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require('@react-native-async-storage/async-storage');
        const factory = mod?.createAsyncStorage;
        if (typeof factory !== 'function') {
          logBackend('no-createAsyncStorage-factory', 'memory');
          return memoryStorage;
        }
        const native = await probeNative(factory);
        if (native) {
          logBackend('probe-ok', 'native');
          return native;
        }
        logBackend('probe-failed', 'memory');
        return memoryStorage;
      } catch (e) {
        logBackend(
          `require-threw:${(e as Error)?.message?.slice(0, 40) ?? 'unknown'}`,
          'memory',
        );
        return memoryStorage;
      }
    })();
  }
  resolved = await resolvedProbe;
  return resolved;
}

/** Backend activo. `true` = AsyncStorage nativo (persiste a disco en device). */
export async function isPersistentStorage(): Promise<boolean> {
  const s = await pickStorage();
  return s !== memoryStorage;
}

/** Devuelve la partida guardada o `null` si no hay nada. */
export async function loadCareerSave(): Promise<CareerSaveState | null> {
  const storage = await pickStorage();
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
  const storage = await pickStorage();
  await storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** Borra la partida guardada. */
export async function clearCareerSave(): Promise<void> {
  const storage = await pickStorage();
  await storage.removeItem(STORAGE_KEY);
  delete memoryStore[STORAGE_KEY];
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
