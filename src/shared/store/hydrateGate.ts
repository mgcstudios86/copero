// src/shared/store/hydrateGate.ts — gate centralizado de hidratación
//
// MGC-755 iter8 — raíz causa del loop `hydrate=null` saturando JS thread.
//
// Iter6 (MGC-716) introdujo `hydrationInFlight` y dedup de logs.
// Iter7 (MGC-729) mejoró el dedup a "sticky" y agregó un latch de 30s.
// Iter8 (MGC-755) — el walk QA sobre 694 (a36d5b4) mostró que las
// defenses seguían sin cortar el loop: 3184 entradas `[persistence]
// hydrate=null` en 152s = ~21 logs/s, misma cadencia que iter6.
//
// Tres causas raíz identificadas:
//
//   1. Call sites paralelos: el guard `hydrationInFlight` es
//      módulo-scope; si dos entry points distintos (Hermes bundle
//      split / Expo dev client) importan `careerStore` cada uno tiene
//      su propio módulo-scope. La dedup key del Set sticky vive en
//      `persistence.ts` y ES compartida (mismo module instance), pero
//      el guard `hydrationInFlight` y el latch viven acá.
//
//   2. Cascada setState → useEffect: el `setSnapshot(...)` seguido de
//      `set({ hydrated: true })` produce dos re-renders en Zustand.
//      Cualquier useEffect que escuche `hydrated` o el snapshot puede
//      disparar un nuevo `hydrateFromSave` ad-infinitum.
//
//   3. `dashboard.onSlotChanged` + `SaveSlotPicker.onConfirm` invalidan
//      el latch y vuelven a llamar — el log `[persistence]
//      no-snapshot-in-storage` se emite, OK, pero las re-renders
//      siguientes encuentran el slot todavía sin payload y re-entran
//      al path. Y `__forceHydrateFromSave` (MGC-729 escape hatch) hace
//      bypass completo del latch.
//
// Solución iter8 — gate único con 3 capas independientes:
//
//   Capa A — module instance guard. `MODULE_INSTANCE_ID` se genera al
//     cargar el módulo y se loguea en el PRIMER hydrate=null. Si
//     vemos en logcat dos IDs distintos estamos ante un bundle split
//     (root cause confirmado en log).
//
//   Capa B — singleton via Symbol. Re-exportamos un Symbol singleton
//     que vive en `globalThis` (sobrevive a HMR y Reanimated
//     reconciliation). Esto cierra la ventana "dos imports del
//     mismo módulo = dos guards".
//
//   Capa C — early-exit semántico. Si la última lectura devolvió
//     `null` (sin payload en disco), NO invocamos `loadCareerSave` de
//     nuevo hasta que se produzca un evento invalidante (save
//     exitosa, cambio de slot activo, reset). El log ya dijo
//     `no-snapshot-in-storage` — re-preguntar a AsyncStorage no trae
//     información nueva y satura el bridge JS↔native.
//
// La función pública `requestHydrate(opts)` es el ÚNICO entry point
// válido. `careerStore.hydrateFromSave` se refactoriza para delegar
// acá, conservando la API pública del store.

import { getActiveSlotId } from '@/features/career/persistence';

/**
 * ID de instancia del módulo. Generado en module-load; logueado en el
 * primer hydrate=null para que QA pueda detectar bundle-splits en logcat.
 *
 * Hermes bundle el módulo UNA vez por proceso JS — si dos archivos
 * importan `@/shared/store/hydrateGate` desde distintos entry chunks
 * (Expo dev client + Metro split), cada bundle instance tiene su
 * propio scope. El Symbol de la capa B los reconcilia en `globalThis`.
 */
const MODULE_INSTANCE_ID = `gate-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Singleton reconciliado en `globalThis`. Hermes bundle-splits y HMR
 * pueden recargar el módulo; sin este anclaje perdemos el estado de
 * la dedup entre recargas. La clave usa el nombre del símbolo para
 * evitar colisiones con otros gates.
 */
const SINGLETON_KEY = Symbol.for('@copero/hydrateGate/v1');

/**
 * MGC-777 iter9 — throttle del log high-call-count. 5 segundos entre
 * warns consecutivos del mismo callKey. Suficiente para diagnóstico
 * sin tapar el logcat (3936 calls → 1-2 logs totales).
 */
const HIGH_CALL_LOG_THROTTLE_MS = 5_000;

/**
 * MGC-777 iter9 — callback opcional que invalida caches aguas abajo
 * del gate (ej: el hard wall al call site de `careerStore.hydrateFromSave`).
 * Se registra vía `registerInvalidateHook(cb)`. El gate lo invoca
 * SINCRONAMENTE desde `invalidate()` para que un save+hydrate inmediato
 * vea el cache reseteado (un dynamic import sería fire-and-forget y
 * llegaría tarde).
 *
 * Patrón registrado-en-lugar-de-import-estático para evitar circular
 * dep: hydrateGate → careerStore → persistence → hydrateGate (cycle).
 * `careerStore.ts` se registra a sí mismo en module-load vía
 * `registerInvalidateHook`. Si dos módulos registran, ambos se llaman.
 */
type InvalidateHook = () => void;
const invalidateHooks: InvalidateHook[] = [];

export function registerInvalidateHook(cb: InvalidateHook): () => void {
  invalidateHooks.push(cb);
  return () => {
    const i = invalidateHooks.indexOf(cb);
    if (i >= 0) invalidateHooks.splice(i, 1);
  };
}

function fireInvalidateHooks(): void {
  for (const cb of invalidateHooks) {
    try {
      cb();
    } catch {
      // best-effort: si un hook tira, los demás corren igual.
    }
  }
}

type GateState = {
  /** In-flight Promise compartida entre callers concurrentes. */
  inFlight: Promise<boolean> | null;
  /**
   * Last terminal result. Si ok=false y reason es "no-snapshot",
   * toda llamada sub-siguiente con el mismo slotId sale inmediato
   * hasta que `invalidate()` se llame (post save, slot change, reset).
   */
  lastResult: {
    ok: boolean;
    reason: 'no-snapshot' | 'loaded' | 'error' | 'version-mismatch' | 'json-parse-failed';
    slotId: string;
    at: number;
  } | null;
  /** Sticky dedup key: slotId + reason. Vacía en reset. */
  nullLogEmitted: Set<string>;
  /** First-null flag: emitir stack trace sólo la primera vez. */
  firstNullEmitted: boolean;
  /** Counter de calls por slotId, para diagnóstico de loops. */
  callCount: Map<string, number>;
  /**
   * MGC-777 iter9 — timestamp del último high-call-count log por
   * callKey. Permite throttle del spam (3936 calls → 1-2 logs cada
   * HIGH_CALL_LOG_THROTTLE_MS).
   */
  highCallLogAt: Map<string, number>;
  /** Module instance id del primer load; detecta bundle-splits. */
  firstInstanceId: string;
};

interface GlobalWithGate {
  [SINGLETON_KEY]?: GateState;
}

function getGate(): GateState {
  const g = globalThis as unknown as GlobalWithGate;
  if (!g[SINGLETON_KEY]) {
    g[SINGLETON_KEY] = {
      inFlight: null,
      lastResult: null,
      nullLogEmitted: new Set(),
      firstNullEmitted: false,
      callCount: new Map(),
      highCallLogAt: new Map(),
      firstInstanceId: MODULE_INSTANCE_ID,
    };
  }
  return g[SINGLETON_KEY] as GateState;
}

/**
 * Razones terminales de una lectura de hidratación. Coinciden 1:1 con
 * los branches que ya emite `persistence.ts` (`[persistence] hydrate=…`).
 */
export type HydrateReason =
  | 'no-snapshot'
  | 'loaded'
  | 'error'
  | 'version-mismatch'
  | 'json-parse-failed';

export type HydrateOutcome<T = unknown> =
  | { ok: true; slotId: string; payload: T }
  | { ok: false; slotId: string; reason: HydrateReason };

/**
 * Opciones de `requestHydrate`.
 *
 * `force: true` salta la capa C (early-exit por no-snapshot). Usar
 * SOLO desde `dashboard.onSlotChanged` (slot activo cambió — hay
 * payload potencial nuevo en otra key), `SaveSlotPicker.onConfirm`
 * (slot recién creado y posiblemente vacío), y `__forceHydrateFromSave`
 * (escape hatch de MGC-729 que ya estaba documentado). NUNCA llamar
 * con `force: true` desde el bootstrap del layout: sería equivalente
 * a no tener gate.
 */
export interface RequestHydrateOptions {
  force?: boolean;
  /** Caller identificable para logs de diagnóstico. */
  caller?: string;
}

/**
 * Función pública central de hidratación.
 *
 * Comportamiento:
 *   1. Resolver slotId activo (default).
 *   2. Si hay un Promise in-flight, devolver esa misma Promise
 *      (coalesce de callers concurrentes).
 *   3. Si la última lectura devolvió `no-snapshot` para este slotId
 *      y `opts.force` NO es true, devolver `{ ok: false, slotId,
 *      reason: 'no-snapshot' }` inmediato sin tocar AsyncStorage.
 *   4. Si `force=true`, invalidar el lastResult antes de continuar.
 *   5. Llamar al loader real (inyectado como `loader` para evitar
 *      import circular con `careerStore`).
 *   6. Mapear el resultado del loader a HydrateOutcome y cachear.
 *
 * El `loader` se inyecta porque careerStore.ts necesita aplicar el
 * snapshot al store Zustand post-load — responsabilidad que NO vive
 * en este gate (el gate es storage-agnóstico).
 */
export async function requestHydrate<T>(
  loader: () => Promise<{ saved: T; reason?: HydrateReason } | null>,
  opts: RequestHydrateOptions = {},
): Promise<HydrateOutcome<T>> {
  const gate = getGate();

  // Capa A — coalesce INMEDIATA, sin await previo. Si ya hay una
  // promise in-flight, todos los callers concurrentes (StrictMode
  // dev, reanimated reconciliation, layout effect doble) cuelgan
  // de la misma Promise. Esta rama corre ANTES de tocar
  // `resolveActiveSlotId()` para que la coalesce sea determinística
  // cuando N callers invocan en el mismo tick del event loop.
  //
  // Importante: `gate.inFlight` se setea en el primer caller de
  // forma SÍNCRONA (abajo), antes del primer `await`, para que los
  // callers 2..N que entren en el mismo tick vean el guard
  // inmediatamente. Esto cierra el race donde las 5 calls
  // suspendían en `await resolveActiveSlotId()` antes de que
  // cualquiera llegara a setear el inFlight.
  if (gate.inFlight) {
    const callerSlotId = await resolveActiveSlotId();
    return wrapOutcome(gate.inFlight, callerSlotId);
  }

  // MGC-777 iter9 — fast-path cache check ANTES del await de
  // `resolveActiveSlotId()`. iter8 esperaba el slotId para chequear
  // Capa C, lo que añadía un microtask innecesario y, peor, el IIFE
  // entraba, incrementaba callCount, emitía high-call-count log y
  // SOLO ENTONCES early-exit. Si el caller sub-siguiente es del
  // mismo slotId='default' (el caso típico del bootstrap), podemos
  // salir INMEDIATO sin tocar AsyncStorage, sin incrementar callCount
  // y sin emitir log. Esto baja las 3936 entradas `[hydrateGate]
  // high-call-count` del walk MGC-768 a 0 en el path del default slot.
  //
  // Costo: para slots distintos a 'default' el check se hace con
  // 'default' como heurística y el IIFE re-valida con el slotId real.
  // Peor caso: 1 ciclo extra de check por call de slot no-default.
  if (
    !opts.force &&
    gate.lastResult &&
    gate.lastResult.ok === false &&
    gate.lastResult.reason === 'no-snapshot' &&
    gate.lastResult.slotId === 'default'
  ) {
    return { ok: false, slotId: 'default', reason: 'no-snapshot' };
  }

  // Reservar la promise de coalesce SÍNCRONAMENTE. `resolveOutcome`
  // se llama desde el IIFE async; mientras tanto la promise queda
  // pending en `gate.inFlight` y cualquier caller nuevo se cuelga.
  let resolveOutcome!: (v: HydrateOutcome<T>) => void;
  let rejectOutcome!: (err: unknown) => void;
  const inFlightPromise = new Promise<HydrateOutcome<T>>((resolve, reject) => {
    resolveOutcome = resolve;
    rejectOutcome = reject;
  });
  gate.inFlight = inFlightPromise;

  // Cleanup garantizado: cuando el IIFE termina (éxito o error),
  // liberamos el slot de coalesce para que la próxima ronda de
  // calls pueda arrancar un nuevo load real.
  const cleanup = () => {
    if (gate.inFlight === inFlightPromise) {
      gate.inFlight = null;
    }
  };

  // IIFE async corre DESPUÉS de reservar el slot. Esto garantiza
  // que cualquier caller nuevo se cuelgue de `inFlightPromise` aunque
  // la primera call todavía esté suspendida en `await resolveActiveSlotId()`.
  (async () => {
    try {
      const slotId = await resolveActiveSlotId();
      const callKey = `${opts.caller ?? 'unknown'}:${slotId}`;

      // Counters de diagnóstico — siempre disponibles, costo despreciable.
      gate.callCount.set(callKey, (gate.callCount.get(callKey) ?? 0) + 1);
      // MGC-777 iter9 — throttle del log high-call-count. iter8 emitía
      // 1 warn POR CADA call después del threshold, explicando los
      // 3936 logs del walk MGC-768 (uno por call). Throttle a 1 emit
      // cada 5s por callKey: el primero se emite inmediato al pasar
      // el threshold; los siguientes se suprimen hasta que pase el
      // intervalo. Si el loop sigue activo, el log reaparece cada 5s
      // con el count actualizado — suficiente para diagnóstico sin
      // tapar el logcat.
      if ((gate.callCount.get(callKey) ?? 0) > 5) {
        const now = Date.now();
        const lastLogAt = gate.highCallLogAt.get(callKey) ?? 0;
        if (now - lastLogAt >= HIGH_CALL_LOG_THROTTLE_MS) {
          gate.highCallLogAt.set(callKey, now);
          // eslint-disable-next-line no-console
          console.warn(
            `[hydrateGate] high-call-count caller=${opts.caller ?? 'unknown'} ` +
              `slotId=${slotId} count=${gate.callCount.get(callKey)} ` +
              `instance=${gate.firstInstanceId}`,
          );
        }
      }

      // Capa C — early exit si no-snapshot previo y no se forzó.
      if (
        !opts.force &&
        gate.lastResult &&
        gate.lastResult.ok === false &&
        gate.lastResult.reason === 'no-snapshot' &&
        gate.lastResult.slotId === slotId
      ) {
        resolveOutcome({ ok: false, slotId, reason: 'no-snapshot' });
        return;
      }

      // Capa C — si `force`, invalidamos explícitamente.
      if (opts.force) {
        gate.lastResult = null;
      }

      // Loader real. Resuelve al payload completo o null.
      let loaded: { saved: T; reason?: HydrateReason } | null;
      try {
        loaded = await loader();
      } catch {
        // AsyncStorage nativo explotó. Mapeamos a 'error' y NO
        // cacheamos para permitir retry en el próximo call.
        gate.lastResult = {
          ok: false,
          reason: 'error',
          slotId,
          at: Date.now(),
        };
        resolveOutcome({ ok: false, slotId, reason: 'error' });
        return;
      }

      if (!loaded) {
        // Sin payload. Capa C: cacheamos para cortar el loop.
        emitNullOnce(slotId, 'no-snapshot', gate);
        gate.lastResult = {
          ok: false,
          reason: 'no-snapshot',
          slotId,
          at: Date.now(),
        };
        resolveOutcome({ ok: false, slotId, reason: 'no-snapshot' });
        return;
      }

      if (loaded.reason && loaded.reason !== 'loaded') {
        // version-mismatch / json-parse-failed. Estos SÍ merecen log
        // porque indican payload corrupto. Cacheamos también para no
        // spammear (pero permitimos reintento post save).
        emitNullOnce(slotId, loaded.reason, gate);
        gate.lastResult = {
          ok: false,
          reason: loaded.reason,
          slotId,
          at: Date.now(),
        };
        resolveOutcome({ ok: false, slotId, reason: loaded.reason });
        return;
      }

      // loaded.reason === 'loaded' o indefinido + saved presente.
      // Devolvemos el payload completo al caller para que NO tenga
      // que re-invocar `loadCareerSave` (que podría retornar null por
      // una race con clear+save o porque el módulo de persistencia
      // ya encoló un clear). Esto cierra el bug MGC-755 iter8 donde
      // el doble load rompía tests que asumen apply directo del save.
      gate.lastResult = { ok: true, reason: 'loaded', slotId, at: Date.now() };
      resolveOutcome({ ok: true, slotId, payload: loaded.saved });
    } catch (err) {
      rejectOutcome(err);
    } finally {
      cleanup();
    }
  })();

  return inFlightPromise;
}

async function wrapOutcome<T>(
  inner: Promise<HydrateOutcome<T>>,
  slotId: string,
): Promise<HydrateOutcome<T>> {
  // Si la promise interna ya tiene un slotId distinto, ganamos el de
  // la inner (que es el activo real al momento del load). Si no,
  // reescribimos con el slotId solicitado por el caller.
  const result = await inner;
  return result.slotId === slotId ? result : { ...result, slotId };
}

async function resolveActiveSlotId(): Promise<string> {
  try {
    return await getActiveSlotId();
  } catch {
    return 'default';
  }
}

function emitNullOnce(slotId: string, reason: HydrateReason, gate: GateState): void {
  // Sticky dedup: emitimos sólo una vez por (slotId, reason).
  const key = `${slotId}:${reason}`;
  if (gate.nullLogEmitted.has(key)) return;
  gate.nullLogEmitted.add(key);

  if (!gate.firstNullEmitted) {
    gate.firstNullEmitted = true;
    // eslint-disable-next-line no-console
    console.warn(
      `[hydrateGate] FIRST hydrate=null slotId=${slotId} reason=${reason} ` +
        `instance=${gate.firstInstanceId}\n` +
        `Stack: ${new Error('hydrate=null first-emission').stack ?? '(no stack)'}`,
    );
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      `[hydrateGate] hydrate=null slotId=${slotId} reason=${reason} ` +
        `(sticky dedup; subsequent calls suppressed)`,
    );
  }
}

/**
 * Invalida el cache del gate. Llamado por:
 *   - `dashboard.onSlotChanged` antes de cada slot switch (el nuevo
 *     slot activo puede tener payload en otra key).
 *   - `SaveSlotPicker.onConfirm` al crear un slot nuevo (aunque el
 *     nuevo esté vacío, el cache debe reflejar "slot cambió").
 *   - `careerStore.resetAll` post-wipe (cualquier lectura previa es
 *     obsoleta).
 *   - `saveCareerSave` tras save exitosa (la próxima lectura debería
 *     encontrar payload — pero conservamos el resultado cacheado si
 *     fue ok=true porque la save exitosa es información terminal).
 *   - `clearCareerSave` post-clear (idem save: el storage cambió).
 *
 * Sólo resetea `lastResult` para el slotId indicado. NO limpia el
 * Set sticky `nullLogEmitted` (éste vive por bundle-instance lifetime
 * para que el log spam no se reactive tras un reset parcial). Para
 * reset completo usar `__resetGateForTests`.
 *
 * MGC-777 iter9 — además del cache del gate, dispara los hooks
 * registrados via `registerInvalidateHook`. El wall al call site de
 * `careerStore.hydrateFromSave` se auto-registra al cargar el módulo
 * de store, y la invalidación corre SINCRÓNICAMENTE desde acá para
 * que un save+hydrate inmediato vea el cache reseteado. Patrón
 * registrado-en-lugar-de-import-estático para evitar circular dep
 * estática (hydrateGate → careerStore → persistence → hydrateGate).
 */
export function invalidate(slotId?: string): void {
  const gate = getGate();
  if (!slotId) {
    gate.lastResult = null;
  } else if (gate.lastResult && gate.lastResult.slotId === slotId) {
    gate.lastResult = null;
  }
  fireInvalidateHooks();
}

/**
 * Resetea el gate completo. Para tests que necesitan un estado limpio
 * entre corridas (mismo patrón que `__resetStorageForTests` en
 * persistence.ts).
 */
export function __resetGateForTests(): void {
  const g = globalThis as unknown as GlobalWithGate;
  delete g[SINGLETON_KEY];
  // MGC-777 iter9 — limpia los hooks registrados para que un test
  // anterior no contamine el siguiente (los hooks se re-registran
  // al cargar el módulo careerStore de cada test).
  invalidateHooks.length = 0;
}

/**
 * Estado del gate para diagnóstico / tests. NO usar en lógica de
 * runtime — expuesto sólo para introspección.
 */
export function getGateDebug() {
  const gate = getGate();
  return {
    instanceId: MODULE_INSTANCE_ID,
    firstInstanceId: gate.firstInstanceId,
    hasInFlight: gate.inFlight !== null,
    lastResult: gate.lastResult,
    nullLogEmittedSize: gate.nullLogEmitted.size,
    firstNullEmitted: gate.firstNullEmitted,
    callCount: Object.fromEntries(gate.callCount.entries()),
    highCallLogAt: Object.fromEntries(gate.highCallLogAt.entries()),
  };
}
