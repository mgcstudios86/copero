import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storage } from '@/shared/store/storage';
import { step, initialSnapshot, isIdentityComplete } from '@/features/career/engine';
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
  reset: () => void;
};

export const useCareerStore = create<CareerStore>()(
  persist(
    (set) => ({
      ...initialSnapshot(),
      setName: (name) => set((s) => step(s, { type: 'setName', name } satisfies CareerAction)),
      setNumber: (number) => set((s) => step(s, { type: 'setNumber', number } satisfies CareerAction)),
      setPosition: (position) => set((s) => step(s, { type: 'setPosition', position } satisfies CareerAction)),
      setNationality: (code) => set((s) => step(s, { type: 'setNationality', code } satisfies CareerAction)),
      setPreferredFoot: (foot) => set((s) => step(s, { type: 'setPreferredFoot', foot } satisfies CareerAction)),
      commitIdentity: () => set((s) => step(s, { type: 'commitIdentity' } satisfies CareerAction)),
      openAcademy: () => set((s) => step(s, { type: 'openAcademy' } satisfies CareerAction)),
      acceptClub: (club) => set((s) => step(s, { type: 'acceptClub', club } satisfies CareerAction)),
      decide: (strategyId, choiceId) =>
        set((s) => step(s, { type: 'decide', strategyId, choiceId } satisfies CareerAction)),
      advance: () => set((s) => step(s, { type: 'advance' } satisfies CareerAction)),
      reset: () => set(() => step(initialSnapshot(), { type: 'reset' } satisfies CareerAction)),
    }),
    {
      name: 'copero-career',
      storage: createJSONStorage(() => storage),
      partialize: (state): CareerSnapshot => ({
        stage: state.stage,
        profile: state.profile,
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