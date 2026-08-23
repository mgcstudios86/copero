import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storage } from '@/shared/store/storage';
import {
  initialSnapshot,
  step,
  DEFAULT_ROUND_DURATION_MS,
  DEFAULT_TOTAL_ROUNDS,
} from '@/features/game/engine';
import type { EngineAction } from '@/features/game/engine';
import type { GameSnapshot, Category } from '@/types/game';

type GameStore = GameSnapshot & {
  /** Mejor puntaje histórico, persistente entre sesiones. */
  highScore: number;
  startGame: (category: Category) => void;
  pickCategory: () => void;
  resolveRound: (outcome: 'correct' | 'skip' | 'timeout', remainingMs: number) => void;
  nextRound: () => void;
  reset: () => void;
  tickTimer: (ms: number) => void;
};

const baseSnapshot = initialSnapshot();

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      ...baseSnapshot,
      // Inicial: highScore arranca en 0; se recalcula en cada resolveRound.
      highScore: 0,

      startGame: (category) =>
        set((s: GameStore) =>
          step(s, {
            type: 'startGame',
            payload: {
              category,
              totalRounds: DEFAULT_TOTAL_ROUNDS,
              roundDurationMs: DEFAULT_ROUND_DURATION_MS,
            },
          }),
        ),

      pickCategory: () =>
        set((s: GameStore) => step(s, { type: 'pickCategory' })),

      resolveRound: (outcome, remainingMs) =>
        set((s: GameStore) => {
          const next = step(s, { type: 'resolveRound', outcome, remainingMs });
          // highScore se calcula como el máximo entre el histórico y el
          // score actualizado post-ronda. Mantiene el pico aun cuando el
          // jugador abandona la partida a mitad de camino.
          return {
            ...next,
            highScore: Math.max(s.highScore, next.score),
          };
        }),

      nextRound: () => set((s: GameStore) => step(s, { type: 'nextRound' })),

      reset: () =>
        set((s: GameStore) => ({ ...initialSnapshot(), highScore: s.highScore })),

      tickTimer: (ms: number) => set({ timerMsRemaining: Math.max(0, ms) }),
    }),
    {
      name: 'copero-game',
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({
        // Persistimos el high score real (no el score de la última partida,
        // que es engañoso). bestStreak también persiste.
        highScore: state.highScore,
        bestStreak: state.bestStreak,
        // No persistimos currentWord ni status para evitar juegos "zombie"
        // al volver tras background.
      }),
    },
  ),
);

/** Helper para tests: snapshot del estado sin suscribirse a cambios. */
export const getGameSnapshot = (): GameSnapshot & { highScore: number } => {
  const s = useGameStore.getState();
  return {
    status: s.status,
    currentCategory: s.currentCategory,
    currentWord: s.currentWord,
    round: s.round,
    totalRounds: s.totalRounds,
    score: s.score,
    streak: s.streak,
    bestStreak: s.bestStreak,
    timerMsRemaining: s.timerMsRemaining,
    roundDurationMs: s.roundDurationMs,
    rounds: s.rounds,
    highScore: s.highScore,
  };
};

// Re-export para no acoplar consumidores al FSM.
export type { EngineAction };
