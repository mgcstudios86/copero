import { emptyStats } from './development'
import { baselineAttributes, createDraftState, emptyAttributes } from './draft'
import {
  clearCareerEventHistory,
  LAST_SAVE_KEY,
  recordActiveCareerEvent,
  STORAGE_PREFIX,
} from './eventCooldown'
import { createSeed, seedToState } from './rng'
import type {
  DraftMode,
  GameMode,
  GameState,
  Player,
  Position,
  PreferredFoot,
} from './types'
import { START_AGE } from './types'

export function createInitialState(
  mode: GameMode = 'long',
  draftMode: DraftMode = 'classic',
): GameState {
  const seed = createSeed()
  return {
    phase: 'intro',
    mode,
    draftMode,
    draft: createDraftState(draftMode),
    seed,
    rngState: seedToState(seed),
    step: 0,
    player: null,
    contract: null,
    currentTeamId: null,
    modifiers: [],
    traits: [],
    careerStage: 'local',
    seasonObjective: null,
    objectiveHistory: [],
    milestones: [],
    banSeasonsRemaining: 0,
    undisputedSeasonsRemaining: 0,
    seasons: [],
    nationalTeamPeriods: [],
    nationalTotals: emptyStats(),
    totals: emptyStats(),
    wealthEarned: 0,
    log: [],
    currentEvent: null,
    pendingOffers: [],
    celebration: null,
    activeLoanReturnTeamId: null,
    nationalTrophies: [],
    agentRerollUsed: false,
    pendingNationalCallup: null,
    traitsChosen: false,
    youthLoanOffered: false,
    formativeTeamId: null,
    ruinedAtSeasonIndex: null,
    teamCompetitionOverrides: {},
  }
}

export function startIdentity(state: GameState): GameState {
  return {
    ...state,
    phase: 'identity',
    draft: createDraftState(state.draftMode),
  }
}

export function createPlayer(
  state: GameState,
  input: {
    lastName: string
    preferredNumber: number
    preferredFoot: PreferredFoot
    position: Position
    nationalityFifa: string
    heritageNationalityFifa?: string | null
  },
): GameState {
  const heritage =
    input.heritageNationalityFifa &&
    input.heritageNationalityFifa !== input.nationalityFifa
      ? input.heritageNationalityFifa
      : null
  const player: Player = {
    lastName: input.lastName.trim(),
    preferredNumber: input.preferredNumber,
    preferredFoot: input.preferredFoot,
    position: input.position,
    nationalityFifa: input.nationalityFifa,
    heritageNationalityFifa: heritage,
    age: START_AGE,
    overall: 55,
    potential: 72,
    peakOverall: 55,
    attributes: emptyAttributes(),
    draftPicks: [],
    marketValue: 250_000,
    wealth: 0,
  }
  return {
    ...state,
    phase: 'draft',
    draft: createDraftState(state.draftMode),
    player,
    step: state.step + 1,
  }
}

export function saveState(state: GameState) {
  try {
    recordActiveCareerEvent(state)
    localStorage.setItem(`${STORAGE_PREFIX}${state.seed}`, JSON.stringify(state))
    localStorage.setItem(LAST_SAVE_KEY, state.seed)
  } catch {
    // ignore quota
  }
}

export function loadState(seed: string): GameState | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${seed}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as GameState
    const draftMode = parsed.draftMode ?? 'classic'
    const fallbackDraft = createDraftState(draftMode)
    const base = createInitialState(parsed.mode ?? 'long', draftMode)
    const parsedPlayer = parsed.player
    const migratedAttributes = parsedPlayer?.attributes ?? baselineAttributes()
    const migratedPotential = parsedPlayer?.potential ?? Math.max(80, parsedPlayer?.overall ?? 80)
    return {
      ...base,
      ...parsed,
      mode: parsed.mode ?? 'long',
      draftMode,
      draft: parsed.draft ?? fallbackDraft,
      traits: parsed.traits ?? [],
      careerStage: parsed.careerStage ?? 'local',
      seasonObjective: parsed.seasonObjective ?? null,
      objectiveHistory: parsed.objectiveHistory ?? [],
      milestones: parsed.milestones ?? [],
      traitsChosen: parsed.traitsChosen ?? (parsed.traits?.length ?? 0) > 0,
      youthLoanOffered: parsed.youthLoanOffered ?? false,
      formativeTeamId: parsed.formativeTeamId ?? parsed.seasons?.[0]?.teamId ?? null,
      ruinedAtSeasonIndex: parsed.ruinedAtSeasonIndex ?? null,
      teamCompetitionOverrides: parsed.teamCompetitionOverrides ?? {},
      player: parsedPlayer
        ? {
            ...parsedPlayer,
            heritageNationalityFifa: parsedPlayer.heritageNationalityFifa ?? null,
            attributes: migratedAttributes,
            draftPicks: parsedPlayer.draftPicks ?? [],
            potential: migratedPotential,
            peakOverall: parsedPlayer.peakOverall ?? parsedPlayer.overall,
          }
        : null,
    }
  } catch {
    return null
  }
}

export function loadLatestState(): GameState | null {
  try {
    const seed = localStorage.getItem(LAST_SAVE_KEY)
    return seed ? loadState(seed) : null
  } catch {
    return null
  }
}

export function clearState(seed: string) {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${seed}`)
    clearCareerEventHistory(seed)
    if (localStorage.getItem(LAST_SAVE_KEY) === seed) localStorage.removeItem(LAST_SAVE_KEY)
  } catch {
    // ignore
  }
}
