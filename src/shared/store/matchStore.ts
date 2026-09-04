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

type MatchStore = {
  outcome: MatchOutcome | null;
  previousProfile: PlayerProfile | null;
  nextProfile: PlayerProfile | null;
  preview: PostMatchPreview | null;
  committed: boolean;

  setMatch: (params: {
    outcome: MatchOutcome;
    previousProfile: PlayerProfile;
    nextProfile: PlayerProfile;
    preview: PostMatchPreview;
  }) => void;
  commit: () => void;
  reset: () => void;
};

const EMPTY: Pick<
  MatchStore,
  'outcome' | 'previousProfile' | 'nextProfile' | 'preview' | 'committed'
> = {
  outcome: null,
  previousProfile: null,
  nextProfile: null,
  preview: null,
  committed: false,
};

export const useMatchStore = create<MatchStore>()((set) => ({
  ...EMPTY,
  setMatch: ({ outcome, previousProfile, nextProfile, preview }) =>
    set({
      outcome,
      previousProfile,
      nextProfile,
      preview,
      committed: false,
    }),
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