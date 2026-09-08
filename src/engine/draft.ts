import { LEGENDS, legendById } from '../data/legends'
import { estimateMarketValue } from './development'
import { nextRng } from './rng'
import type {
  AttributeKey,
  DraftMode,
  DraftPick,
  DraftState,
  GameState,
  PlayerAttributes,
  Position,
} from './types'

export const ATTRIBUTE_ORDER: AttributeKey[] = [
  'pace',
  'shooting',
  'passing',
  'dribbling',
  'defending',
  'physical',
  'skillMoves',
  'weakFoot',
]

export const ATTRIBUTE_LABELS: Record<AttributeKey, { short: string; label: string }> = {
  pace: { short: 'PAC', label: 'attribute.pace' },
  shooting: { short: 'SHO', label: 'attribute.shooting' },
  passing: { short: 'PAS', label: 'attribute.passing' },
  dribbling: { short: 'DRI', label: 'attribute.dribbling' },
  defending: { short: 'DEF', label: 'attribute.defending' },
  physical: { short: 'PHY', label: 'attribute.physical' },
  skillMoves: { short: 'SKL', label: 'attribute.skillMoves' },
  weakFoot: { short: 'WF', label: 'attribute.weakFoot' },
}

export function emptyAttributes(): PlayerAttributes {
  return {
    pace: 0,
    shooting: 0,
    passing: 0,
    dribbling: 0,
    defending: 0,
    physical: 0,
    skillMoves: 0,
    weakFoot: 0,
  }
}

export function baselineAttributes(): PlayerAttributes {
  return {
    pace: 70,
    shooting: 70,
    passing: 70,
    dribbling: 70,
    defending: 70,
    physical: 70,
    skillMoves: 3,
    weakFoot: 3,
  }
}

export function createDraftState(mode: DraftMode = 'classic'): DraftState {
  return {
    round: 1,
    currentLegendId: null,
    usedLegendIds: [],
    picks: [],
    skipsRemaining: mode === 'classic' ? 5 : 0,
    completed: false,
  }
}

function drawLegend(state: GameState, usedLegendIds: string[]): GameState {
  const available = LEGENDS.filter((legend) => !usedLegendIds.includes(legend.id))
  const pool = available.length > 0 ? available : LEGENDS
  const roll = nextRng(state.rngState)
  const index = Math.min(pool.length - 1, Math.floor(roll.value * pool.length))
  const legend = pool[index]
  if (!legend) return { ...state, rngState: roll.state }
  return {
    ...state,
    rngState: roll.state,
    draft: {
      ...state.draft,
      currentLegendId: legend.id,
      usedLegendIds,
    },
  }
}

export function initializeDraft(state: GameState): GameState {
  if (state.phase !== 'draft' || state.draft.completed || state.draft.currentLegendId) return state
  return drawLegend(state, state.draft.usedLegendIds)
}

export function selectedAttributeKeys(picks: DraftPick[]): AttributeKey[] {
  return picks.map((pick) => pick.attribute)
}

export function recommendedAttribute(state: GameState): AttributeKey | null {
  const legend = state.draft.currentLegendId ? legendById(state.draft.currentLegendId) : undefined
  if (!legend) return null
  const selected = new Set(selectedAttributeKeys(state.draft.picks))
  const remaining = ATTRIBUTE_ORDER.filter((key) => !selected.has(key))
  if (remaining.length === 0) return null
  return remaining.reduce((best, key) =>
    legend.attributes[key] > legend.attributes[best] ? key : best,
  )
}

export function rerollDraftLegend(state: GameState): GameState {
  if (
    state.phase !== 'draft' ||
    state.draftMode !== 'classic' ||
    state.draft.skipsRemaining <= 0 ||
    !state.draft.currentLegendId
  ) {
    return state
  }
  const used = [...state.draft.usedLegendIds, state.draft.currentLegendId]
  const next: GameState = {
    ...state,
    draft: {
      ...state.draft,
      currentLegendId: null,
      usedLegendIds: used,
      skipsRemaining: state.draft.skipsRemaining - 1,
    },
    step: state.step + 1,
  }
  return drawLegend(next, used)
}

function attributesFromPicks(picks: DraftPick[]): PlayerAttributes {
  const attributes = emptyAttributes()
  for (const pick of picks) attributes[pick.attribute] = pick.value
  return attributes
}

type Weights = Record<AttributeKey, number>

const weights = (
  pace: number,
  shooting: number,
  passing: number,
  dribbling: number,
  defending: number,
  physical: number,
  skillMoves: number,
  weakFoot: number,
): Weights => ({ pace, shooting, passing, dribbling, defending, physical, skillMoves, weakFoot })

const POSITION_WEIGHTS: Record<Position, Weights> = {
  GK: weights(0.04, 0.01, 0.15, 0.05, 0.38, 0.27, 0.03, 0.07),
  CB: weights(0.15, 0.01, 0.1, 0.04, 0.34, 0.25, 0.03, 0.08),
  LB: weights(0.22, 0.04, 0.17, 0.13, 0.22, 0.14, 0.03, 0.05),
  RB: weights(0.22, 0.04, 0.17, 0.13, 0.22, 0.14, 0.03, 0.05),
  CDM: weights(0.1, 0.05, 0.2, 0.11, 0.28, 0.18, 0.03, 0.05),
  CM: weights(0.1, 0.11, 0.27, 0.2, 0.12, 0.1, 0.04, 0.06),
  CAM: weights(0.12, 0.2, 0.25, 0.24, 0.02, 0.06, 0.05, 0.06),
  LM: weights(0.2, 0.15, 0.21, 0.22, 0.05, 0.08, 0.04, 0.05),
  RM: weights(0.2, 0.15, 0.21, 0.22, 0.05, 0.08, 0.04, 0.05),
  LW: weights(0.24, 0.22, 0.13, 0.24, 0.02, 0.06, 0.04, 0.05),
  RW: weights(0.24, 0.22, 0.13, 0.24, 0.02, 0.06, 0.04, 0.05),
  ST: weights(0.2, 0.31, 0.08, 0.16, 0.01, 0.14, 0.04, 0.06),
}

function normalizedValue(key: AttributeKey, value: number): number {
  if (key === 'skillMoves' || key === 'weakFoot') return value * 20
  return value
}

export function calculatePotential(position: Position, attributes: PlayerAttributes): number {
  const positionWeights = POSITION_WEIGHTS[position]
  const raw = ATTRIBUTE_ORDER.reduce(
    (total, key) => total + normalizedValue(key, attributes[key]) * positionWeights[key],
    0,
  )
  return Math.max(72, Math.min(97, Math.round(raw)))
}

export function acceptRecommendedDraftAttribute(state: GameState): GameState {
  if (state.phase !== 'draft' || !state.player || !state.draft.currentLegendId) return state
  const legend = legendById(state.draft.currentLegendId)
  const attribute = recommendedAttribute(state)
  if (!legend || !attribute) return state

  const pick: DraftPick = {
    round: state.draft.picks.length + 1,
    legendId: legend.id,
    legendName: legend.name,
    attribute,
    value: legend.attributes[attribute],
  }
  const picks = [...state.draft.picks, pick]
  const usedLegendIds = [...state.draft.usedLegendIds, legend.id]

  if (picks.length >= ATTRIBUTE_ORDER.length) {
    const attributes = attributesFromPicks(picks)
    const potential = calculatePotential(state.player.position, attributes)
    const overall = Math.max(54, Math.min(76, potential - 21))
    const player = {
      ...state.player,
      attributes,
      draftPicks: picks,
      potential,
      overall,
      peakOverall: overall,
      marketValue: estimateMarketValue(overall, state.player.age, 1),
    }
    return {
      ...state,
      player,
      phase: 'draft_result',
      draft: {
        ...state.draft,
        round: ATTRIBUTE_ORDER.length,
        currentLegendId: null,
        usedLegendIds,
        picks,
        completed: true,
      },
      step: state.step + 1,
    }
  }

  const next: GameState = {
    ...state,
    draft: {
      ...state.draft,
      round: picks.length + 1,
      currentLegendId: null,
      usedLegendIds,
      picks,
    },
    step: state.step + 1,
  }
  return drawLegend(next, usedLegendIds)
}

export function continueFromDraftResult(state: GameState): GameState {
  if (state.phase !== 'draft_result' || !state.player || !state.draft.completed) return state
  return { ...state, phase: 'origin', step: state.step + 1 }
}
