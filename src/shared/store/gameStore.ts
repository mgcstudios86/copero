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
import { useGameStatsStore } from '@/shared/store/gameStatsStore';

/**
 * MGC-782 code-split: el store del juego ya no arrastra el engine al entry
 * chunk del home. Las stats persistidas (`highScore`, `bestStreak`) viven
 * en `useGameStatsStore` (ver gameStatsStore.ts). El home las lee desde
 * ahí. Este store mantiene el estado EFÍMERO de la partida + las acciones
 * que llaman al FSM. El engine sigue siendo required aquí, pero sólo los
 * game routes (categoria, ronda, fin, compass) lo importan. El home NO
 * toca este store.
 *
 * Write-through: cada `resolveRound`/`reset` actualiza useGameStatsStore si
 * supera el máximo persistido. Así el home lee la versión actualizada sin
 * tener que importar el engine.
 */

type GameStore = GameSnapshot & {
  /** Espejo en memoria del highScore persistido en useGameStatsStore. */
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
    (set, get) => ({
      ...baseSnapshot,
      // highScore se inicializa desde el store persistente de stats (MGC-782).
      // Si la persistencia todavía no hidrató, cae al default 0.
      highScore: useGameStatsStore.getState().highScore,

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
          const newHighScore = Math.max(s.highScore, next.score);
          const newBestStreak = Math.max(s.bestStreak, next.bestStreak);
          // MGC-782: write-through al store persistente de stats para que el
          // home lo lea sin importar el engine.
          if (newHighScore > useGameStatsStore.getState().highScore) {
            useGameStatsStore.getState().setHighScore(newHighScore);
          }
          if (newBestStreak > useGameStatsStore.getState().bestStreak) {
            useGameStatsStore.getState().setBestStreak(newBestStreak);
          }
          return {
            ...next,
            highScore: newHighScore,
            bestStreak: newBestStreak,
          };
        }),

      nextRound: () => set((s: GameStore) => step(s, { type: 'nextRound' })),

      reset: () => {
        // Persistir el pico final antes de resetear el estado efímero.
        const { highScore, bestStreak } = get();
        if (highScore > useGameStatsStore.getState().highScore) {
          useGameStatsStore.getState().setHighScore(highScore);
        }
        if (bestStreak > useGameStatsStore.getState().bestStreak) {
          useGameStatsStore.getState().setBestStreak(bestStreak);
        }
        set(() => ({ ...initialSnapshot(), highScore, bestStreak }));
      },

      tickTimer: (ms: number) => set({ timerMsRemaining: Math.max(0, ms) }),
    }),
    {
      name: 'copero-game',
      storage: createJSONStorage(() => storage),
      // MGC-782: highScore/bestStreak se persisten en `copero-game-stats`
      // vía useGameStatsStore. Esta store no persiste nada (estado efímero).
      partialize: () => ({}),
    },
  ),
);

/** Helper para tests: snapshot del estado sin suscribirse a cambios. */
export const getGameSnapshot = () => {
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
