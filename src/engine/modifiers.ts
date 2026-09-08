import type { GameState, ModifierId } from './types'
import { BASE_RETIREMENT_AGE, LONGEVITY_RETIREMENT_AGE } from './types'

export function hasModifier(state: GameState, id: ModifierId): boolean {
  return state.modifiers.includes(id)
}

export function addModifier(state: GameState, id: ModifierId): GameState {
  if (state.modifiers.includes(id)) return state
  return { ...state, modifiers: [...state.modifiers, id] }
}

export function removeModifier(state: GameState, id: ModifierId): GameState {
  return { ...state, modifiers: state.modifiers.filter((m) => m !== id) }
}

export function retirementAge(state: GameState): number {
  return hasModifier(state, 'iron_longevity') ? LONGEVITY_RETIREMENT_AGE : BASE_RETIREMENT_AGE
}

export function injuryChance(state: GameState): number {
  if (hasModifier(state, 'injury_immunity')) return 0
  let base = 0.08
  if (hasModifier(state, 'glass_body')) base = 0.28
  if (state.traits?.includes('professional')) base *= 0.7
  if (state.traits?.includes('party_risk')) base *= 1.25
  if (hasModifier(state, 'form_dip')) base *= 1.15
  return base
}

export function offerReputationCap(state: GameState): number {
  if (hasModifier(state, 'career_ruined')) return 2
  if (hasModifier(state, 'golden_boy')) return 5
  return 5
}

export function overallFloor(state: GameState): number {
  if (hasModifier(state, 'career_ruined')) return 45
  return 40
}

export function overallCeil(state: GameState): number {
  if (hasModifier(state, 'golden_boy')) return 99
  return 94
}
