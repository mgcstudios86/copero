import { getCompetition, getCountry, getTeam } from '../data/catalog'
import {
  resolveAwardTrophy,
  resolveContinentalTrophy,
  resolveDomesticCupTrophy,
  resolveLeagueTrophy,
  resolveNationalTeamTrophy,
  resolveWorldCupTrophy,
  type TrophyWin,
} from '../data/trophies'
import { deriveCareerStage } from './careerPath'
import {
  developOverall,
  effectiveRole,
  emptyStats,
  estimateMarketValue,
  nationalCallupChance,
  simulateInternationalStats,
  simulateSeasonStats,
} from './development'
import { competitionAtTier, effectiveCompetitionId } from './league'
import { msg } from './messages'
import { injuryChance, retirementAge } from './modifiers'
import { evaluateSeasonObjective } from './objectives'
import { nextRng, pickWeighted } from './rng'
import type { DisplayText, GameState, SeasonRecord } from './types'

const INJURIES = [
  { type: 'hamstring', weight: 24, overallDelta: -3 },
  { type: 'meniscus', weight: 18, overallDelta: -2 },
  { type: 'acl', weight: 14, overallDelta: -5 },
  { type: 'tibia_fibula', weight: 8, overallDelta: -8 },
  { type: 'achilles', weight: 4, overallDelta: -10 },
  { type: 'ankle_sprain', weight: 14, overallDelta: -1 },
  { type: 'calf_tear', weight: 8, overallDelta: -2 },
]

export function simulateOneSeason(state: GameState): {
  state: GameState
  season: SeasonRecord
  injuryName: string | null
} {
  if (!state.player || !state.currentTeamId || !state.contract) {
    throw new Error('Cannot simulate season without player/club')
  }

  let s = state.rngState
  const player = { ...state.player }
  const team = getTeam(state.currentTeamId)
  const clubRep = team?.international_reputation ?? 1
  const seasonCompetitionId = effectiveCompetitionId(state.currentTeamId, state)
  const seasonCompetition = getCompetition(seasonCompetitionId)
  const leagueTier = seasonCompetition?.tier ?? 1
  const countryFifa =
    seasonCompetition?.country_fifa_code ?? team?.country_fifa_code ?? player.nationalityFifa
  const suspended = state.banSeasonsRemaining > 0
  let injured = false
  let injuryName: string | null = null
  let injuryDelta = 0

  const chance = injuryChance(state)
  const injuryRoll = nextRng(s)
  s = injuryRoll.state
  if (!suspended && chance > 0 && injuryRoll.value < chance) {
    const pick = pickWeighted(
      s,
      INJURIES.map((injury) => ({ item: injury, weight: injury.weight })),
    )
    s = pick.state
    if (pick.item) {
      injured = true
      injuryName = pick.item.type
      injuryDelta = pick.item.overallDelta
    }
  }

  const role = effectiveRole(
    state.contract.role,
    player.overall,
    clubRep,
    state.undisputedSeasonsRemaining,
  )

  const statsResult = simulateSeasonStats(
    player.position,
    player.overall,
    role,
    suspended,
    injured,
    s,
    clubRep,
    player.attributes,
    player.potential,
    player.age,
  )
  s = statsResult.state

  const trophies: TrophyWin[] = []
  const awards: string[] = []
  let struggle: SeasonRecord['struggle']
  if (!suspended && !injured) {
    const leagueRoll = nextRng(s)
    s = leagueRoll.state
    const cupRoll = nextRng(s)
    s = cupRoll.state
    const contRoll = nextRng(s)
    s = contRoll.state

    const lastSeason = state.seasons[state.seasons.length - 1]
    const justPromoted =
      lastSeason?.struggle === 'promoted' && lastSeason.teamId === state.currentTeamId

    let winChance =
      clubRep <= 0
        ? 0.005 + Math.max(0, player.overall - 75) / 800
        : clubRep === 1
          ? 0.02 + Math.max(0, player.overall - 70) / 500
          : clubRep === 2
            ? 0.05 + Math.max(0, player.overall - 68) / 400
            : 0.04 + clubRep * 0.035 + Math.max(0, player.overall - 70) / 350
    if (leagueTier === 1) winChance *= 0.55
    else if (leagueTier >= 2) winChance *= 1.15
    if (justPromoted) winChance *= 0.08

    const wonLeague = !justPromoted && leagueRoll.value < winChance
    if (wonLeague) trophies.push(resolveLeagueTrophy(state.currentTeamId, seasonCompetitionId))
    if (cupRoll.value < winChance * 0.45) trophies.push(resolveDomesticCupTrophy(state.currentTeamId))
    if (
      clubRep >= 4 &&
      contRoll.value <
        0.02 + (clubRep - 4) * 0.025 + Math.max(0, player.overall - 82) / 400
    ) {
      trophies.push(resolveContinentalTrophy(state.currentTeamId))
    }
    if (player.overall >= 90 && leagueRoll.value > 0.96) {
      awards.push('ballon_or_shortlist')
      const award = resolveAwardTrophy('ballon_or_shortlist')
      if (award) trophies.push(award)
    }

    const strugRoll = nextRng(s)
    s = strugRoll.state
    if (leagueTier >= 2) {
      const promoChance =
        (wonLeague ? 0.55 : 0.1) +
        Math.max(0, player.overall - 68) / 220 +
        (clubRep >= 2 ? 0.08 : 0)
      if (strugRoll.value < promoChance) struggle = 'promoted'
      else if (clubRep <= 1 && strugRoll.value < 0.55) struggle = 'relegation_battle'
    } else if (clubRep <= 1 && trophies.length === 0) {
      if (strugRoll.value < 0.35) struggle = 'relegated'
      else if (strugRoll.value < 0.75) struggle = 'relegation_battle'
    } else if (clubRep <= 2 && trophies.length === 0 && strugRoll.value < 0.1) {
      struggle = 'relegated'
    }
  }

  let pendingNationalCallup = state.pendingNationalCallup ?? null
  const callChance = nationalCallupChance(player.overall, player.age, clubRep)
  if (callChance > 0 && !pendingNationalCallup) {
    const callRoll = nextRng(s)
    s = callRoll.state
    if (callRoll.value < callChance) {
      const projected = simulateInternationalStats(
        player.position,
        player.overall,
        player.attributes,
        player.potential,
        player.age,
        s,
      )
      s = projected.state

      let callupCountryFifa = player.nationalityFifa
      let viaHeritage = false
      const heritage = player.heritageNationalityFifa
      if (heritage && heritage !== player.nationalityFifa) {
        const heritRoll = nextRng(s)
        s = heritRoll.state
        if (heritRoll.value < 0.3) {
          callupCountryFifa = heritage
          viaHeritage = true
        }
      }

      pendingNationalCallup = {
        age: player.age,
        projected: projected.stats,
        countryFifa: callupCountryFifa,
        viaHeritage,
      }
    }
  }

  const developed = developOverall(state, player.overall + injuryDelta, player.age, role, injured, s)
  s = developed.state
  player.overall = developed.overall
  player.peakOverall = Math.max(player.peakOverall ?? player.overall, player.overall)
  player.age += 1
  player.marketValue = estimateMarketValue(player.overall, player.age, clubRep)
  player.wealth += state.contract.annualWage

  const isLoan = Boolean(state.activeLoanReturnTeamId)

  let season: SeasonRecord = {
    index: state.seasons.length,
    age: player.age - 1,
    teamId: state.currentTeamId,
    overall: player.overall,
    marketValue: player.marketValue,
    wage: state.contract.annualWage,
    role,
    stats: statsResult.stats,
    trophies,
    awards,
    suspended,
    injured,
    loan: isLoan,
    loanParentTeamId: isLoan ? state.activeLoanReturnTeamId ?? undefined : undefined,
    struggle,
    competitionId: seasonCompetitionId,
  }

  const totals = { ...state.totals }
  totals.appearances += season.stats.appearances
  totals.goals += season.stats.goals
  totals.assists += season.stats.assists
  totals.cleanSheets += season.stats.cleanSheets
  totals.goalsConceded += season.stats.goalsConceded

  const contract = {
    ...state.contract,
    yearsRemaining: Math.max(0, state.contract.yearsRemaining - 1),
  }

  const teamCompetitionOverrides = { ...(state.teamCompetitionOverrides ?? {}) }
  if (struggle === 'promoted' && leagueTier >= 2) {
    const up = competitionAtTier(countryFifa, leagueTier - 1)
    if (up) teamCompetitionOverrides[state.currentTeamId] = up.id
  } else if (struggle === 'relegated') {
    const down = competitionAtTier(countryFifa, leagueTier + 1)
    if (down) teamCompetitionOverrides[state.currentTeamId] = down.id
  }

  let next: GameState = {
    ...state,
    rngState: s,
    step: state.step + 1,
    player,
    contract,
    seasons: [...state.seasons, season],
    teamCompetitionOverrides,
    totals,
    nationalTeamPeriods: state.nationalTeamPeriods ?? [],
    nationalTotals: state.nationalTotals ?? emptyStats(),
    nationalTrophies: state.nationalTrophies ?? [],
    pendingNationalCallup,
    wealthEarned: state.wealthEarned + state.contract.annualWage,
    banSeasonsRemaining: Math.max(0, state.banSeasonsRemaining - 1),
    undisputedSeasonsRemaining: Math.max(0, state.undisputedSeasonsRemaining - 1),
    log: [...state.log],
  }

  const evaluated = evaluateSeasonObjective(next, season)
  if (evaluated) {
    season = {
      ...season,
      objectiveResult: {
        label: evaluated.label,
        completed: Boolean(evaluated.completed),
        failed: evaluated.failed,
      },
    }
    next = {
      ...next,
      seasons: [...state.seasons, season],
      seasonObjective: evaluated,
    }
  }

  next = {
    ...next,
    careerStage: deriveCareerStage(next),
    modifiers: next.modifiers.filter((modifier) => modifier !== 'form_boost' && modifier !== 'form_dip'),
  }

  const logLines: DisplayText[] = [
    msg('log.season', {
      season: season.index + 1,
      ovr: season.overall,
      apps: season.stats.appearances,
    }),
  ]
  if (injured && injuryName) logLines.push(msg('log.seasonInjury', { injury: injuryName }))
  if (trophies.length) {
    logLines.push(msg('log.seasonTrophies', { trophies: trophies.map((trophy) => trophy.name).join(', ') }))
  }
  if (struggle === 'relegated') logLines.push(msg('log.relegated'))
  if (struggle === 'promoted') logLines.push(msg('log.promoted'))
  if (struggle === 'relegation_battle') logLines.push(msg('log.relegationBattle'))
  if (pendingNationalCallup && !state.pendingNationalCallup) logLines.push(msg('log.callupPending'))
  if (evaluated) {
    const objectiveKey = typeof evaluated.label === 'string' ? evaluated.label : evaluated.label.key
    logLines.push(
      msg(evaluated.completed ? 'log.objectiveDone' : 'log.objectiveFailed', {
        objective: objectiveKey,
      }),
    )
  }
  next = { ...next, log: [...state.log, ...logLines] }

  return { state: next, season, injuryName }
}

/** Aplica caps + posible trofeo NT tras aceptar convocatoria */
export function applyNationalCallup(state: GameState): GameState {
  const pending = state.pendingNationalCallup
  if (!pending || !state.player) return { ...state, pendingNationalCallup: null }

  let s = state.rngState
  const player = state.player
  const nationalTrophies = [...(state.nationalTrophies ?? [])]
  const newTrophies: TrophyWin[] = []
  const callCountryFifa = pending.countryFifa || player.nationalityFifa
  const logLines: DisplayText[] = [
    msg('log.nationalStats', {
      country: callCountryFifa,
      apps: pending.projected.appearances,
      goals: pending.projected.goals,
      assists: pending.projected.assists,
    }),
  ]

  if (player.overall >= 78 && pending.age >= 20 && pending.age <= 35) {
    const country = getCountry(callCountryFifa)
    const conf = country?.confederation ?? 'UEFA'
    const ntRoll = nextRng(s)
    s = ntRoll.state
    const confChance = 0.12 + Math.min(0.06, (player.overall - 78) / 150)
    if (ntRoll.value < confChance) {
      const cup = resolveNationalTeamTrophy(conf)
      nationalTrophies.push(cup)
      newTrophies.push(cup)
      logLines.push(msg('log.nationalChampion', { trophy: cup.name }))
    }
    if (player.overall >= 85) {
      const wcRoll = nextRng(s)
      s = wcRoll.state
      const wcChance = 0.04 + Math.min(0.04, (player.overall - 85) / 200)
      if (wcRoll.value < wcChance) {
        const wc = resolveWorldCupTrophy()
        nationalTrophies.push(wc)
        newTrophies.push(wc)
        logLines.push(msg('log.worldChampion'))
      }
    }
  }

  const nationalTotals = { ...(state.nationalTotals ?? emptyStats()) }
  nationalTotals.appearances += pending.projected.appearances
  nationalTotals.goals += pending.projected.goals
  nationalTotals.assists += pending.projected.assists
  nationalTotals.cleanSheets += pending.projected.cleanSheets
  nationalTotals.goalsConceded += pending.projected.goalsConceded

  return {
    ...state,
    rngState: s,
    pendingNationalCallup: null,
    nationalTeamPeriods: [
      ...(state.nationalTeamPeriods ?? []),
      { age: pending.age, stats: pending.projected },
    ],
    nationalTotals,
    nationalTrophies,
    log: [...state.log, ...logLines],
    celebration: newTrophies.length
      ? { kind: 'trophy', message: msg('celebration.nationalTrophy'), trophies: newTrophies }
      : state.celebration,
  }
}

export function rejectNationalCallup(state: GameState): GameState {
  return {
    ...state,
    pendingNationalCallup: null,
    log: [...state.log, msg('log.callupRejected')],
  }
}

export function shouldRetire(state: GameState): { retire: boolean; reason: 'age' | 'ruined' | null } {
  if (!state.player) return { retire: false, reason: null }
  if (state.player.age >= retirementAge(state)) return { retire: true, reason: 'age' }

  if (state.modifiers.includes('career_ruined')) {
    const current = state.currentTeamId ? getTeam(state.currentTeamId) : undefined
    const atRecoveryClub = (current?.international_reputation ?? 99) <= 2
    const recoveryPending =
      state.pendingOffers.some((offer) => offer.pathReason === 'recovery') ||
      (state.currentEvent?.type === 'offer' &&
        state.currentEvent.offers.some((offer) => offer.pathReason === 'recovery'))
    if (atRecoveryClub || recoveryPending) return { retire: false, reason: null }

    const ruinedAt = state.ruinedAtSeasonIndex
    const seasonsSinceRuin =
      ruinedAt == null ? state.seasons.length : Math.max(0, state.seasons.length - ruinedAt)
    if (
      state.player.age >= 30 &&
      (state.player.overall <= 48 || (seasonsSinceRuin >= 2 && state.player.overall <= 55))
    ) {
      return { retire: true, reason: 'ruined' }
    }
  }

  return { retire: false, reason: null }
}

export function mergeEmptyTotals(state: GameState): GameState {
  return { ...state, totals: state.totals ?? emptyStats() }
}

/** Vuelve del préstamo al club dueño cuando termina el año de cesión */
export function resolveLoanReturn(state: GameState): GameState {
  if (!state.player || !state.contract) return state
  if (!state.activeLoanReturnTeamId) return state
  if (state.contract.yearsRemaining > 0) return state

  const parentId = state.activeLoanReturnTeamId
  const parent = getTeam(parentId)
  const wage = Math.round((state.contract.annualWage * 0.95) / 5_000) * 5_000

  return {
    ...state,
    currentTeamId: parentId,
    activeLoanReturnTeamId: null,
    contract: {
      teamId: parentId,
      annualWage: wage,
      years: 2,
      yearsRemaining: 2,
      releaseClause: state.contract.releaseClause,
      signingBonus: 0,
      role: 'rotation',
    },
    log: [...state.log, msg('log.loanReturn', { team: parent?.name ?? parentId })],
  }
}
