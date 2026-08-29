// src/shared/store/careerStore.ts — Copero (MGC-543 code-split)
//
// Store de Zustand para el state machine del simulador de carrera. MGC-543
// separa la lógica de identidad (liviana, sin motor) de las acciones de
// simulación (pesadas, requieren `engine.ts` → `simulation.ts` → `strategy.ts`).
//
// Antes: el store importaba `step` estáticamente desde `@/features/career/engine`.
// Esto arrastraba `strategy.ts` (378 líneas) al chunk inicial de
// /simulador-carrera/identity (1.29 MB uncompressed / 412 KB gz).
//
// Ahora:
// - Setters de identidad (setName/Number/Position/Nationality/Foot) usan
//   funciones puras de `@/features/career/identity-state` (sin motor).
// - Transiciones de stage (commitIdentity, openAcademy, acceptClub) son
//   funciones puras inline (sin motor). Mantienen semántica síncrona para
//   que `commitIdentity(); router.push(...)` siga funcionando como antes.
// - Acciones de simulación (decide, advance) resuelven `step` vía dynamic
//   import() de `@/features/career/engine`. El chunk del motor se carga
//   sólo cuando el usuario navega al dashboard e interactúa con el
//   timeline. La UI ya navegó para entonces, así que el update puede ser
//   asincrónico.
// - reset vuelve al initial snapshot (sin motor).
//
// Acceptance criteria MGC-543: transfer /identity <= 415 KB. Esta refactor
// apunta a sacar ~120 KB de strategy+simulation+reputation del entry chunk.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storage } from '@/shared/store/storage';
import {
  initialSnapshot,
  isIdentityComplete,
  setName as setNamePure,
  setNumber as setNumberPure,
  setPosition as setPositionPure,
  setNationality as setNationalityPure,
  setPreferredFoot as setPreferredFootPure,
} from '@/features/career/identity-state';
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
  reset: () => void;
};

/**
 * Lazy-load del reducer de simulación para acciones pesadas (decide,
 * advance). El chunk del motor llega vía dynamic import() la primera vez
 * que se llama una acción de simulación. Mantener fuera de los handlers
 * de identidad garantiza que `engine.ts` no quede en el bundle inicial de
 * /simulador-carrera/identity.
 */

export const useCareerStore = create<CareerStore>()(
  persist(
    (set) => {
      // Adaptador para que `set((s) => ...)` siga funcionando con la firma
      // original de Zustand en la creación del store. Zustand set acepta
      // `(state: CareerStore) => CareerStore`, pero la lógica del simulador
      // trabaja sobre `CareerSnapshot` (sub-tipo). Forzamos vía `unknown`.
      const setSnapshot = (fn: (s: CareerSnapshot) => CareerSnapshot) =>
        set(fn as unknown as Parameters<typeof set>[0]);
      return {
        ...initialSnapshot(),
        // Setters livianos: identity-state, sin motor.
        setName: (name) => setSnapshot((s) => setNamePure(s, name)),
        setNumber: (number) => setSnapshot((s) => setNumberPure(s, number)),
        setPosition: (position) => setSnapshot((s) => setPositionPure(s, position)),
        setNationality: (code) => setSnapshot((s) => setNationalityPure(s, code)),
        setPreferredFoot: (foot) => setSnapshot((s) => setPreferredFootPure(s, foot)),
        // Transiciones de stage: pure helpers sin motor. Síncronas para
        // preservar el patrón `commitIdentity(); router.push('/dashboard')`
        // existente en identity.tsx, dashboard.tsx y academy.tsx.
        commitIdentity: () =>
          setSnapshot((s) => ({ ...s, stage: 'dashboard' as const })),
        openAcademy: () =>
          setSnapshot((s) => ({ ...s, stage: 'academy' as const })),
        acceptClub: (club) =>
          setSnapshot((s) => ({
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
          })();
        },
        advance: () => {
          void (async () => {
            const { step } = await import('@/features/career/engine');
            setSnapshot((s) => step(s, { type: 'advance' } satisfies CareerAction));
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
          })();
        },
        swapLegend: () => {
          void (async () => {
            const { step } = await import('@/features/career/engine');
            setSnapshot((s) => step(s, { type: 'swapLegend' } satisfies CareerAction));
          })();
        },
        pickLegend: () => {
          void (async () => {
            const { step } = await import('@/features/career/engine');
            setSnapshot((s) => step(s, { type: 'pickLegend' } satisfies CareerAction));
          })();
        },
        pickClub: (club) => {
          void (async () => {
            const { step } = await import('@/features/career/engine');
            setSnapshot((s) => step(s, { type: 'pickClub', club } satisfies CareerAction));
          })();
        },
        advanceSeason: () => {
          void (async () => {
            const { step } = await import('@/features/career/engine');
            setSnapshot((s) =>
              step(s, { type: 'advanceSeason' } satisfies CareerAction),
            );
          })();
        },
        runCareerToRetirement: () => {
          void (async () => {
            const { step } = await import('@/features/career/engine');
            setSnapshot((s) =>
              step(s, { type: 'runCareerToRetirement' } satisfies CareerAction),
            );
          })();
        },
        // reset: estado inicial sin motor.
        reset: () => setSnapshot(() => initialSnapshot()),
      };
    },
    {
      name: 'copero-career',
      storage: createJSONStorage(() => storage),
      partialize: (state): CareerSnapshot => ({
        stage: state.stage,
        profile: state.profile,
        draft: state.draft ?? null,
        card: state.card ?? null,
        log: state.log ?? { timeline: [], events: [] },
        seed: state.seed,
      }),
    },
  ),
);

/** Snapshot del estado sin suscribirse a cambios (helper para tests). */
export const getCareerSnapshot = (): CareerSnapshot => {
  const s = useCareerStore.getState();
  return { stage: s.stage, profile: s.profile };
};

export { isIdentityComplete };
