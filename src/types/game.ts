/**
 * Tipos compartidos del juego Copero.
 * El estado de juego es una FSM pura, sin dependencias de React/RN.
 */

export const CATEGORIES = [
  'futbol',
  'musica',
  'geografia',
  'comida',
  'animales',
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Word = {
  readonly text: string;
  readonly hint?: string;
};

export type GameStatus =
  | 'idle'
  | 'category'
  | 'playing'
  | 'roundEnd'
  | 'gameEnd';

export type RoundOutcome = 'correct' | 'skip' | 'timeout';

export type Round = {
  readonly category: Category;
  readonly word: Word;
  readonly startedAtMs: number;
  readonly durationMs: number;
  readonly outcome: RoundOutcome | null;
  readonly pointsAwarded: number;
};

export type GameSnapshot = {
  status: GameStatus;
  currentCategory: Category | null;
  currentWord: Word | null;
  round: number;
  totalRounds: number;
  score: number;
  streak: number;
  bestStreak: number;
  timerMsRemaining: number;
  roundDurationMs: number;
  rounds: Round[];
};
