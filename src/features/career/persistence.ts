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
 * MGC-2099-A: persistencia multi-slot. La API pública sigue aceptando
 * un único argumento para no romper callers existentes (careerStore,
 * fin-carrera), pero suma un segundo argumento opcional `slotId`:
 *   - `saveCareerSave(state)` → guarda en el slot activo.
 *   - `loadCareerSave()` → carga el slot activo.
 *   - `clearCareerSave()` → borra el slot activo.
 *   - `listSlots()` → lista todos los slots + el activo.
 *   - `setActiveSlot(id)` / `getActiveSlotId()` → controlan el cursor.
 *   - `createSlot(name)` → crea un slot nuevo (slug del nombre).
 *
 * Keying v2:
 *   - `copero:career:save:v2:${slotId}` (CareerSaveState v:2)
 *   - `copero:career:slots:v1` (índice `{ version:1, slots:[{id,name,savedAt}] }`)
 *   - `copero:career:slot:active:v1` (string con slotId activo)
 *
 * Migración silenciosa:
 *   - Si `copero:career:save:v1` existe y no hay índice v2 ni slot v2,
 *     en el primer `loadCareerSave` / `listSlots` se copia al slot
 *     `default` con `name: 'Partida guardada'` (read-only legacy).
 *     La key vieja NO se borra para preservar continuidad de save en
 *     QA device (ZY22G728HN tiene una save legacy que sobrevive el
 *     upgrade — DoR subtarea).
 *
 * La forma del payload está versionada (`v: 2`) para futuras migraciones.
 */

import type { CareerSaveState, SeasonLog } from '@/types/career';
import { createRngSnapshot, seedFromString } from './rng';
import { initialProfile } from './identity-state';
import { STAT_INIT } from './position-stats';
import { NO_MODIFIERS } from './events';

// MGC-1657 (F2.3) — `v:2` discriminador del payload. MGC-2099-A mantiene
// la key estable por slot; el discriminador es `v` + el id de slot.
const SLOT_KEY_PREFIX = 'copero:career:save:v2:';
const INDEX_KEY = 'copero:career:slots:v1';
const ACTIVE_KEY = 'copero:career:slot:active:v1';
// MGC-385 / MGC-227 — keys legacy pre-multi-slot. Se preservan tal cual
// en disco; la migración silenciosa las lee y las duplica al slot
// `default` sin borrarlas (read-only legacy).
const LEGACY_V1_KEY = 'copero:career:save:v1';
const LEGACY_ZUSTAND_KEYS = ['copero-career'] as const;

const SLOT_ID_MAX = 32;
const DEFAULT_SLOT_ID = 'default';
const DEFAULT_SLOT_NAME = 'Partida guardada';

/** Metadato de un slot en el índice v1. */
export type SlotMeta = {
  id: string;
  name: string;
  savedAt: number;
};

export type SlotsIndex = {
  version: 1;
  slots: SlotMeta[];
};

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

/**
 * MGC-2606 — cola de serialización de mutaciones de storage.
 *
 * La API legacy (`saveCareerSave`/`loadCareerSave`/`clearCareerSave`) se
 * llamaba como `await` directo en código de producto, pero el refactor
 * multi-slot pasó `clearCareerSave` a async con varias microtareas
 * internas (`ensureDefaultSlotMigrated`, `removeItem`, `setActiveSlot`).
 * Eso rompió el contrato implícito: callers que disparaban `clear` sin
 * await (`void clearCareerSave()` desde `useCareerStore.reset()`) y luego
 * hacían `saveCareerSave` directo veían al clear ganar la carrera y
 * borrar la key recién escrita — los tests `roundtrip save → load`,
 * `clear+reset`, `resetAll` y `3 corridas` fallaban con `hydrate=null
 * reason=no-snapshot-in-storage`.
 *
 * El fix encola TODA mutación/lectura de storage en una cadena de
 * promesas compartida: cada op espera a la anterior antes de arrancar,
 * así un clear pendiente no puede borrar lo que un save en cola está
 * por escribir, y un load en cola ve la snapshot final consistente.
 *
 * Las ops de queue son las funciones PUBLICAS (`saveCareerSave`,
 * `clearCareerSave`, `loadCareerSave`) — `ensureDefaultSlotMigrated`
 * queda dentro de cada op pública y hereda la serialización.
 */
let writeQueue: Promise<unknown> = Promise.resolve();

function serialize<T>(op: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(op, op);
  writeQueue = next.catch(() => undefined);
  return next;
}

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
  // MGC-2606 — reset de la cola de serialización para que tests que
  // esperan un backend limpio no arrastren operaciones de tests
  // previos. Las ops en vuelo de tests anteriores ya capturaron refs
  // al viejo `memoryStore`; al reemplazarlo y reiniciar la cola,
  // cualquier op residual se completa contra el backend nuevo
  // (idempotente: o escribe de nuevo, o no-op).
  writeQueue = Promise.resolve();
}

/**
 * MGC-2099-A — hook de test: siembra el backend en memoria con
 * `entries` arbitrarios. Usado para reproducir saves legacy
 * (`copero:career:save:v1`, `copero-career`) sin pasar por la API
 * pública, que sólo escribe keys v2 por slot.
 */
export function __seedForTests(entries: Record<string, string>): void {
  for (const [k, v] of Object.entries(entries)) {
    memoryStore[k] = v;
  }
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

/** Slug de un nombre de slot: lowercase + alfanum + `-` + cap 32. */
export function slugifySlotName(name: string): string {
  const collapsed = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, SLOT_ID_MAX);
  return collapsed || DEFAULT_SLOT_ID;
}

function slotKey(slotId: string): string {
  return `${SLOT_KEY_PREFIX}${slotId}`;
}

/** Lee el índice de slots. Si no existe, devuelve un índice vacío. */
async function readIndex(): Promise<SlotsIndex> {
  const storage = pickStorage();
  const raw = await storage.getItem(INDEX_KEY);
  if (!raw) return { version: 1, slots: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<SlotsIndex>;
    if (parsed && parsed.version === 1 && Array.isArray(parsed.slots)) {
      return {
        version: 1,
        slots: parsed.slots.filter(
          (s): s is SlotMeta =>
            !!s &&
            typeof s.id === 'string' &&
            typeof s.name === 'string' &&
            typeof s.savedAt === 'number',
        ),
      };
    }
  } catch {
    // índice corrupto: empezar de cero, sin tocar los payloads individuales.
  }
  return { version: 1, slots: [] };
}

async function writeIndex(index: SlotsIndex): Promise<void> {
  const storage = pickStorage();
  await storage.setItem(INDEX_KEY, JSON.stringify(index));
}

async function updateIndexEntry(slotId: string, mutator: (meta: SlotMeta) => SlotMeta): Promise<SlotsIndex> {
  const index = await readIndex();
  const idx = index.slots.findIndex((s) => s.id === slotId);
  if (idx === -1) {
    return index;
  }
  const updated = mutator(index.slots[idx]);
  const next: SlotsIndex = {
    ...index,
    slots: index.slots.map((s, i) => (i === idx ? updated : s)),
  };
  await writeIndex(next);
  return next;
}

async function appendIndexEntry(meta: SlotMeta): Promise<SlotsIndex> {
  const index = await readIndex();
  if (index.slots.some((s) => s.id === meta.id)) return index;
  const next: SlotsIndex = {
    ...index,
    slots: [...index.slots, meta],
  };
  await writeIndex(next);
  return next;
}

async function removeIndexEntry(slotId: string): Promise<SlotsIndex> {
  const index = await readIndex();
  const next: SlotsIndex = {
    ...index,
    slots: index.slots.filter((s) => s.id !== slotId),
  };
  await writeIndex(next);
  return next;
}

/**
 * MGC-2099-A — asegura que existe el slot `default` para preservar
 * la save legacy de QA (ZY22G728HN). Se ejecuta la primera vez que se
 * pide el slot activo o la lista de slots; idempotente.
 *
 * Si `copero:career:save:v1` existe y no hay slot v2 `default`:
 *  1. Lee la key legacy, la convierte al shape v:2 + hydrateF3Fields.
 *  2. La escribe como `copero:career:save:v2:default`.
 *  3. La agrega al índice como `{id:'default', name:'Partida guardada',
 *     savedAt}` sin borrar la legacy (read-only legacy, ver DoR).
 *  4. Si `copero-career` (zustand) trae un save más viejo todavía,
 *     lo mismo pero sólo si v:1 no existía (legacy zustand es pre-F2.3).
 */
async function ensureDefaultSlotMigrated(): Promise<void> {
  const storage = pickStorage();
  const index = await readIndex();
  if (index.slots.some((s) => s.id === DEFAULT_SLOT_ID)) return;

  let migrated: CareerSaveState | null = null;
  // 1) v:1 con discriminador (post-F2.3).
  try {
    const rawV1 = await storage.getItem(LEGACY_V1_KEY);
    if (rawV1) {
      const parsed = JSON.parse(rawV1) as CareerSaveState;
      if (parsed && (parsed.v === 1 || parsed.v === 2)) {
        const upgraded = parsed.v === 1 ? migrateV1ToV2(parsed) : parsed;
        migrated = hydrateF3Fields(upgraded);
      }
    }
  } catch {
    // continuar al siguiente candidato.
  }

  // 2) legacy zustand `{state, version}` pre-F2.3 (MGC-385).
  if (!migrated) {
    for (const legacyKey of LEGACY_ZUSTAND_KEYS) {
      try {
        const raw = await storage.getItem(legacyKey);
        if (!raw) continue;
        const legacy = JSON.parse(raw) as { state?: unknown; version?: number };
        const inner = legacy?.state;
        if (!inner || typeof inner !== 'object') continue;
        const v1 = migrateLegacyToV1(inner as Record<string, unknown>);
        if (!v1) continue;
        migrated = hydrateF3Fields(migrateV1ToV2(v1));
        break;
      } catch {
        // probar el próximo.
      }
    }
  }

  if (!migrated) return; // nada que migrar; el primer save creará el slot.

  await storage.setItem(slotKey(DEFAULT_SLOT_ID), JSON.stringify(migrated));
  await appendIndexEntry({
    id: DEFAULT_SLOT_ID,
    name: migrated.profile?.name || DEFAULT_SLOT_NAME,
    savedAt: Date.now(),
  });
  logPersist(
    'log',
    `[persistence] migrate=legacy→v2:default stage=${migrated.stage} profile=${migrated.profile?.name}`,
  );
}

/** Devuelve el slot activo. Crea `default` la primera vez. */
export async function getActiveSlotId(): Promise<string> {
  await ensureDefaultSlotMigrated();
  const storage = pickStorage();
  const raw = await storage.getItem(ACTIVE_KEY);
  if (raw && typeof raw === 'string') return raw;
  return DEFAULT_SLOT_ID;
}

/** Cambia el slot activo. No falla si el slot no existe (la próxima
 *  lectura devolverá `null`). */
export async function setActiveSlot(slotId: string): Promise<void> {
  const storage = pickStorage();
  await storage.setItem(ACTIVE_KEY, slotId);
  logPersist('log', `[persistence] active-slot=${slotId}`);
}

/** Lista los slots guardados, ordenado por `savedAt` desc. */
export async function listSlots(): Promise<{ slots: SlotMeta[]; activeSlotId: string }> {
  await ensureDefaultSlotMigrated();
  const index = await readIndex();
  const activeSlotId = await getActiveSlotId();
  return {
    slots: [...index.slots].sort((a, b) => b.savedAt - a.savedAt),
    activeSlotId,
  };
}

/**
 * Crea un slot nuevo con un nombre legible. El id se deriva del nombre
 * vía `slugifySlotName`; si el slug choca con un slot existente, se
 * anexa `-2`, `-3`, … Devuelve el meta del slot creado (id + name) o
 * del slot existente si el nombre colisiona exactamente.
 *
 * MGC-2999 — al crear el slot escribimos un payload v:2 limpio con
 * `seed = seedFromString(slotId)` para que la nueva partida arranque
 * con state AISLADO del slot activo previo (antes `createSlot` sólo
 * agregaba el índice y el siguiente `saveCareerSave` desde el store
 * pisaba el key nuevo con el state del slot anterior — byte-identical
 * save:v2:default === save:v2:nuevoSlotId).
 */
export async function createSlot(name: string): Promise<{ id: string; name: string }> {
  await ensureDefaultSlotMigrated();
  const trimmed = name.trim() || DEFAULT_SLOT_NAME;
  const baseSlug = slugifySlotName(trimmed);
  const index = await readIndex();
  const existing = index.slots.find((s) => s.name === trimmed);
  if (existing) return { id: existing.id, name: existing.name };

  let id = baseSlug;
  let n = 2;
  while (index.slots.some((s) => s.id === id)) {
    const suffix = `-${n}`;
    id = `${baseSlug.slice(0, SLOT_ID_MAX - suffix.length)}${suffix}`;
    n += 1;
  }
  // Append ANTES del setItem para que el dedup-by-name del siguiente
  // `createSlot` con el mismo nombre encuentre la entry con el name
  // real (si llamáramos `saveCareerSave` primero, su index entry
  // tendría `name = 'Partida guardada'` y rompería el dedup-by-name).
  await appendIndexEntry({ id, name: trimmed, savedAt: Date.now() });
  // Payload v:2 inicial con seed derivado del slotId — único por slot
  // y determinista (re-create con mismo nombre → mismo seed). El
  // `blankCareerSave` aplica los defaults F3.2 vía `hydrateF3Fields`
  // cuando se carga; acá sólo necesitamos un shape serializable v:2.
  const freshSeed = seedFromString(id);
  const initial: CareerSaveState = {
    ...blankCareerSave(),
    seed: freshSeed,
    rng: createRngSnapshot(freshSeed),
    // Stage 'identity' → el usuario ve el form en vez del dashboard de
    // una carrera fantasma. Si viniera de un switch mid-carrera, el
    // primer `commitIdentityAndStartDraft` reemplazará este payload.
    stage: 'identity',
  };
  const storage = pickStorage();
  await storage.setItem(slotKey(id), JSON.stringify(initial));
  logPersist(
    'log',
    `[persistence] create-slot id=${id} name=${trimmed} seed=${freshSeed} stage=identity`,
  );
  return { id, name: trimmed };
}

/** Elimina un slot del índice y borra su payload. Idempotente. */
export async function deleteSlot(slotId: string): Promise<void> {
  const storage = pickStorage();
  await storage.removeItem(slotKey(slotId));
  await removeIndexEntry(slotId);
  const active = await getActiveSlotId();
  if (active === slotId) {
    await setActiveSlot(DEFAULT_SLOT_ID);
  }
  logPersist('log', `[persistence] delete-slot id=${slotId}`);
}

/** Devuelve la partida guardada del slot o `null` si no hay nada. */
export function loadCareerSave(slotId?: string): Promise<CareerSaveState | null> {
  // MGC-2606 — serializa reads detrás de writes pendientes para que
  // un clear en vuelo no pueda borrar el save que un load va a leer.
  return serialize(() => loadCareerSaveImpl(slotId));
}

async function loadCareerSaveImpl(slotId?: string): Promise<CareerSaveState | null> {
  await ensureDefaultSlotMigrated();
  const targetId = slotId ?? (await getActiveSlotId());
  const storage = pickStorage();
  try {
    const raw = await storage.getItem(slotKey(targetId));
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as CareerSaveState;
        if (parsed && parsed.v === 1) {
          const hydrated = hydrateF3Fields(migrateV1ToV2(parsed));
          logPersist(
            'log',
            `[persistence] hydrate=ok slot=${targetId} stage=${hydrated.stage} profile=${hydrated.profile?.name} v=2 (migrated from v:1)`,
          );
          // MGC-1678 (HIGH-3 PR #404) — migración in-memory + rewrite
          // background (misma política que pre-multi-slot).
          storage
            .setItem(slotKey(targetId), JSON.stringify(hydrated))
            .catch((err) => {
              logPersist(
                'error',
                `[persistence] migrate-rewrite=fail slot=${targetId} reason=setItem-threw`,
                err,
              );
            });
          await updateIndexEntry(targetId, (meta) => ({
            ...meta,
            savedAt: Date.now(),
          }));
          return hydrated;
        }
        if (parsed && parsed.v === 2) {
          // MGC-1730 (HIGH-2 review CTO sobre PR #425) — defaults F3.2
          // in-memory sin rewrite a disco.
          const hydrated = hydrateF3Fields(parsed);
          logPersist(
            'log',
            `[persistence] hydrate=ok slot=${targetId} stage=${hydrated.stage} profile=${hydrated.profile?.name} v=2`,
          );
          return hydrated;
        }
        logPersist(
          'log',
          `[persistence] hydrate=null slot=${targetId} reason=version-mismatch expected=v1|v2 got=${parsed?.v}`,
        );
      } catch {
        logPersist(
          'log',
          `[persistence] hydrate=null slot=${targetId} reason=json-parse-failed`,
        );
      }
    } else {
      logPersist(
        'log',
        `[persistence] hydrate=null slot=${targetId} reason=no-snapshot-in-storage`,
      );
    }
  } catch (err) {
    logPersist(
      'error',
      `[persistence] hydrate=fail slot=${targetId} reason=getItem-threw`,
      err,
    );
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
 * MGC-1730 (HIGH-2 review CTO sobre PR #425) — `postMatchPending`,
 * `nextWeekModifiers` y `transferState` son **opcionales** en el shape
 * de `CareerSaveState` (ADR-0017 §6 dice: default explícito en lugar de
 * bump de versión para no invalidar saves viejos). Sin este helper, un
 * save v:2 que llegó a disco antes de F3.2 (sin estos campos) hidrata
 * `undefined` y la UI no puede diferenciar "no hay evento" de "el save
 * está roto". Aplica los defaults del ADR:
 *
 *   - `postMatchPending`: `null`  (no hay modal post-partido que mostrar)
 *   - `nextWeekModifiers`: `NO_MODIFIERS` (sin bonus ni castigos)
 *   - `transferState`: `null`  (no hay decisión de transferencia abierta)
 *
 * Es pura: no muta el input. Se invoca después de `migrateV1ToV2` (en
 * el fast-path de v:2) y antes de devolver al caller de `loadCareerSave`.
 */
export function hydrateF3Fields(state: CareerSaveState): CareerSaveState {
  return {
    ...state,
    postMatchPending: state.postMatchPending ?? null,
    nextWeekModifiers: state.nextWeekModifiers ?? { ...NO_MODIFIERS },
    transferState: state.transferState ?? null,
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

/**
 * Guarda la partida en el slot activo (o el `slotId` pasado). Actualiza
 * el índice: si el slot no existe todavía, lo crea con `name` derivado
 * del profile; si existe, sólo bumpea `savedAt`. Devuelve el id del slot
 * usado para que el caller pueda sincronizar el cursor si quiere.
 */
export function saveCareerSave(
  state: CareerSaveState,
  slotId?: string,
): Promise<{ slotId: string }> {
  // MGC-2606 — serializa writes para que un clear pendiente no borre
  // el slot key antes de que este save termine de escribir.
  return serialize(() => saveCareerSaveImpl(state, slotId));
}

async function saveCareerSaveImpl(
  state: CareerSaveState,
  slotId?: string,
): Promise<{ slotId: string }> {
  const storage = pickStorage();
  const targetId = slotId ?? (await getActiveSlotId());
  const serialized = JSON.stringify(state);
  try {
    await storage.setItem(slotKey(targetId), serialized);
    // Mantener el índice sincronizado con el último savedAt + nombre.
    const index = await readIndex();
    const known = index.slots.find((s) => s.id === targetId);
    if (known) {
      await updateIndexEntry(targetId, (meta) => ({ ...meta, savedAt: Date.now() }));
    } else {
      await appendIndexEntry({
        id: targetId,
        name: state.profile?.name || DEFAULT_SLOT_NAME,
        savedAt: Date.now(),
      });
    }
    logPersist(
      'log',
      `[persistence] save=ok slot=${targetId} bytes=${serialized.length} stage=${state.stage} storage=${storage === resolved ? 'native' : 'memory'}`,
    );
    return { slotId: targetId };
  } catch (err) {
    // MGC-262 — antes `.catch(() => {})` silenciaba cualquier error. Si
    // AsyncStorage nativo no linkea (build --local sin autolinking) o el
    // setItem rechaza, queremos ver el error en logs para distinguir
    // "save no se invocó" de "save falló en la nativa" (AC4).
    logPersist(
      'error',
      `[persistence] save=fail slot=${targetId} stage=${state.stage} reason=setItem-threw`,
      err,
    );
    throw err;
  }
}

/** Borra la partida guardada del slot activo (o `slotId` específico).
 *  No toca las keys legacy ni el resto del índice. */
export function clearCareerSave(slotId?: string): Promise<void> {
  // MGC-2606 — serializa clears detrás de saves y otros clears para
  // que un `void clearCareerSave()` desde `reset()` no compita con
  // un `saveCareerSave()` directo del caller siguiente.
  return serialize(() => clearCareerSaveImpl(slotId));
}

async function clearCareerSaveImpl(slotId?: string): Promise<void> {
  await ensureDefaultSlotMigrated();
  const targetId = slotId ?? (await getActiveSlotId());
  const storage = pickStorage();
  await storage.removeItem(slotKey(targetId));
  // Si el slot activo se borra, cursor vuelve al `default` (UX: nunca
  // dejamos al usuario sin slot activo seleccionable).
  const active = await getActiveSlotId();
  if (active === targetId) {
    await setActiveSlot(DEFAULT_SLOT_ID);
  }
  logPersist(
    'log',
    `[persistence] save=clear slot=${targetId} storage=${storage === resolved ? 'native' : 'memory'}`,
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
