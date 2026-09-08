import { academyTeamsForCountry, getCompetition, teams } from '../data/catalog'
import { msg } from './messages'
import type { DisplayText, GameState, PlayingRole, Team } from './types'

/** Delta de OVR al firmar en un club de origen (+/- según tier y rol). */
export function originOvrDelta(
  team: Team | undefined,
  role: PlayingRole,
): { delta: number; reason: DisplayText } {
  const rep = team?.international_reputation ?? 1
  const comp = team ? getCompetition(team.competition_id) : undefined
  const secondDiv = (comp?.tier ?? 1) >= 2

  let delta = 0
  let reasonKey = 'origin.delta.neutral'

  if (rep >= 5) {
    delta = -2
    reasonKey = 'origin.delta.absoluteBig'
  } else if (rep >= 4) {
    delta = -1
    reasonKey = 'origin.delta.big'
  } else if (rep >= 3) {
    delta = 0
    reasonKey = 'origin.delta.showcase'
  } else if (secondDiv || rep <= 1) {
    delta = 2
    reasonKey = 'origin.delta.small'
  } else {
    delta = 1
    reasonKey = 'origin.delta.medium'
  }

  if (role === 'starter' || role === 'undisputed') delta += 1
  else if (role === 'bench') delta -= 1

  delta = Math.max(-3, Math.min(3, delta))
  return { delta, reason: msg(reasonKey, { delta: delta > 0 ? `+${delta}` : delta }) }
}

/** Rol inicial de cantera según reputación del club. */
export function academyStartRole(team: Team | undefined, rng: number): PlayingRole {
  const rep = team?.international_reputation ?? 1
  if (rep >= 5) return rng > 0.55 ? 'bench' : 'rotation'
  if (rep >= 4) return rng > 0.45 ? 'rotation' : 'bench'
  if (rep >= 3) return rng > 0.5 ? 'rotation' : 'starter'
  return 'starter'
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seededNoise(seed: string, teamId: string, salt: string): number {
  return hashString(`${seed}:${teamId}:${salt}`) / 0xffffffff
}

function uniqueTeams(list: Team[]): Team[] {
  const seen = new Set<string>()
  return list.filter((team) => {
    if (seen.has(team.id)) return false
    seen.add(team.id)
    return true
  })
}

function chooseTeam(
  pool: Team[],
  used: Set<string>,
  seed: string,
  salt: string,
  targetRep: number,
  preferLowerDivision = false,
): Team | undefined {
  return pool
    .filter((team) => !used.has(team.id))
    .map((team) => {
      const tier = getCompetition(team.competition_id)?.tier ?? 1
      const repDistance = Math.abs(team.international_reputation - targetRep)
      const divisionBonus = preferLowerDivision && tier >= 2 ? 24 : 0
      const variety = seededNoise(seed, team.id, salt) * 18
      return { team, score: 120 - repDistance * 35 + divisionBonus + variety }
    })
    .sort((a, b) => b.score - a.score)[0]?.team
}

/**
 * Devuelve tres opciones estables para la misma partida: desarrollo, equilibrio y ambición.
 * No consume el RNG del juego, por lo que refrescar no altera las opciones ni el resto de la carrera.
 */
export function originClubChoices(state: GameState): Team[] {
  const player = state.player
  if (!player) return []

  const localTeams = teams.filter((team) => team.country_fifa_code === player.nationalityFifa)
  const fallback = academyTeamsForCountry(player.nationalityFifa)
  const source = uniqueTeams(localTeams.length >= 3 ? localTeams : [...localTeams, ...fallback])
  if (source.length === 0) return []

  const maxRep = player.potential >= 92 ? 4 : player.potential >= 84 ? 3 : 2
  const eligible = source.filter((team) => team.international_reputation <= maxRep)
  const pool = eligible.length >= 3 ? eligible : source
  const used = new Set<string>()
  const picks: Team[] = []

  const developmentPool = pool.filter((team) => {
    const tier = getCompetition(team.competition_id)?.tier ?? 1
    return team.international_reputation <= 1 || tier >= 2
  })
  const balancedPool = pool.filter((team) => team.international_reputation >= 2 && team.international_reputation <= 3)
  const ambitiousPool = pool.filter((team) => team.international_reputation >= Math.max(2, maxRep - 1))

  const slots: Array<{ pool: Team[]; salt: string; targetRep: number; lowerDivision?: boolean }> = [
    { pool: developmentPool.length ? developmentPool : pool, salt: 'development', targetRep: 1, lowerDivision: true },
    { pool: balancedPool.length ? balancedPool : pool, salt: 'balanced', targetRep: Math.min(2, maxRep) },
    { pool: ambitiousPool.length ? ambitiousPool : pool, salt: 'ambitious', targetRep: maxRep },
  ]

  for (const slot of slots) {
    const team = chooseTeam(slot.pool, used, state.seed, slot.salt, slot.targetRep, slot.lowerDivision)
    if (team) {
      picks.push(team)
      used.add(team.id)
    }
  }

  if (picks.length < 3) {
    const remaining = pool
      .filter((team) => !used.has(team.id))
      .sort((a, b) => seededNoise(state.seed, b.id, 'fallback') - seededNoise(state.seed, a.id, 'fallback'))
    for (const team of remaining) {
      picks.push(team)
      if (picks.length === 3) break
    }
  }

  return picks.slice(0, 3)
}

export type OriginChoicePreview = {
  role: PlayingRole
  minutesKey: string
  growthKey: string
  trophiesKey: string
  riskKey: string
}

export function originChoicePreview(team: Team): OriginChoicePreview {
  const rep = team.international_reputation ?? 1
  const tier = getCompetition(team.competition_id)?.tier ?? 1
  const role = academyStartRole(team, 0.5)

  if (rep >= 4) {
    return {
      role,
      minutesKey: 'origin.preview.big.minutes',
      growthKey: 'origin.preview.big.growth',
      trophiesKey: 'origin.preview.big.trophies',
      riskKey: 'origin.preview.big.risk',
    }
  }
  if (rep === 3) {
    return {
      role,
      minutesKey: 'origin.preview.medium.minutes',
      growthKey: 'origin.preview.medium.growth',
      trophiesKey: 'origin.preview.medium.trophies',
      riskKey: 'origin.preview.medium.risk',
    }
  }
  if (tier >= 2 || rep <= 1) {
    return {
      role,
      minutesKey: 'origin.preview.small.minutes',
      growthKey: 'origin.preview.small.growth',
      trophiesKey: 'origin.preview.small.trophies',
      riskKey: 'origin.preview.small.risk',
    }
  }
  return {
    role,
    minutesKey: 'origin.preview.balanced.minutes',
    growthKey: 'origin.preview.balanced.growth',
    trophiesKey: 'origin.preview.balanced.trophies',
    riskKey: 'origin.preview.balanced.risk',
  }
}
