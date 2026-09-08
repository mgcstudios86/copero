import { getTeam } from '../data/catalog'
import type { GameState } from './types'

export type CareerSpell = {
  key: string
  teamId: string
  teamName: string
  startAge: number
  endAge: number
  seasons: number
  appearances: number
  goals: number
  assists: number
  cleanSheets: number
  trophies: number
  peakOverall: number
  loan: boolean
}

export function buildCareerTimeline(state: GameState): CareerSpell[] {
  const spells: CareerSpell[] = []

  for (const season of state.seasons) {
    const previous = spells[spells.length - 1]
    const sameSpell =
      previous && previous.teamId === season.teamId && previous.loan === Boolean(season.loan)

    if (sameSpell) {
      previous.endAge = season.age
      previous.seasons += 1
      previous.appearances += season.stats.appearances
      previous.goals += season.stats.goals
      previous.assists += season.stats.assists
      previous.cleanSheets += season.stats.cleanSheets
      previous.trophies += season.trophies.length
      previous.peakOverall = Math.max(previous.peakOverall, season.overall)
      continue
    }

    spells.push({
      key: `${season.teamId}:${season.index}`,
      teamId: season.teamId,
      teamName: getTeam(season.teamId)?.name ?? season.teamId,
      startAge: season.age,
      endAge: season.age,
      seasons: 1,
      appearances: season.stats.appearances,
      goals: season.stats.goals,
      assists: season.stats.assists,
      cleanSheets: season.stats.cleanSheets,
      trophies: season.trophies.length,
      peakOverall: season.overall,
      loan: Boolean(season.loan),
    })
  }

  return spells
}

export function timelineHeadline(spell: CareerSpell): string {
  const age = spell.startAge === spell.endAge
    ? `${spell.startAge} años`
    : `${spell.startAge}–${spell.endAge} años`
  return `${age} · ${spell.seasons} temp.`
}
