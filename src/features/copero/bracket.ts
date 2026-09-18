/**
 * src/features/copero/bracket.ts — MGC-490
 *
 * Generador determinista del bracket de la copa nacional (32 → 16 → 8 → semis → final).
 * RNG seeded por `seed` (string) → `seedRandom(seed)` produce floats [0,1).
 * Siembra equipos por ranking: el seed #1 va a la posición 0 del bracket, etc.
 *
 * Si `teams < 32`, ajusta a la potencia de 2 más cercana con byes automáticos
 * (seeds más altos reciben el bye en la primera ronda). Ver `bracket.test.ts`.
 */

export type BracketPhase = 'round_of_32' | 'round_of_16' | 'quarterfinal' | 'semifinal' | 'final';

export const PHASE_ORDER: BracketPhase[] = [
  'round_of_32',
  'round_of_16',
  'quarterfinal',
  'semifinal',
  'final',
];

export const PHASE_LABEL_ES: Record<BracketPhase, string> = {
  round_of_32: '32avos',
  round_of_16: 'Octavos',
  quarterfinal: 'Cuartos',
  semifinal: 'Semis',
  final: 'Final',
};

export type TeamId = string;

export type Match = {
  /** Stable match id, e.g. "R32-M3". */
  id: string;
  phase: BracketPhase;
  /** Index within the phase (0-based). */
  index: number;
  home: TeamId | null;
  away: TeamId | null;
  /** Winner once resolved; null if pending or TBD from previous round. */
  winner: TeamId | null;
  /** True if one side is a bye (auto-advance). */
  isBye: boolean;
};

export type Bracket = {
  /** Seed used to make generation reproducible. */
  seed: string;
  /** Phase order matches PHASE_ORDER. */
  rounds: Record<BracketPhase, Match[]>;
  /** True if bracket was generated with fewer than 32 teams (some byes). */
  hadByes: boolean;
};

const PHASE_SIZE: Record<BracketPhase, number> = {
  round_of_32: 32,
  round_of_16: 16,
  quarterfinal: 8,
  semifinal: 4,
  final: 2,
};

function nextPowerOf2(n: number): number {
  if (n < 2) return 2;
  let p = 2;
  while (p < n) p *= 2;
  return p;
}

/**
 * Mulberry32 — fast, seedable, deterministic PRNG.
 * Returns a function that yields uniform floats in [0, 1).
 */
export function seedRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher–Yates shuffle with a seeded RNG. Mutates a copy of `arr`.
 */
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/**
 * Generate a full bracket with 5 rounds. `teams` are seeded by their position
 * in the array (index 0 = top seed). If fewer than 32 teams are supplied the
 * bracket collapses to the next power of two and the highest seeds get byes.
 */
export function generateBracket(teams: TeamId[], seed: string): Bracket {
  if (teams.length < 2) {
    throw new Error('generateBracket: at least 2 teams required');
  }

  const targetSize = PHASE_SIZE.round_of_32;
  const bracketSize = nextPowerOf2(Math.max(teams.length, 2));
  const hadByes = teams.length < targetSize;
  const rng = seedRandom(seed);

  // Pad with null for byes.
  const padded: (TeamId | null)[] = teams.slice();
  while (padded.length < bracketSize) padded.push(null);

  // Top seeds vs lowest seeds (standard tournament seeding).
  const seededOrder: (TeamId | null)[] = [];
  const half = bracketSize / 2;
  for (let i = 0; i < half; i++) {
    seededOrder.push(padded[i]);
    seededOrder.push(padded[bracketSize - 1 - i]);
  }

  // Shuffle within pairs so identical seeds don't always face same opponent;
  // keeps determinism via `seed`.
  const finalOrder = shuffle(seededOrder, rng);

  const round32: Match[] = [];
  for (let i = 0; i < bracketSize / 2; i++) {
    const home = finalOrder[i * 2];
    const away = finalOrder[i * 2 + 1];
    round32.push({
      id: `R32-M${i + 1}`,
      phase: 'round_of_32',
      index: i,
      home,
      away,
      winner: home != null && away == null ? home : home == null && away != null ? away : null,
      isBye: home == null || away == null,
    });
  }

  const round16: Match[] = buildNextRound(round32, 'round_of_16');
  const quarters: Match[] = buildNextRound(round16, 'quarterfinal');
  const semis: Match[] = buildNextRound(quarters, 'semifinal');
  const finalRound: Match[] = buildNextRound(semis, 'final');

  return {
    seed,
    hadByes,
    rounds: {
      round_of_32: round32,
      round_of_16: round16,
      quarterfinal: quarters,
      semifinal: semis,
      final: finalRound,
    },
  };
}

function buildNextRound(prev: Match[], phase: BracketPhase): Match[] {
  const out: Match[] = [];
  for (let i = 0; i < prev.length; i += 2) {
    const a = prev[i];
    const b = prev[i + 1];
    out.push({
      id: `${phase.toUpperCase()}-M${i / 2 + 1}`,
      phase,
      index: i / 2,
      home: a?.winner ?? null,
      away: b?.winner ?? null,
      winner: null,
      isBye: false,
    });
  }
  return out;
}

/**
 * Apply a result to a match. Returns a new bracket (immutable update).
 */
export function applyResult(bracket: Bracket, matchId: string, winner: TeamId): Bracket {
  const phase = bracket.rounds.round_of_32.find((m) => m.id === matchId)?.phase
    ?? bracket.rounds.round_of_16.find((m) => m.id === matchId)?.phase
    ?? bracket.rounds.quarterfinal.find((m) => m.id === matchId)?.phase
    ?? bracket.rounds.semifinal.find((m) => m.id === matchId)?.phase
    ?? bracket.rounds.final.find((m) => m.id === matchId)?.phase;

  if (!phase) throw new Error(`applyResult: match ${matchId} not found`);

  const updated = bracket.rounds[phase].map((m) => {
    if (m.id !== matchId) return m;
    if (m.home !== winner && m.away !== winner) {
      throw new Error(`applyResult: ${winner} is not a participant of ${matchId}`);
    }
    return { ...m, winner };
  });

  const nextRounds = { ...bracket.rounds, [phase]: updated };

  // Propagate winner to next round if applicable.
  const order = PHASE_ORDER.indexOf(phase);
  if (order < PHASE_ORDER.length - 1) {
    const nextPhase = PHASE_ORDER[order + 1];
    const idx = updated.findIndex((m) => m.id === matchId);
    const target = Math.floor(idx / 2);
    const side: 'home' | 'away' = idx % 2 === 0 ? 'home' : 'away';
    nextRounds[nextPhase] = nextRounds[nextPhase].map((m, i) =>
      i === target ? { ...m, [side]: winner } : m,
    );
  }

  return { ...bracket, rounds: nextRounds };
}

/** True when the whole bracket is resolved (final has a winner). */
export function isBracketComplete(bracket: Bracket): boolean {
  const finalMatch = bracket.rounds.final[0];
  return finalMatch?.winner != null;
}

/**
 * True when every match in `phase` has a winner (byes already counted).
 * Independent of `isBracketComplete`: a phase may be complete while the
 * overall bracket still has rounds to play.
 */
export function isPhaseComplete(bracket: Bracket, phase: BracketPhase): boolean {
  const matches = bracket.rounds[phase];
  return matches.length > 0 && matches.every((m) => m.winner != null);
}

/** Returns the champion team id or null if not yet decided. */
export function getChampion(bracket: Bracket): TeamId | null {
  return bracket.rounds.final[0]?.winner ?? null;
}

/** Total number of rounds in PHASE_ORDER. */
export const ROUND_COUNT = PHASE_ORDER.length;
