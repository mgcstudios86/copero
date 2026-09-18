// src/shared/store/matchStore.ts — MGC-1650 (WF4 + WF5 partido y post-partido).
//
// Store **transitorio** (no persistido) que sostiene el outcome de un
// partido entre las pantallas `/match` y `/post-match`. Es el único
// lugar donde vive el `MatchOutcome` congelado y los deltas preview
// (ovr/moral/fisico/confianza/reputation) ANTES de que el usuario
// confirme «Siguiente semana →».
//
// Reglas:
// - **No persistido**: si el usuario force-stopea la app entre
//   `/match` y la confirmación en `/post-match`, el outcome se pierde
//   y `careerStore` queda intacto (la AC §"Cleanup verificado" lo
//   requiere explícitamente). Re-entrar a `/match` desde el dashboard
//   dispara `startMatch()` de nuevo y regenera el outcome via
//   `resolveWeeklyMatch` con el RNG determinista por (week, season).
// - **Cleanup obligatorio**: el useEffect de ambas screens llama
//   `reset()` en cleanup si `committed === false`.
// - **Idempotencia**: `commit()` flippea `committed=true` y limpia el
//   resto del estado.

import { create } from 'zustand';
import type { MatchOutcome } from '@/features/career/match';
import type { PlayerProfile } from '@/types/career';

export type PostMatchPreview = {
  rating: number;
  moralDelta: number;
  fisicoDelta: number;
  confianzaDelta: number;
  reputationChanged: boolean;
  cleanSheet: boolean;
  goals: number;
  score: number;
};

/**
 * MGC-245 — alineación táctica que el usuario elige en `/alineacion`
 * antes del partido. Es state transitorio (mismo lifecycle que `outcome`):
 * vive entre la pantalla de selección y `commitMatch()`. `null` significa
 * "aún no eligió" (estado inicial); la pantalla `/alineacion` flagea
 * el CTA como deshabilitado hasta que se setee uno de los 3 valores.
 *
 * Las 3 opciones reusan los labels canónicos de `match_m1_*` en la
 * copy matrix: conservadora / todo / lider. La selección queda
 * persistida como metadata visible en `/match` (chip "Alineación: …")
 * para que el usuario vea retrospectivamente qué eligió.
 *
 * Honesto: por ahora la elección NO muta el cálculo de outcome —
 * `resolveWeeklyMatch` sigue siendo determinista por (week, season).
 * El delta visible en `/alineacion` describe el trade-off
 * (conservadora = menos riesgo / todo = más gol / lider = más moral)
 * pero el resultado numérico del partido no se altera todavía. Esto
 * evita prometer AC que requieren tocar el motor sin haberlo hecho.
 * El delta es read-only display; el siguiente paso del scope (no acá)
 * cablea el alignment al cálculo de outcome.
 */
export type Alignment = 'conservadora' | 'todo' | 'lider';

type MatchStore = {
  outcome: MatchOutcome | null;
  previousProfile: PlayerProfile | null;
  nextProfile: PlayerProfile | null;
  preview: PostMatchPreview | null;
  alignment: Alignment | null;
  committed: boolean;

  setMatch: (params: {
    outcome: MatchOutcome;
    previousProfile: PlayerProfile;
    nextProfile: PlayerProfile;
    preview: PostMatchPreview;
  }) => void;
  /** MGC-245 — setea la alineación táctica elegida por el usuario.
   * `null` resetea (re-entry a `/alineacion` antes de elegir). */
  setAlignment: (alignment: Alignment | null) => void;
  commit: () => void;
  reset: () => void;
};

const EMPTY: Pick<
  MatchStore,
  | 'outcome'
  | 'previousProfile'
  | 'nextProfile'
  | 'preview'
  | 'alignment'
  | 'committed'
> = {
  outcome: null,
  previousProfile: null,
  nextProfile: null,
  preview: null,
  alignment: null,
  committed: false,
};

export const useMatchStore = create<MatchStore>()((set) => ({
  ...EMPTY,
  setMatch: ({ outcome, previousProfile, nextProfile, preview }) =>
    set((s) => ({
      outcome,
      previousProfile,
      nextProfile,
      preview,
      // MGC-245 — `setMatch` (que llama `startMatch` desde careerStore)
      // NO pisa la alineación: si el usuario ya eligió en `/alineacion`
      // y navega a `/match`, el chip debe seguir mostrando la elección.
      // El reset de `alignment` se hace explícitamente vía `reset()`
      // cuando el flow termina (commit o discard).
      alignment: s.alignment,
      committed: false,
    })),
  // MGC-245 — setea la alineación. Idempotente: setear el mismo valor
  // dos veces no dispara un re-render (Zustand shallow-eq por default).
  setAlignment: (alignment) => set({ alignment }),
  commit: () =>
    set((s) =>
      s.committed
        ? s
        : {
            ...EMPTY,
            committed: true,
          },
    ),
  reset: () => set({ ...EMPTY }),
}));

export function getMatchStoreState(): MatchStore {
  return useMatchStore.getState();
}