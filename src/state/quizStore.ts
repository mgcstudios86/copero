/**
 * Store Zustand del Ideología Futbolística.
 *
 * Modelo mínimo y testeable:
 *   - `phase`: 'splash' | 'playing' | 'done'
 *   - `answers`: mapa { [questionId]: OptionId }
 *   - `currentIndex`: 0..14 durante 'playing'
 *
 * Persistencia: las respuestas se guardan en `sessionStorage`/`AsyncStorage`
 * (sin PII, sólo progreso del quiz) para que cerrar y reabrir la app conserve
 * el punto en el que el usuario estaba. El resultado se recalcula en runtime,
 * no se persiste.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Platform } from 'react-native';
import { QUESTIONS, type OptionId, getOption, type Option } from '@/data/questions';
import { storage, key } from '@/lib/storage';

export type Phase = 'splash' | 'playing' | 'done';

export type QuizState = {
  phase: Phase;
  currentIndex: number;
  answers: Record<string, OptionId>;
  /** Hidratar resultado en runtime para no persistirlo. */
  lastResultKey: string | null;
};

export type QuizActions = {
  start: () => void;
  answer: (questionId: string, optionId: OptionId) => void;
  next: () => void;
  previous: () => void;
  finish: () => void;
  reset: () => void;
};

export type QuizStore = QuizState & QuizActions;

const initialState: QuizState = {
  phase: 'splash',
  currentIndex: 0,
  answers: {},
  lastResultKey: null,
};

/** Web: sessionStorage (no localStorage) según el spec. Nativo: AsyncStorage. */
const sessionStorageImpl = {
  getItem: (k: string) =>
    typeof window === 'undefined'
      ? Promise.resolve(null)
      : Promise.resolve(window.sessionStorage?.getItem(k) ?? null),
  setItem: (k: string, v: string) => {
    if (typeof window === 'undefined') return Promise.resolve();
    window.sessionStorage?.setItem(k, v);
    return Promise.resolve();
  },
  removeItem: (k: string) => {
    if (typeof window === 'undefined') return Promise.resolve();
    window.sessionStorage?.removeItem(k);
    return Promise.resolve();
  },
};

const persistStorage =
  Platform.OS === 'web'
    ? createJSONStorage(() => sessionStorageImpl)
    : createJSONStorage(() => storage);

const TOTAL = QUESTIONS.length;

export const useQuizStore = create<QuizStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      start: () => {
        set({ phase: 'playing', currentIndex: 0 });
      },

      answer: (questionId, optionId) => {
        const { answers } = get();
        set({
          answers: { ...answers, [questionId]: optionId },
          lastResultKey: key(questionId),
        });
      },

      next: () => {
        const { currentIndex, phase } = get();
        if (phase !== 'playing') return;
        const nextIdx = Math.min(currentIndex + 1, TOTAL - 1);
        if (currentIndex === TOTAL - 1) {
          set({ phase: 'done' });
          return;
        }
        set({ currentIndex: nextIdx });
      },

      previous: () => {
        const { currentIndex, phase } = get();
        if (phase !== 'playing') return;
        set({ currentIndex: Math.max(currentIndex - 1, 0) });
      },

      finish: () => {
        set({ phase: 'done' });
      },

      reset: () => {
        set({ ...initialState });
      },
    }),
    {
      name: key('quiz'),
      storage: persistStorage,
      partialize: (state) => ({
        phase: state.phase,
        currentIndex: state.currentIndex,
        answers: state.answers,
      }),
      version: 1,
    },
  ),
);

/** Helper puro para tests / consumidores no-React: lista de opciones respondidas. */
export function answeredList(
  answers: Record<string, OptionId>,
): Option[] {
  const list: Option[] = [];
  for (const q of QUESTIONS) {
    const oid = answers[q.id];
    if (!oid) continue;
    list.push(getOption(q, oid));
  }
  return list;
}