/**
 * Persistencia de la partida (MGC-208 §5).
 *
 * Usa `@react-native-async-storage/async-storage`. Como el motor es puro
 * y se testea en Node (vitest), el módulo detecta la disponibilidad del
 * runtime: si AsyncStorage no está (por ejemplo en `vitest run` o en
 * SSR), cae a un fallback en memoria que mantiene la misma API.
 *
 * MGC-282: `eval('require')` rompía la persistencia en device — antes
 * la root cause. Ahora `require` estático resuelve en build time.
 *
 * MGC-385: back-compat con la key legacy `copero-career` (zustand persist
 * middleware, formato `{ state, version }`) — la legacy se migra
 * silenciosamente al shape v1 al primer `loadCareerSave` no-vacío.
 *
 * MGC-421 AC4: logs `[persistence] save=ok|fail` y
 * `[persistence] hydrate=ok|null` visibles en cualquier bundle Hermes
 * nativo (dev/preview/production). Antes gated por `__DEV__` — el
 * reviewer no veía nada en logcat de preview/profile. Silenciados en
 * vitest (NODE_ENV=test) para no contaminar la salida de los tests.
 *
 * La forma del payload está versionada (`v: 1`) para futuras migraciones.
 */

import type { CareerSaveState, SeasonLog } from '@/types/career';
import { createRngSnapshot } from './rng';
import { initialProfile } from './identity-state';
import { STAT_INIT } from './position-stats';

const STORAGE_KEY = 'copero:career:save:v1';
// MGC-1657 (F2.3) — la persistencia ahora escribe v:2. Mantenemos la
// key estable; el discriminador es el campo `v` del payload (v:1 legacy
// sigue funcionando gracias al back-compat `migrateV1ToV2` que se
// ejecuta en cada load). El cambio de key implicaría invalidar todas
// las partidas guardadas en device — no lo hacemos porque QA valida
// continuidad de save entre runs (AC4).
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

/**
 * `resolved` cachea el backend una vez resuelto. Tests lo invalidan con
 * `__resetStorageForTests()` para simular la caída al shim memoria.
 */
let resolved: StorageLike | null = null;

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

/**
 * MGC-421 AC7 — hook de test: fuerza la re-resolución del backend
 * de storage. Sin esto, una vez que `pickStorage()` cachea el resultado
 * en el closure del módulo, los tests no pueden simular la caída al
 * fallback en memoria. Marcado con prefijo `__` para señalar uso
 * interno (no se debe llamar desde código de producto).
 */
export function __resetStorageForTests(): void {
  resolved = null;
  memoryStore = {};
}

/**
 * MGC-421 AC4 — log helpers para los markers `[persistence]`. AC4 requiere
 * distinguir save-no-invocado vs save-falló-en-nativa vs
 * hydrate-arrancó-pero-no-aplicó en logcat. Antes estos logs estaban
 * gated tras `__DEV__` (sólo dev bundle); en builds preview/profile
 * `__DEV__=false` y Hermes dead-code-eliminaba los logs — el reviewer
 * no veía nada en logcat de QA. Ahora se emiten en bundle Hermes nativo
 * Y en vitest (los tests usan `vi.spyOn(console)` para capturarlos y
 * verificar el contenido). El costo en runtime nativo es despreciable:
 * una línea por mutación de usuario.
 */
function logPersist(level: 'log' | 'error', msg: string, err?: unknown): void {
  if (level === 'log') console.log(msg);
  else console.error(msg, err ?? '');
}

/** Devuelve la partida guardada o `null` si no hay nada. */
export async function loadCareerSave(): Promise<CareerSaveState | null> {
  const storage = pickStorage();
  try {
    const raw = await storage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as CareerSaveState;
        // MGC-1657 (F2.3) — aceptamos v:1 (legacy) y v:2. Si llega v:1
        // aplicamos `migrateV1ToV2` antes de devolver; si llega v:2 lo
        // entregamos tal cual. Otros versiones: log + null.
        if (parsed && parsed.v === 1) {
          const migrated = migrateV1ToV2(parsed);
          logPersist(
            'log',
            `[persistence] hydrate=ok stage=${migrated.stage} profile=${migrated.profile?.name} v=2 (migrated from v:1)`,
          );
          // Persistir la versión migrada para que el próximo load haga
          // fast-path v:2. Sin re-write, cada launch ejecuta la
          // migración (correcta pero más lenta).
          await storage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          return migrated;
        }
        if (parsed && parsed.v === 2) {
          logPersist(
            'log',
            `[persistence] hydrate=ok stage=${parsed.stage} profile=${parsed.profile?.name} v=2`,
          );
          return parsed;
        }
        logPersist(
          'log',
          `[persistence] hydrate=null reason=version-mismatch expected=v1|v2 got=${parsed?.v}`,
        );
      } catch {
        logPersist('log', `[persistence] hydrate=null reason=json-parse-failed`);
      }
    } else {
      logPersist('log', `[persistence] hydrate=null reason=no-snapshot-in-storage`);
    }
  } catch (err) {
    logPersist(
      'error',
      `[persistence] hydrate=fail reason=getItem-threw`,
      err,
    );
    // caemos a back-compat abajo — un getItem-threw no significa "no hay save",
    // puede ser transitorio (cuota, lock del store). El retry a legacy puede
    // funcionar si la legacy key está en una partición distinta.
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
      logPersist(
        'log',
        `[persistence] hydrate=migrated legacy-key=${legacyKey} stage=${migrated.stage}`,
      );
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
  const seed = typeof legacy.seed === 'number' ? legacy.seed : Math.floor(Math.random() * 1_000_000);
  return {
    v: 1,
    stage: stage as CareerSaveState['stage'],
    profile: profile as CareerSaveState['profile'],
    draft: (legacy.draft as CareerSaveState['draft']) ?? null,
    card: (legacy.card as CareerSaveState['card']) ?? null,
    clubId: (legacy.clubId as CareerSaveState['clubId']) ?? null,
    log: normalizeLegacyLog(legacy.log),
    seed,
    rng: createRngSnapshot(seed),
  };
}

/**
 * MGC-1657 (F2.3) — migración v:1 → v:2. Suma los campos nuevos del
 * motor V2 al profile y bumpea el discriminador. Idempotente: si el
 * profile ya trae `positionStats` lo deja igual (test-friendly).
 *
 * Campos agregados (todos con default seguro para no invalidar saves
 * viejos):
 *  - profile.positionStats = STAT_INIT (50 por slot)
 *  - profile.career.doubleShiftStreak = 0
 *  - profile.career.matchweekStats = { clubId: '', apps: 0, goals: 0, ast: 0 }
 */
export function migrateV1ToV2(state: CareerSaveState): CareerSaveState {
  if (state.v === 2) return state;
  const profile = state.profile;
  const migratedProfile = {
    ...profile,
    positionStats: profile.positionStats
      ? profile.positionStats
      : { ...STAT_INIT },
    career: {
      ...profile.career,
      doubleShiftStreak: profile.career.doubleShiftStreak ?? 0,
      matchweekStats: profile.career.matchweekStats ?? {
        clubId: profile.club?.id ?? '',
        apps: 0,
        goals: 0,
        ast: 0,
      },
    },
  };
  return {
    ...state,
    v: 2,
    profile: migratedProfile,
    rng: state.rng ?? createRngSnapshot(state.seed),
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
  const serialized = JSON.stringify(state);
  try {
    await storage.setItem(STORAGE_KEY, serialized);
    logPersist(
      'log',
      `[persistence] save=ok key=${STORAGE_KEY} bytes=${serialized.length} stage=${state.stage} storage=${storage === resolved ? 'native' : 'memory'}`,
    );
  } catch (err) {
    // MGC-262 — antes `.catch(() => {})` silenciaba cualquier error. Si
    // AsyncStorage nativo no linkea (build --local sin autolinking) o el
    // setItem rechaza, queremos ver el error en logs para distinguir
    // "save no se invocó" de "save falló en la nativa" (AC4).
    logPersist(
      'error',
      `[persistence] save=fail key=${STORAGE_KEY} stage=${state.stage} reason=setItem-threw`,
      err,
    );
    throw err;
  }
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
  logPersist(
    'log',
    `[persistence] save=clear key=${STORAGE_KEY} storage=${storage === resolved ? 'native' : 'memory'}`,
  );
}

/**
 * Snapshot mínimo para arrancar la persistencia desde un stage inicial.
 * El caller completa luego con draft/card/log según corresponda.
 *
 * MGC-1657 (F2.3) — produce v:2 con `positionStats` ya hidratado en
 * `STAT_INIT`. El reducer garantiza que cualquier estado en memoria
 * también tiene `positionStats` antes de invocar `saveCareerSave`.
 */
export function blankCareerSave(): CareerSaveState {
  return {
    v: 2,
    stage: 'identity',
    profile: { ...initialProfile },
    draft: null,
    card: null,
    clubId: null,
    log: { timeline: [], events: [] },
    seed: 0,
    rng: createRngSnapshot(0),
  };
}
