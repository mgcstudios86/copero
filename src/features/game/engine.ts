import type {
  Category,
  GameSnapshot,
  Round,
  RoundOutcome,
  Word,
} from '@/types/game';
import { pickRandomWords } from '@/features/game/words';
import { computeNewStreak, computePoints } from '@/features/game/scoring';

/**
 * FSM pura del juego. Sin React, sin timers. Toma un snapshot + acción
 * y devuelve un snapshot nuevo. Esto hace que el estado sea trivialmente
 * testeable y debuggeable.
 *
 *   idle → category → playing ⇄ roundEnd → gameEnd
 */

export const DEFAULT_TOTAL_ROUNDS = 10;
export const DEFAULT_ROUND_DURATION_MS = 30_000;

export type StartInput = {
  category: Category;
  totalRounds?: number;
  roundDurationMs?: number;
  rng?: () => number;
};

export type EngineAction =
  | { type: 'pickCategory' }
  | { type: 'startGame'; payload: StartInput }
  | {
      type: 'resolveRound';
      outcome: RoundOutcome;
      remainingMs: number;
    }
  | { type: 'nextRound' }
  | { type: 'reset' };

export const initialSnapshot = (): GameSnapshot => ({
  status: 'idle',
  currentCategory: null,
  currentWord: null,
  round: 0,
  totalRounds: DEFAULT_TOTAL_ROUNDS,
  score: 0,
  streak: 0,
  bestStreak: 0,
  timerMsRemaining: DEFAULT_ROUND_DURATION_MS,
  rounds: [],
});

const pickNextWord = (
  usedWords: readonly Word[],
  pool: readonly Word[],
): Word | null => {
  const remaining = pool.filter((w) => !usedWords.includes(w));
  if (remaining.length === 0) return null;
  const idx = Math.floor(Math.random() * remaining.length);
  return remaining[idx] ?? null;
};

export const step = (
  state: GameSnapshot,
  action: EngineAction,
): GameSnapshot => {
  switch (action.type) {
    case 'pickCategory':
      if (state.status !== 'idle' && state.status !== 'gameEnd') return state;
      return { ...state, status: 'category' };

    case 'startGame': {
      if (state.status !== 'idle' && state.status !== 'category' && state.status !== 'gameEnd') {
        return state;
      }
      const { category, totalRounds = DEFAULT_TOTAL_ROUNDS, roundDurationMs = DEFAULT_ROUND_DURATION_MS, rng = Math.random } = action.payload;
      const words = pickRandomWords(category, totalRounds, rng);
      const firstWord = words[0] ?? null;
      return {
        status: 'playing',
        currentCategory: category,
        currentWord: firstWord,
        round: firstWord ? 1 : 0,
        totalRounds,
        score: 0,
        streak: 0,
        bestStreak: 0,
        timerMsRemaining: roundDurationMs,
        rounds: [],
      };
    }

    case 'resolveRound': {
      if (state.status !== 'playing' || !state.currentWord || !state.currentCategory) {
        return state;
      }
      const { outcome, remainingMs } = action;
      const totalMs = DEFAULT_ROUND_DURATION_MS;
      const pointsAwarded = computePoints({
        outcome,
        remainingMs,
        totalMs,
        streakBefore: state.streak,
      });
      const newStreak = computeNewStreak(outcome, state.streak);
      const round: Round = {
        category: state.currentCategory,
        word: state.currentWord,
        startedAtMs: Date.now(),
        durationMs: totalMs,
        outcome,
        pointsAwarded,
      };
      return {
        ...state,
        status: 'roundEnd',
        score: state.score + pointsAwarded,
        streak: newStreak,
        bestStreak: Math.max(state.bestStreak, newStreak),
        timerMsRemaining: remainingMs,
        rounds: [...state.rounds, round],
      };
    }

    case 'nextRound': {
      if (state.status !== 'roundEnd' || !state.currentCategory) return state;
      if (state.round >= state.totalRounds) {
        return { ...state, status: 'gameEnd', currentWord: null };
      }
      const usedWords = state.rounds.map((r) => r.word);
      const pool = pickRandomWords(state.currentCategory, state.totalRounds);
      const nextWord = pickNextWord(usedWords, pool);
      if (!nextWord) return { ...state, status: 'gameEnd', currentWord: null };
      return {
        ...state,
        status: 'playing',
        round: state.round + 1,
        currentWord: nextWord,
        timerMsRemaining: DEFAULT_ROUND_DURATION_MS,
      };
    }

    case 'reset':
      return initialSnapshot();

    default:
      return state;
  }
};

/** Helper para tests: aplica una secuencia de acciones. */
export const runActions = (
  actions: readonly EngineAction[],
  start: GameSnapshot = initialSnapshot(),
): GameSnapshot => actions.reduce((s, a) => step(s, a), start);
