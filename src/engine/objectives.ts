import { getTeam } from '../data/catalog'
import { msg } from './messages'
import { nextRng, pickOne } from './rng'
import type {
  DisplayText,
  GameState,
  PlayingRole,
  Position,
  SeasonObjective,
  SeasonObjectiveKind,
  SeasonRecord,
  TraitId,
} from './types'

const TRAIT_POOL: { id: TraitId; labelKey: string; descKey: string }[] = [
  { id: 'ambitious', labelKey: 'trait.ambitious.label', descKey: 'trait.ambitious.desc' },
  { id: 'loyal', labelKey: 'trait.loyal.label', descKey: 'trait.loyal.desc' },
  { id: 'party_risk', labelKey: 'trait.party_risk.label', descKey: 'trait.party_risk.desc' },
  { id: 'professional', labelKey: 'trait.professional.label', descKey: 'trait.professional.desc' },
  { id: 'media_magnet', labelKey: 'trait.media_magnet.label', descKey: 'trait.media_magnet.desc' },
]

export function traitMeta(id: TraitId) {
  return TRAIT_POOL.find((trait) => trait.id === id)
}

export function allTraitOptions() {
  return TRAIT_POOL
}

export function pickTraitOptions(state: GameState, count = 3): { state: GameState; options: typeof TRAIT_POOL } {
  let s = state.rngState
  const pool = [...TRAIT_POOL]
  const options: typeof TRAIT_POOL = []
  for (let i = 0; i < count && pool.length; i += 1) {
    const pick = pickOne(s, pool)
    s = pick.state
    options.push(pick.item)
    const idx = pool.findIndex((trait) => trait.id === pick.item.id)
    if (idx >= 0) pool.splice(idx, 1)
  }
  return { state: { ...state, rngState: s }, options }
}

function starterObjective(target: number): SeasonObjective {
  return { kind: 'starter_minutes', label: msg('objective.starterMinutes', { target }), target, progress: 0 }
}

function contributionObjective(target: number): SeasonObjective {
  return { kind: 'goal_contrib', label: msg('objective.goalContrib', { target }), target, progress: 0 }
}

export function generateSeasonObjective(state: GameState): { state: GameState; objective: SeasonObjective } {
  if (!state.player || !state.currentTeamId || !state.contract) {
    return { state, objective: { ...starterObjective(20), briefed: false } }
  }

  let s = state.rngState
  const team = getTeam(state.currentTeamId)
  const rep = team?.international_reputation ?? 1
  const role = state.contract.role
  const pos = state.player.position
  const attack = ['ST', 'LW', 'RW', 'CAM'].includes(pos) || ['LM', 'RM', 'CM'].includes(pos)

  type Cand = { item: SeasonObjective; weight: number }
  const candidates: Cand[] = []

  candidates.push({ item: starterObjective(role === 'bench' || role === 'rotation' ? 18 : 28), weight: role === 'bench' || role === 'rotation' ? 28 : 18 })

  if (attack) {
    const target = pos === 'ST' ? 12 : 8
    candidates.push({ item: contributionObjective(target), weight: 24 })
  } else {
    candidates.push({ item: contributionObjective(4), weight: 12 })
  }

  if (rep <= 2) {
    candidates.push({
      item: { kind: 'avoid_relegation', label: msg('objective.avoidRelegation'), target: 1, progress: 0 },
      weight: 22,
    })
  }

  if (rep >= 2) {
    candidates.push({
      item: { kind: 'win_trophy', label: msg('objective.winTrophy'), target: 1, progress: 0 },
      weight: rep >= 4 ? 16 : 10,
    })
  }

  if (state.player.overall >= 68 && state.player.age >= 18) {
    candidates.push({
      item: { kind: 'national_callup', label: msg('objective.nationalCallup'), target: 1, progress: 0 },
      weight: 14,
    })
  }

  const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0)
  const roll = nextRng(s)
  s = roll.state
  let acc = 0
  let chosen = candidates[0]!.item
  const r = roll.value * total
  for (const candidate of candidates) {
    acc += candidate.weight
    if (r <= acc) {
      chosen = candidate.item
      break
    }
  }

  return { state: { ...state, rngState: s }, objective: chosen }
}

/** Meta probable si fichás en ese club (determinística, no toca el RNG de carrera). */
export function previewObjectiveForClub(
  player: { position: Position; overall: number; age: number } | null | undefined,
  teamId: string,
  role: PlayingRole,
): { kind: SeasonObjectiveKind; label: DisplayText } {
  const team = getTeam(teamId)
  const rep = team?.international_reputation ?? 1
  const pos = player?.position ?? 'CM'
  const overall = player?.overall ?? 70
  const age = player?.age ?? 20
  const attack = ['ST', 'LW', 'RW', 'CAM'].includes(pos) || ['LM', 'RM', 'CM'].includes(pos)

  if (rep <= 2) return { kind: 'avoid_relegation', label: msg('objective.avoidRelegation') }
  if (role === 'bench' || role === 'rotation') {
    return { kind: 'starter_minutes', label: msg('objective.starterMinutes', { target: 18 }) }
  }
  if (attack) {
    const target = pos === 'ST' ? 12 : 8
    return { kind: 'goal_contrib', label: msg('objective.goalContrib', { target }) }
  }
  if (rep >= 3) return { kind: 'win_trophy', label: msg('objective.winTrophy') }
  if (overall >= 68 && age >= 18) {
    return { kind: 'national_callup', label: msg('objective.nationalCallup') }
  }
  return { kind: 'starter_minutes', label: msg('objective.starterMinutes', { target: 28 }) }
}

export function evaluateSeasonObjective(state: GameState, season: SeasonRecord): SeasonObjective | null {
  const obj = state.seasonObjective
  if (!obj) return null

  const next: SeasonObjective = { ...obj }
  switch (obj.kind) {
    case 'starter_minutes':
      next.progress = season.stats.appearances
      next.completed = season.stats.appearances >= obj.target
      next.failed = !next.completed
      break
    case 'goal_contrib':
      next.progress = season.stats.goals + season.stats.assists
      next.completed = next.progress >= obj.target
      next.failed = !next.completed
      break
    case 'avoid_relegation':
      next.progress = season.struggle === 'relegated' ? 0 : 1
      next.completed = season.struggle !== 'relegated'
      next.failed = season.struggle === 'relegated'
      break
    case 'win_trophy':
      next.progress = season.trophies.length
      next.completed = season.trophies.length >= obj.target
      next.failed = !next.completed
      break
    case 'national_callup':
      next.progress = state.pendingNationalCallup ? 1 : 0
      next.completed = Boolean(state.pendingNationalCallup) || state.nationalTeamPeriods.some((period) => period.age === season.age)
      next.failed = !next.completed
      break
  }
  return next
}
