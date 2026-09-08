import type { GameState } from './types'

export type CareerGrade = 'D' | 'C' | 'B' | 'A' | 'S'

export type CareerRating = {
  score: number
  grade: CareerGrade
  label: string
}

export function calculateCareerRating(state: GameState): CareerRating {
  const player = state.player
  if (!player) return { score: 0, grade: 'D', label: 'rating.incomplete' }

  const peakOverall = Math.max(
    player.peakOverall ?? player.overall,
    player.overall,
    ...state.seasons.map((season) => season.overall),
  )
  const clubTrophies = state.seasons.reduce((total, season) => total + season.trophies.length, 0)
  const nationalTrophies = state.nationalTrophies?.length ?? 0
  const awards = state.seasons.reduce((total, season) => total + season.awards.length, 0)
  const defensivePosition = ['GK', 'CB', 'LB', 'RB', 'CDM'].includes(player.position)
  const goalkeeperScore = player.position === 'GK'
    ? state.totals.cleanSheets * 1.8 - state.totals.goalsConceded * 0.035
    : 0
  const defenderScore = defensivePosition && player.position !== 'GK'
    ? state.totals.cleanSheets * 0.85
    : 0
  const appearanceScore = state.totals.appearances * 0.12

  const score = Math.round(
    peakOverall * 4 +
      state.totals.goals * 0.7 +
      state.totals.assists * 0.55 +
      appearanceScore +
      goalkeeperScore +
      defenderScore +
      clubTrophies * 14 +
      nationalTrophies * 25 +
      awards * 20,
  )

  if (score >= 760) return { score, grade: 'S', label: 'rating.legend' }
  if (score >= 620) return { score, grade: 'A', label: 'rating.worldStar' }
  if (score >= 485) return { score, grade: 'B', label: 'rating.international' }
  if (score >= 350) return { score, grade: 'C', label: 'rating.established' }
  return { score, grade: 'D', label: 'rating.fighter' }
}
