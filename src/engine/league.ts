import { competitionsForCountry, getCompetition, getTeam } from '../data/catalog'
import type { Competition, GameState } from './types'

/** Liga efectiva del club en esta carrera (tras ascensos/descensos). */
export function effectiveCompetitionId(teamId: string, state: GameState): string {
  const team = getTeam(teamId)
  if (!team) return 'unknown'
  return state.teamCompetitionOverrides?.[teamId] ?? team.competition_id
}

export function effectiveCompetition(teamId: string, state: GameState): Competition | undefined {
  return getCompetition(effectiveCompetitionId(teamId, state))
}

export function competitionAtTier(countryFifa: string, tier: number): Competition | undefined {
  return competitionsForCountry(countryFifa).find((c) => (c.tier ?? 99) === tier)
}
