import { getTeam } from '../data/catalog'
import type { CareerStage, GameState, OfferPathReason, Team } from './types'

/** Máxima reputación de club en la carrera (incluye club actual). */
export function peakClubReputation(state: GameState): number {
  let peak = 0
  for (const season of state.seasons) {
    const rep = getTeam(season.teamId)?.international_reputation ?? 0
    if (rep > peak) peak = rep
  }
  if (state.currentTeamId) {
    const rep = getTeam(state.currentTeamId)?.international_reputation ?? 0
    if (rep > peak) peak = rep
  }
  return peak
}

export function deriveCareerStage(state: GameState): CareerStage {
  const peak = peakClubReputation(state)
  if (peak >= 5) return 'elite'
  if (peak >= 4) return 'continental'
  if (peak >= 3) return 'regional'
  return 'local'
}

export function isShowcaseClub(team: Team | undefined): boolean {
  if (!team) return false
  if (team.international_reputation >= 4) return true
  if (team.international_reputation >= 3 && team.confederation === 'CONMEBOL') return true
  return false
}

export function prestigePathScore(state: GameState): number {
  const player = state.player
  if (!player) return 0
  const current = state.currentTeamId ? getTeam(state.currentTeamId) : undefined
  const clubRep = current?.international_reputation ?? 1
  const recent = state.seasons.slice(-3)
  const goals = recent.reduce((n, season) => n + season.stats.goals + season.stats.assists, 0)
  const apps = recent.reduce((n, season) => n + season.stats.appearances, 0)
  const trophies = recent.reduce((n, season) => n + season.trophies.length, 0)
  const starterSeasons = recent.filter((season) => season.role === 'starter' || season.role === 'undisputed').length
  const ntCaps = state.nationalTotals.appearances

  let score = player.overall * 0.55
  score += clubRep * 8
  score += Math.min(18, goals * 0.8)
  score += Math.min(10, apps * 0.12)
  score += trophies * 4
  score += starterSeasons * 3
  score += Math.min(12, ntCaps * 0.4)
  if (state.traits?.includes('ambitious')) score += 4
  if (state.traits?.includes('professional')) score += 3
  if (state.modifiers.includes('golden_boy')) score += 10
  if (state.modifiers.includes('career_ruined')) score -= 25
  if (state.modifiers.includes('form_boost')) score += 6
  if (state.modifiers.includes('form_dip')) score -= 8
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function pathReasonFor(
  dest: Team,
  current: Team | undefined,
  kind: 'transfer' | 'loan' | 'renewal' | 'academy',
  formativeTeamId?: string | null,
): OfferPathReason {
  if (kind === 'loan') return 'loan_development'
  if (kind === 'renewal') return 'local_scout'
  if (formativeTeamId && dest.id === formativeTeamId && current && dest.id !== current.id) return 'home_return'
  if (!current) return 'local_scout'
  if (dest.country_fifa_code === current.country_fifa_code) return 'local_scout'
  if (dest.confederation === current.confederation) {
    if (dest.international_reputation >= 4) return 'continental_leap'
    return 'regional_step'
  }
  if (isShowcaseClub(current) && dest.international_reputation >= 4) return 'showcase_exit'
  if (dest.international_reputation >= 5) return 'elite_pull'
  return 'continental_leap'
}

export function pathReasonLabel(reason: OfferPathReason | undefined): string {
  return reason ? `pathReason.${reason}` : ''
}

export function stageLabel(stage: CareerStage): string {
  return `stage.${stage}`
}
