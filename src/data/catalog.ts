import raw from './catalog.json'
import type { Competition, Country, Team } from '../engine/types'

type RawCatalog = {
  countries: Country[]
  competitions: Competition[]
  teams: Array<
    Omit<Team, 'competition_id' | 'country_fifa_code' | 'confederation'> & {
      competition_id?: string
      country_fifa_code?: string
      confederation?: string
      domestic_reputation?: number
    }
  >
}

const data = raw as RawCatalog

const competitionById = new Map(data.competitions.map((c) => [c.id, c]))

export const countries: Country[] = data.countries
  .filter((c) => (c.international_reputation ?? 0) >= 1 || Boolean(c.logo_url))
  .sort((a, b) => a.name_es.localeCompare(b.name_es, 'es'))

export const allCountries: Country[] = [...data.countries].sort((a, b) =>
  a.name_es.localeCompare(b.name_es, 'es'),
)

export const competitions: Competition[] = data.competitions

export const teams: Team[] = data.teams.map((t) => {
  const comp = t.competition_id ? competitionById.get(t.competition_id) : undefined
  return {
    id: t.id,
    name: t.name,
    logo_url: t.logo_url,
    international_reputation: t.international_reputation ?? t.domestic_reputation ?? 1,
    primary_color: t.primary_color,
    competition_id: t.competition_id ?? comp?.id ?? 'unknown',
    country_fifa_code: t.country_fifa_code ?? comp?.country_fifa_code ?? 'UNK',
    confederation: t.confederation ?? comp?.confederation,
  }
})

const teamById = new Map(teams.map((t) => [t.id, t]))
const countryByFifa = new Map(allCountries.map((c) => [c.fifa_code, c]))
const teamsByRep = new Map<number, Team[]>()
for (const t of teams) {
  const list = teamsByRep.get(t.international_reputation) ?? []
  list.push(t)
  teamsByRep.set(t.international_reputation, list)
}

export function getTeam(id: string): Team | undefined {
  return teamById.get(id)
}

export function getCountry(fifa: string): Country | undefined {
  return countryByFifa.get(fifa)
}

export function getCompetition(id: string): Competition | undefined {
  return competitionById.get(id)
}

export function teamsAtReputation(rep: number): Team[] {
  return teamsByRep.get(rep) ?? []
}

export function teamsUpToReputation(maxRep: number): Team[] {
  return teams.filter((t) => t.international_reputation <= maxRep)
}

export function academyTeamsForCountry(fifa: string): Team[] {
  const local = teams.filter(
    (t) => t.country_fifa_code === fifa && t.international_reputation <= 3,
  )
  if (local.length >= 3) return local
  return teams.filter((t) => t.international_reputation <= 2)
}

export function competitionsForCountry(fifa: string): Competition[] {
  const list = competitions
    .filter((c) => c.country_fifa_code === fifa)
    .sort((a, b) => (a.tier ?? 99) - (b.tier ?? 99) || a.name.localeCompare(b.name, 'es'))
  return list
}

export function teamsInCompetition(competitionId: string): Team[] {
  return teams
    .filter((t) => t.competition_id === competitionId)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}
