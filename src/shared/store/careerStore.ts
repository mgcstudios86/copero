// src/shared/store/careerStore.ts — Copero (MGC-227 persistencia + MGC-543 code-split)
//
// Store de Zustand para el state machine del simulador de carrera. MGC-543
// separa la lógica de identidad (liviana, sin motor) de las acciones de
// simulación (pesadas, requieren `engine.ts` → `simulation.ts` → `strategy.ts`).
//
// Persistencia (MGC-227): se delega a `features/career/persistence.ts` que
// expone `saveCareerSave/loadCareerSave/clearCareerSave` con payload
// versionado (`v: 1`) bajo la key `copero:career:save:v1` en AsyncStorage.
// Antes: la store usaba el middleware `zustand/persist` con key
// `copero-career`. Eso escribía un payload no versionado a una key distinta
// y generaba duplicación silenciosa con `saveCareerSave`. MGC-227 unifica:
// la store NO persiste automáticamente; cada acción llama
// `saveCareerSave(snapshot)` post-mutation, y `bootstrap` hidrata desde
// `loadCareerSave()` durante el arranque de la app.
//
// Acceptance criteria MGC-543: transfer /identity <= 415 KB. Esta refactor
// apunta a sacar ~120 KB de strategy+simulation+reputation del entry chunk.

import { create } from 'zustand';
import {
  initialSnapshot,
  isIdentityComplete,
} from '@/features/career/identity-state';
import {
  saveCareerSave,
  loadCareerSave,
  clearCareerSave,
} from '@/features/career/persistence';
import type { CareerAction } from '@/features/career/engine';
import type { CareerSnapshot, Club, Foot, Position, StrategyId } from '@/types/career';

type CareerStore = CareerSnapshot & {
  setName: (name: string) => void;
  setNumber: (number: number) => void;
  setPosition: (position: Position) => void;
  setNationality: (code: string) => void;
  setPreferredFoot: (foot: Foot) => void;
  commitIdentity: () => void;
  /**
   * MGC-249: ruta directa desde "Empezar carrera" al draft, sin pasar
   * por dashboard. Compone `commitIdentity` + `startDraft` en un solo step
   * para evitar dos renders intermedios con snapshot inconsistente.
   *
   * MGC-273: retorna `Promise<void>` y AWAITA `flushPendingSave()` al
   * final. Antes la acción disparaba la persistencia pero resolvía sin
   * esperar la confirmación de AsyncStorage — el caller (form
   * HomepageCareerStarter) hacía `router.push('/simulador-carrera/draft')`
   * inmediatamente, y un force-stop del usuario antes de que `setItem`
   * resolviera perdía el snapshot. La AC1/AC2 de MGC-270 fallaban con
   * home mostrando "Definí tu identidad" vacío tras relaunch. Await
   * bloquea la navegación hasta que AsyncStorage confirme la escritura.
   */
  commitIdentityAndStartDraft: (seed?: number) => Promise<void>;
  openAcademy: () => void;
  acceptClub: (club: Club) => void;
  decide: (strategyId: StrategyId, choiceId: string) => void;
  advance: () => void;
  /**
   * Draft de leyendas (MGC-208 §1) — MGC-209.
   *
   * MGC-284: todas las acciones del draft/post-draft retornan `Promise<void>`
   * y AWAITAN `flushPendingSave()` antes de resolver. Antes eran fire-and-
   * forget (`void (async () => {...})()`) — el snapshot quedaba en memoria
   * pero un force-stop antes de que `setItem` resolviera lo perdía.
   *
   * Concretamente: tras `pickLegend`/`swapLegend`/`pickClub`/`advanceSeason`,
   * si el usuario force-stopea antes del flush, AsyncStorage queda con un
   * snapshot anterior y al relaunch la home mostraba onboarding vacío
   * (AC1) o la pantalla de draft sin las picks confirmadas (AC4).
   *
   * El await interno serializa el chain (las saves encadenadas vía
   * `pendingSave` de MGC-277 ya garantizan ordenamiento) y bloquea hasta
   * que `setItem` confirme la escritura. Los callers pueden ignorar el
   * return value (Button.onPress lo descarta), pero si navegan justo
   * después deben `await` para estar seguros — patrón idéntico al de
   * `commitIdentityAndStartDraft` (MGC-273) en HomepageCareerStarter.
   */
  startDraft: (seed?: number) => Promise<void>;
  swapLegend: () => Promise<void>;
  pickLegend: () => Promise<void>;
  /** Selector de club post-draft (MGC-208 §2). */
  pickClub: (club: Club) => Promise<void>;
  /** Loop anual (MGC-208 §3). */
  advanceSeason: () => Promise<void>;
  runCareerToRetirement: () => Promise<void>;
  /** MGC-227: hidrata la store desde AsyncStorage vía `loadCareerSave`.
   * Llamado una vez durante el bootstrap de la app (`app/_layout.tsx`).
   * Devuelve `true` si encontró un save previo y lo aplicó. */
  hydrateFromSave: () => Promise<boolean>;
  reset: () => void;
};

/**
 * Snapshot persistible (alineado con `CareerSaveState` salvo `clubId`,
 * que la store no expone — `profile.club.id` lo cubre). Lo construimos
 * desde el estado actual de la store en cada save.
 */
function snapshotToSave(s: CareerStore): {
  v: 1;
  stage: CareerSnapshot['stage'];
  profile: CareerSnapshot['profile'];
  draft: NonNullable<CareerSnapshot['draft']> | null;
  card: NonNullable<CareerSnapshot['card']> | null;
  clubId: string | null;
  log: NonNullable<CareerSnapshot['log']>;
  seed: number;
} {
  return {
    v: 1,
    stage: s.stage,
    profile: s.profile,
    draft: s.draft ?? null,
    card: s.card ?? null,
    clubId: s.profile.club ? s.profile.club.id : null,
    log: s.log ?? { timeline: [], events: [] },
    seed: s.seed ?? 0,
  };
}

/**
 * MGC-257 — handle a la save en curso (o la última). Se reusa entre
 * mutaciones: una nueva save espera a que termine la anterior (evita
 * race en `setItem`) y queda registrada para que un listener
 * `AppState` en `_layout.tsx` la pueda drenar antes de background
 * (revivir tras force-stop / kill OS). Antes era fire-and-forget: el
 * snapshot podía no llegar a disco si el proceso moría antes de que
 * `AsyncStorage.setItem` resolviera (AC7).
 */
let pendingSave: Promise<void> | null = null;

export function getPendingSave(): Promise<void> | null {
  return pendingSave;
}

/**
 * MGC-257 — drena la save pendiente. Llamado por el listener
 * `AppState` en `_layout.tsx` cuando el OS manda la app a background
 * (al briefcase switch, lockscreen, o force-stop inminente). Devuelve
 * la promesa resuelta cuando AsyncStorage confirmó la escritura, así
 * el snapshot queda en disco antes de que el proceso muera.
 */
export function flushPendingSave(): Promise<void> {
  if (!pendingSave) return Promise.resolve();
  return pendingSave;
}

/**
 * Persiste el snapshot actual encadenando la promesa en `pendingSave`
 * para que (a) llamadas concurrentes no pisen `setItem` y (b) un
 * `AppState` listener en `_layout.tsx` pueda esperar la escritura
 * completa antes de background. Errores de AsyncStorage (quota, red
 * en web fallback) no rompen la mutación de la store; la UI sigue
 * funcionando y el próximo save reintenta.
 */
function persistSnapshot(s: CareerStore): void {
  const next = saveCareerSave(snapshotToSave(s)).catch(() => {
    // Silencioso: persistencia best-effort. Loguear en QA si aparece
    // recurrentemente (hoy no hay logger central).
  });
  // MGC-277 review CTO: capturar la promesa compuesta en una variable
  // local para que la comparación de identidad (===) cierre
  // correctamente cuando hay saves encadenadas. Antes, `pendingSave`
  // apuntaba a la promesa compuesta en la segunda/tercera/... llamada
  // y `pendingSave === next` siempre era `false` — la cadena crecía
  // sin límite durante la sesión y `flushPendingSave()` terminaba
  // awaiteando toda la historia de saves en el path crítico del
  // force-stop (AC7).
  const chained = pendingSave ? pendingSave.then(() => next) : next;
  pendingSave = chained;
  void chained.finally(() => {
    if (pendingSave === chained) pendingSave = null;
  });
}

export const useCareerStore = create<CareerStore>()((set, get) => {
  // Adaptador para que `set((s) => ...)` siga funcionando con la firma
  // original de Zustand en la creación del store. Zustand set acepta
  // `(state: CareerStore) => CareerStore`, pero la lógica del simulador
  // trabaja sobre `CareerSnapshot` (sub-tipo). Forzamos vía `unknown`.
  const setSnapshot = (fn: (s: CareerSnapshot) => CareerSnapshot) =>
    set(fn as unknown as Parameters<typeof set>[0]);

  /** Helper: aplica una mutación al snapshot y persiste. */
  const applyAndPersist = (fn: (s: CareerSnapshot) => CareerSnapshot) => {
    setSnapshot(fn);
    persistSnapshot(get());
  };

  return {
    ...initialSnapshot(),
    // Setters livianos: identity-state, sin motor.
    setName: (name) => applyAndPersist((s) => ({ ...s, profile: { ...s.profile, name } })),
    setNumber: (number) =>
      applyAndPersist((s) => ({ ...s, profile: { ...s.profile, number } })),
    setPosition: (position) =>
      applyAndPersist((s) => ({ ...s, profile: { ...s.profile, position } })),
    setNationality: (code) =>
      applyAndPersist((s) => ({ ...s, profile: { ...s.profile, nationalityCode: code } })),
    setPreferredFoot: (foot) =>
      applyAndPersist((s) => ({ ...s, profile: { ...s.profile, preferredFoot: foot } })),
    // Transiciones de stage: pure helpers sin motor. Síncronas para
    // preservar el patrón `commitIdentity(); router.push('/dashboard')`
    // existente en identity.tsx, dashboard.tsx y academy.tsx.
    commitIdentity: () =>
      applyAndPersist((s) => ({ ...s, stage: 'dashboard' as const })),
    // MGC-249: combinamos commitIdentity + startDraft en un solo step para
    // garantizar atomicidad del snapshot persistido (no hay frame intermedio
    // con stage='dashboard' y sin draft que dispararía el bug original).
    // MGC-273: la acción ahora retorna la Promise del IIFE y AWAITA
    // `flushPendingSave()` antes de resolver. Ver rationale en el type
    // declaration arriba (AC1/AC2 MGC-270 — force-stop inmediato tras
    // "Empezar carrera" perdía el snapshot porque la persistencia quedaba
    // en vuelo).
    commitIdentityAndStartDraft: async (seed) => {
      const { step } = await import('@/features/career/engine');
      setSnapshot((s) =>
        step(s, { type: 'commitIdentityAndDraft', seed } satisfies CareerAction),
      );
      persistSnapshot(get());
      await flushPendingSave();
    },
    openAcademy: () =>
      applyAndPersist((s) => ({ ...s, stage: 'academy' as const })),
    acceptClub: (club) =>
      applyAndPersist((s) => ({
        ...s,
        stage: 'clubStart' as const,
        profile: {
          ...s.profile,
          club: club,
          clubPresupuesto: club.presupuesto,
          clubInteres: true,
        },
      })),
    // Acciones de simulación: dynamic import del engine. La navegación
    // ya ocurrió (la UI está en /dashboard), así que el update
    // asincrónico no rompe el flujo de pantalla.
    // MGC-284: ahora async + await flushPendingSave() para que cada
    // step del simulador bloquee hasta que AsyncStorage confirme la
    // escritura — antes fire-and-forget perdía el snapshot post
    // force-stop (AC4 — 8 rounds + force-stop).
    decide: async (strategyId, choiceId) => {
      const { step } = await import('@/features/career/engine');
      setSnapshot((s) =>
        step(s, { type: 'decide', strategyId, choiceId } satisfies CareerAction),
      );
      persistSnapshot(get());
      await flushPendingSave();
    },
    advance: async () => {
      const { step } = await import('@/features/career/engine');
      setSnapshot((s) => step(s, { type: 'advance' } satisfies CareerAction));
      persistSnapshot(get());
      await flushPendingSave();
    },
    // MGC-209: acciones del draft + loop anual + selector de club.
    // MGC-284: ahora async + await flushPendingSave — antes fire-and-
    // forget. Ver rationale en el type declaration arriba.
    startDraft: async (seed) => {
      const { step } = await import('@/features/career/engine');
      setSnapshot((s) =>
        step(s, { type: 'startDraft', seed } satisfies CareerAction),
      );
      persistSnapshot(get());
      await flushPendingSave();
    },
    swapLegend: async () => {
      const { step } = await import('@/features/career/engine');
      setSnapshot((s) => step(s, { type: 'swapLegend' } satisfies CareerAction));
      persistSnapshot(get());
      await flushPendingSave();
    },
    pickLegend: async () => {
      const { step } = await import('@/features/career/engine');
      setSnapshot((s) => step(s, { type: 'pickLegend' } satisfies CareerAction));
      persistSnapshot(get());
      await flushPendingSave();
    },
    pickClub: async (club) => {
      const { step } = await import('@/features/career/engine');
      setSnapshot((s) => step(s, { type: 'pickClub', club } satisfies CareerAction));
      persistSnapshot(get());
      await flushPendingSave();
    },
    advanceSeason: async () => {
      const { step } = await import('@/features/career/engine');
      setSnapshot((s) =>
        step(s, { type: 'advanceSeason' } satisfies CareerAction),
      );
      persistSnapshot(get());
      await flushPendingSave();
    },
    runCareerToRetirement: async () => {
      const { step } = await import('@/features/career/engine');
      setSnapshot((s) =>
        step(s, { type: 'runCareerToRetirement' } satisfies CareerAction),
      );
      // MGC-257 (AC7) — esta transición es el último step del flow y
      // el que estaba perdiéndose tras force-stop: el snapshot
      // quedaba en memoria pero `setItem` no resolvía antes de que
      // el proceso muriera. Forzamos un flush sincrónico del handle
      // pendingSave para que el `stage: 'retirement'` + log final
      // queden en AsyncStorage antes de que el usuario salga de la
      // pantalla.
      persistSnapshot(get());
      await flushPendingSave();
    },
    // MGC-227: hidratación desde AsyncStorage. Llamado una vez en el
    // bootstrap de la app (ver `app/_layout.native.tsx` + `_layout.web.tsx`).
    // Aplica el save al estado actual; si no hay save, devuelve `false`
    // y deja el initial. MGC-259: envolvemos `loadCareerSave` en try/catch
    // para que el `hydrateGate` en `_layout.*.tsx` SIEMPRE desbloquee
    // (un save corrupto o AsyncStorage roto no debe dejar la UI colgada
    // en el splash).
    hydrateFromSave: async () => {
      let saved;
      try {
        saved = await loadCareerSave();
      } catch {
        return false;
      }
      if (!saved) return false;
      setSnapshot((s) => ({
        ...s,
        stage: saved.stage,
        profile: saved.profile,
        draft: saved.draft ?? null,
        card: saved.card ?? null,
        log: saved.log,
        seed: saved.seed,
      }));
      return true;
    },
    // reset: estado inicial sin motor. Borra el save persistido.
    reset: () => {
      setSnapshot(() => initialSnapshot());
      void clearCareerSave().catch(() => {
        // best-effort: si falla el clear, el próximo save sobrescribe.
      });
    },
  };
});

/** Snapshot del estado sin suscribirse a cambios (helper para tests). */
export const getCareerSnapshot = (): CareerSnapshot => {
  const s = useCareerStore.getState();
  return { stage: s.stage, profile: s.profile };
};

export { isIdentityComplete };
