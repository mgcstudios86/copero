import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storage } from '@/shared/store/storage';

/**
 * MGC-782 code-split: stats del juego separados del store del motor.
 *
 * El home sólo necesita `highScore` y `bestStreak` para mostrar el resumen
 * "Mejor partida" del hero. Antes los leía de `useGameStore`, que arrastra
 * `@/features/game/engine` (FSM + scoring + categories + 142 líneas de
 * palabras) al entry chunk del home. Esa cadena suma ~25-40 KB gz al bundle
 * inicial, sin que el usuario ejecute ninguna acción del juego en `/`.
 *
 * Solución: stats persistidos en su propio store sin dependencias del
 * engine. `useGameStore` (game routes) sigue manejando el estado efímero
 * de la partida y escribe highScore/bestStreak en este store al cierre.
 *
 * La persistencia cambia key de `copero-game` a `copero-game-stats` para
 * no contaminar el state shape. La migración se aplica una vez: Zustand
 * persiste el primer store que escribe la key nueva. El viejo
 * `copero-game` queda huérfano en `localStorage` y la app lo ignora.
 */

type GameStatsStore = {
  highScore: number;
  bestStreak: number;
  setHighScore: (n: number) => void;
  setBestStreak: (n: number) => void;
};

export const useGameStatsStore = create<GameStatsStore>()(
  persist(
    (set) => ({
      highScore: 0,
      bestStreak: 0,
      setHighScore: (n) => set({ highScore: Math.max(0, n) }),
      setBestStreak: (n) => set({ bestStreak: Math.max(0, n) }),
    }),
    {
      name: 'copero-game-stats',
      storage: createJSONStorage(() => storage),
    },
  ),
);
