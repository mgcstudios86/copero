/**
 * src/features/copero/slot.ts — MGC-490
 *
 * Slot local para Modo Copero. State global en memoria (módulo-scope) con
 * patrón subscribe. La persistencia al AsyncStorage vive en
 * `persistence.ts` (futuro); este módulo cubre el state machine in-memory
 * para los 3 screens del flow sin tocar careerStore.
 *
 * Estados:
 *   - 'idle'        → sin slot activo (banner oculto)
 *   - 'inscribed'   → copa creada, esperando primera ronda
 *   - 'in_progress' → jugando rondas
 *   - 'won'         → campeón
 *   - 'eliminated'  → eliminado en alguna ronda
 *
 * Transiciones permitidas (slot.ts exporta helpers con assertTransition).
 */

import type { Bracket, TeamId } from './bracket';
import {
  PHASE_ORDER,
  applyResult as bracketApplyResult,
  generateBracket,
  getChampion as bracketGetChampion,
  isBracketComplete as bracketIsComplete,
  isPhaseComplete as bracketIsPhaseComplete,
} from './bracket';

export type SlotStatus = 'idle' | 'inscribed' | 'in_progress' | 'won' | 'eliminated';

export type CoperoSlot = {
  status: SlotStatus;
  tournamentId: string;
  seed: string;
  bracket: Bracket;
  currentPhaseIndex: number;
  champion: TeamId | null;
  startedAt: number;
};

export type SlotListener = (slot: CoperoSlot | null) => void;

let current: CoperoSlot | null = null;
const listeners = new Set<SlotListener>();

function emit() {
  for (const l of listeners) l(current);
}

export function getSlot(): CoperoSlot | null {
  return current;
}

export function subscribeSlot(listener: SlotListener): () => void {
  listeners.add(listener);
  listener(current);
  return () => listeners.delete(listener);
}

function assertTransition(from: SlotStatus, to: SlotStatus) {
  const ok: Record<SlotStatus, SlotStatus[]> = {
    idle: ['inscribed'],
    inscribed: ['in_progress', 'eliminated'],
    in_progress: ['won', 'eliminated', 'in_progress'],
    won: [],
    eliminated: ['inscribed'],
  };
  if (!ok[from].includes(to)) {
    throw new Error(`Invalid slot transition: ${from} → ${to}`);
  }
}

/**
 * Start a new tournament. Generates the bracket with `seed` for
 * determinism (ADR-0016 RNG). Rejects if a slot is already active.
 */
export function startSlot(teams: TeamId[], seed: string): CoperoSlot {
  if (current && current.status !== 'won' && current.status !== 'eliminated') {
    throw new Error('startSlot: a slot is already active');
  }
  const tournamentId = `COP-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
  const bracket = generateBracket(teams, seed);
  current = {
    status: 'inscribed',
    tournamentId,
    seed,
    bracket,
    currentPhaseIndex: 0,
    champion: null,
    startedAt: Date.now(),
  };
  emit();
  return current;
}

/**
 * Apply a result to a match. Two independent transitions:
 *   1. bracketComplete  → status='won', champion set.
 *   2. current phase complete (but bracket not done) → currentPhaseIndex++.
 * Status moves to 'in_progress' on any non-terminal update.
 */
export function resolveMatch(matchId: string, winner: TeamId): CoperoSlot {
  if (!current) throw new Error('resolveMatch: no active slot');
  if (current.status === 'won' || current.status === 'eliminated') {
    throw new Error(`resolveMatch: slot already terminal (${current.status})`);
  }
  const updatedBracket = bracketApplyResult(current.bracket, matchId, winner);

  // Transition 1: terminal — the whole bracket is resolved.
  const bracketComplete = bracketIsComplete(updatedBracket);
  const champion = bracketComplete ? bracketGetChampion(updatedBracket) : null;

  // Transition 2: phase advance — current phase finished, more rounds to play.
  // Find which phase `matchId` belongs to in the updated bracket.
  const resolvedPhase = PHASE_ORDER.find((p) =>
    updatedBracket.rounds[p].some((m) => m.id === matchId),
  );
  const phaseComplete =
    resolvedPhase != null &&
    !bracketComplete &&
    bracketIsPhaseComplete(updatedBracket, resolvedPhase);
  const nextPhaseIndex = phaseComplete
    ? Math.min(current.currentPhaseIndex + 1, PHASE_ORDER.length - 1)
    : current.currentPhaseIndex;

  current = {
    ...current,
    status: bracketComplete ? 'won' : 'in_progress',
    bracket: updatedBracket,
    currentPhaseIndex: nextPhaseIndex,
    champion,
  };
  emit();
  return current;
}

/**
 * Mark the player as eliminated on a specific match (forfeit / loss).
 */
export function eliminateFromCup(): CoperoSlot {
  if (!current) throw new Error('eliminateFromCup: no active slot');
  assertTransition(current.status, 'eliminated');
  current = { ...current, status: 'eliminated' };
  emit();
  return current;
}

/** Clear the slot (back to idle). */
export function clearSlot(): void {
  current = null;
  emit();
}

export function isSlotAvailable(): boolean {
  return current == null || current.status === 'won' || current.status === 'eliminated';
}
