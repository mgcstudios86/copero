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
  openAcademy: () => void;
  acceptClub: (club: Club) => void;
  decide: (strategyId: StrategyId, choiceId: string) => void;
  advance: () => void;
  /** Draft de leyendas (MGC-208 §1) — MGC-209. */
  startDraft: (seed?: number) => void;
  swapLegend: () => void;
  pickLegend: () => void;
  /** Selector de club post-draft (MGC-208 §2). */
  pickClub: (club: Club) => void;
  /** Loop anual (MGC-208 §3). */
  advanceSeason: () => void;
  runCareerToRetirement: () => void;
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
 * Persiste el snapshot actual. Fire-and-forget: errores de AsyncStorage
 * (quota, red en web fallback) no rompen la mutación de la store. La
 * UI sigue funcionando; el próximo save reintenta.
 */
function persistSnapshot(s: CareerStore): void {
  void saveCareerSave(snapshotToSave(s)).catch(() => {
    // Silencioso: persistencia best-effort. Loguear en QA si aparece
    // recurrentemente (hoy no hay logger central).
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
    decide: (strategyId, choiceId) => {
      void (async () => {
        const { step } = await import('@/features/career/engine');
        setSnapshot((s) =>
          step(s, { type: 'decide', strategyId, choiceId } satisfies CareerAction),
        );
        persistSnapshot(get());
      })();
    },
    advance: () => {
      void (async () => {
        const { step } = await import('@/features/career/engine');
        setSnapshot((s) => step(s, { type: 'advance' } satisfies CareerAction));
        persistSnapshot(get());
      })();
    },
    // MGC-209: acciones del draft + loop anual + selector de club.
    // Todas usan el mismo patrón de dynamic import del motor para
    // preservar el code-split del chunk inicial de /identity.
    startDraft: (seed) => {
      void (async () => {
        const { step } = await import('@/features/career/engine');
        setSnapshot((s) =>
          step(s, { type: 'startDraft', seed } satisfies CareerAction),
        );
        persistSnapshot(get());
      })();
    },
    swapLegend: () => {
      void (async () => {
        const { step } = await import('@/features/career/engine');
        setSnapshot((s) => step(s, { type: 'swapLegend' } satisfies CareerAction));
        persistSnapshot(get());
      })();
    },
    pickLegend: () => {
      void (async () => {
        const { step } = await import('@/features/career/engine');
        setSnapshot((s) => step(s, { type: 'pickLegend' } satisfies CareerAction));
        persistSnapshot(get());
      })();
    },
    pickClub: (club) => {
      void (async () => {
        const { step } = await import('@/features/career/engine');
        setSnapshot((s) => step(s, { type: 'pickClub', club } satisfies CareerAction));
        persistSnapshot(get());
      })();
    },
    advanceSeason: () => {
      void (async () => {
        const { step } = await import('@/features/career/engine');
        setSnapshot((s) =>
          step(s, { type: 'advanceSeason' } satisfies CareerAction),
        );
        persistSnapshot(get());
      })();
    },
    runCareerToRetirement: () => {
      void (async () => {
        const { step } = await import('@/features/career/engine');
        setSnapshot((s) =>
          step(s, { type: 'runCareerToRetirement' } satisfies CareerAction),
        );
        persistSnapshot(get());
      })();
    },
    // MGC-227: hidratación desde AsyncStorage. Llamado una vez en el
    // bootstrap de la app (ver `app/_layout.tsx`). Aplica el save al
    // estado actual; si no hay save, devuelve `false` y deja el initial.
    hydrateFromSave: async () => {
      const saved = await loadCareerSave();
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
