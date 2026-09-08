import { MODE_CONFIG } from './types'
import type { ClubOffer, GameState, Position, PreferredFoot, TraitId } from './types'
import { allCareerEvents, getEventDef } from '../events/catalog'
import { resolveCareerChoice } from '../events/resolve'
import { eventChoiceVisual } from '../data/eventAssets'
import {
  academyTeamsForCountry,
  competitionsForCountry,
  getCountry,
  getTeam,
  teamsInCompetition,
} from '../data/catalog'
import { nationalCupName } from '../data/trophies'
import { negotiateOffer, buildOffer } from './contract'
import { deriveCareerStage } from './careerPath'
import { clampOverall } from './development'
import { msg } from './messages'
import { hasModifier } from './modifiers'
import { generateSeasonObjective, pickTraitOptions } from './objectives'
import { academyStartRole, originOvrDelta } from './originStart'
import { nextRng, pickWeighted } from './rng'
import { resolveLoanReturn, shouldRetire, simulateOneSeason, applyNationalCallup, rejectNationalCallup } from './season'
import { createPlayer, saveState, startIdentity } from './state'
import {
  generateAcademyOffers,
  generateRecoveryOffers,
  generateTransferOffers,
  generateYouthLoanOffers,
  loanPerformanceAllowsContinue,
  shouldOfferYouthLoan,
} from './transfer'

function toRetireEvent(state: GameState, reason: 'age' | 'no_offers' | 'medical' | 'ruined'): GameState {
  return {
    ...state,
    phase: 'summary',
    currentEvent: {
      type: 'retire',
      title: msg('retire.title'),
      body: msg(`retire.${reason}`),
      reason,
    },
  }
}

function eventMatchesContext(state: GameState, e: ReturnType<typeof allCareerEvents>[number]): boolean {
  if (!state.player) return false
  const age = state.player.age
  if (e.requiresClub && !state.currentTeamId) return false
  if (e.minAge != null && age < e.minAge) return false
  if (e.maxAge != null && age > e.maxAge) return false
  if (e.id === 'career_ending_injury' && hasModifier(state, 'injury_immunity')) return false
  if (e.id === 'iron_genetics' && hasModifier(state, 'injury_immunity')) return false
  if (e.id === 'miracle_doctor' && hasModifier(state, 'iron_longevity')) return false

  const team = state.currentTeamId ? getTeam(state.currentTeamId) : undefined
  const clubCountry = team?.country_fifa_code
  const confed = team?.confederation
  const clubRep = team?.international_reputation ?? 1

  if (e.countries?.length && !e.countries.includes(state.player.nationalityFifa)) return false
  if (e.clubCountries?.length && (!clubCountry || !e.clubCountries.includes(clubCountry))) return false
  if (e.confederations?.length && (!confed || !e.confederations.includes(confed))) return false
  if (e.minClubRep != null && clubRep < e.minClubRep) return false
  if (e.maxClubRep != null && clubRep > e.maxClubRep) return false

  const traits = state.traits ?? []
  if (e.requiresTraits?.length && !e.requiresTraits.every((tr) => traits.includes(tr))) return false
  if (e.blocksTraits?.length && e.blocksTraits.some((tr) => traits.includes(tr))) return false

  if (e.id === 'eu_adaptation') {
    const nat = getCountry(state.player.nationalityFifa)
    if (nat?.confederation === 'UEFA') return false
  }

  return true
}

function traitWeightBoost(state: GameState, eventId: string, base: number): number {
  const traits = state.traits ?? []
  let w = base
  if (traits.includes('party_risk') && ['mysterious_substance', 'doping_temptation', 'media_scandal', 'br_carnival_break'].includes(eventId)) {
    w *= 1.6
  }
  if (traits.includes('professional') && ['training_extra', 'personal_coach', 'eu_travel_fatigue'].includes(eventId)) {
    w *= 1.4
  }
  if (traits.includes('media_magnet') && ['media_scandal', 'ar_media_pressure', 'mx_clasico_pressure'].includes(eventId)) {
    w *= 1.5
  }
  if (traits.includes('ambitious') && ['rival_offer', 'scout_discovery', 'br_rival_serie_a'].includes(eventId)) {
    w *= 1.35
  }
  if (traits.includes('loyal') && eventId === 'rival_offer') w *= 0.55
  const def = getEventDef(eventId)
  if (def?.regional) w *= 1.25
  return w
}

function buildCareerEvent(state: GameState): GameState {
  if (!state.player) return state
  let s = state.rngState
  const candidates = allCareerEvents()
    .filter((e) => eventMatchesContext(state, e))
    .map((e) => ({ item: e, weight: traitWeightBoost(state, e.id, e.weight) }))

  if (candidates.length === 0) return { ...state, rngState: s }

  const pick = pickWeighted(s, candidates)
  s = pick.state
  const def = pick.item
  if (!def) return { ...state, rngState: s }

  const team = state.currentTeamId ? getTeam(state.currentTeamId) : undefined
  const badge = def.regional
    ? team?.country_fifa_code ?? state.player.nationalityFifa
    : undefined

  return {
    ...state,
    rngState: s,
    currentEvent: {
      type: 'career_choice',
      eventId: def.id,
      title: msg(def.titleKey),
      body: msg(def.bodyKey),
      impact: def.impact,
      choices: def.choices.map((choice) => ({ id: choice.id, label: msg(choice.labelKey) })),
      regionalBadge: badge,
    },
  }
}

function maybeOpenTraitPick(state: GameState): GameState {
  if (state.traitsChosen || (state.traits?.length ?? 0) > 0) return state
  const picked = pickTraitOptions(state, 3)
  return {
    ...picked.state,
    currentEvent: {
      type: 'trait_pick',
      title: msg('traits.title'),
      body: msg('traits.body'),
      options: picked.options.map((option) => ({
        id: option.id,
        label: msg(option.labelKey),
        desc: msg(option.descKey),
      })),
    },
  }
}

function assignObjective(state: GameState): GameState {
  const gen = generateSeasonObjective(state)
  const history = [...(gen.state.objectiveHistory ?? [])]
  if (state.seasonObjective) {
    history.push({
      label: state.seasonObjective.label,
      completed: Boolean(state.seasonObjective.completed),
    })
  }
  return {
    ...gen.state,
    seasonObjective: { ...gen.objective, briefed: false },
    objectiveHistory: history.slice(-12),
  }
}

function markObjectiveBriefedSilent(state: GameState): GameState {
  const obj = state.seasonObjective
  if (!obj || obj.briefed) return state
  return { ...state, seasonObjective: { ...obj, briefed: true } }
}

function ensureObjective(state: GameState): GameState {
  const obj = state.seasonObjective
  if (obj && !obj.completed && !obj.failed) return markObjectiveBriefedSilent(state)
  return markObjectiveBriefedSilent(assignObjective(state))
}

function maybeBriefThenAdvance(state: GameState): GameState {
  const next = ensureObjective(state)
  return advanceAfterDecision(next)
}

function syncMilestones(state: GameState): GameState {
  const milestones = [...(state.milestones ?? [])]
  const add = (id: string) => {
    if (!milestones.includes(id)) milestones.push(id)
  }
  const stage = deriveCareerStage(state)
  if (stage === 'regional') add('stage_regional')
  if (stage === 'continental') add('stage_continental')
  if (stage === 'elite') add('stage_elite')
  if (state.nationalTotals.appearances > 0) add('national_debut')
  const trophies = state.seasons.reduce((n, season) => n + season.trophies.length, 0) + (state.nationalTrophies?.length ?? 0)
  if (trophies >= 1) add('first_trophy')
  if (trophies >= 5) add('trophy_cabinet')
  if ((state.player?.overall ?? 0) >= 85) add('ovr_85')
  return { ...state, careerStage: stage, milestones }
}

export function beginCareer(state: GameState): GameState {
  return startIdentity(state)
}

export function confirmIdentity(
  state: GameState,
  input: {
    lastName: string
    preferredNumber: number
    preferredFoot: PreferredFoot
    position: Position
    nationalityFifa: string
    heritageNationalityFifa?: string | null
  },
): GameState {
  const next = createPlayer(state, {
    ...input,
    heritageNationalityFifa: input.heritageNationalityFifa ?? null,
  })
  saveState(next)
  return next
}

export function confirmOriginClub(state: GameState, teamId: string): GameState {
  if (!state.player || state.phase !== 'origin') return state
  const team = getTeam(teamId)
  const roleRoll = nextRng(state.rngState)
  const role = academyStartRole(team, roleRoll.value)
  const ovrAdj = originOvrDelta(team, role)
  const built = buildOffer({
    rngState: roleRoll.state,
    player: state.player,
    teamId,
    kind: 'academy',
    preferredRole: role,
    step: state.step,
  })
  const offer = built.offer
  const newOvr = clampOverall(state, state.player.overall + ovrAdj.delta)
  const player = {
    ...state.player,
    overall: newOvr,
    wealth: state.player.wealth + offer.signingBonus,
  }
  let next: GameState = {
    ...state,
    rngState: built.state,
    phase: 'career',
    player,
    contract: {
      teamId: offer.teamId,
      annualWage: offer.annualWage,
      years: offer.years,
      yearsRemaining: offer.years,
      releaseClause: offer.releaseClause,
      signingBonus: offer.signingBonus,
      role: offer.role,
      transferFee: offer.transferFee,
    },
    currentTeamId: offer.teamId,
    formativeTeamId: state.formativeTeamId ?? offer.teamId,
    wealthEarned: state.wealthEarned + offer.signingBonus,
    pendingOffers: [],
    currentEvent: null,
    undisputedSeasonsRemaining:
      offer.role === 'undisputed' ? Math.max(state.undisputedSeasonsRemaining, 1) : state.undisputedSeasonsRemaining,
    log: [
      ...state.log,
      msg('log.signed', {
        team: team?.name ?? offer.teamId,
        wage: offer.annualWage,
        role: offer.role,
      }),
      ovrAdj.reason,
    ],
    step: state.step + 1,
  }
  next = { ...next, careerStage: deriveCareerStage(next) }
  next = maybeOpenTraitPick(next)
  if (!next.currentEvent) next = maybeOfferYouthLoanCard(next)
  if (!next.currentEvent) next = maybeBriefThenAdvance(next)
  saveState(next)
  return next
}

function maybeOfferYouthLoanCard(state: GameState): GameState {
  if (!shouldOfferYouthLoan(state)) return state
  return {
    ...state,
    youthLoanOffered: true,
    currentEvent: {
      type: 'youth_loan_choice',
      title: msg('youthLoan.title'),
      body: msg('youthLoan.body'),
    },
  }
}

export function respondYouthLoanChoice(state: GameState, requestLoan: boolean): GameState {
  if (state.currentEvent?.type !== 'youth_loan_choice') return state
  let next: GameState = { ...state, currentEvent: null, youthLoanOffered: true }
  if (requestLoan) {
    const generated = generateYouthLoanOffers(next)
    next = generated.state
    if (generated.offers.length) {
      next.currentEvent = {
        type: 'offer',
        title: msg('youthLoan.offerTitle'),
        body: msg('youthLoan.offerBody'),
        offers: generated.offers,
        canReject: true,
        canNegotiate: false,
      }
      next.pendingOffers = generated.offers
      saveState(next)
      return next
    }
  }
  next = maybeBriefThenAdvance(next)
  saveState(next)
  return next
}

export function chooseTraits(state: GameState, traitIds: TraitId[]): GameState {
  if (state.currentEvent?.type !== 'trait_pick') return state
  const unique = [...new Set(traitIds)].slice(0, 2)
  let next: GameState = {
    ...state,
    traits: unique,
    traitsChosen: true,
    currentEvent: null,
    log: [...state.log, msg('log.traits', { traits: unique.join(',') })],
    step: state.step + 1,
  }
  next = maybeOfferYouthLoanCard(next)
  if (!next.currentEvent) next = maybeBriefThenAdvance(next)
  saveState(next)
  return next
}

export function rollOriginClub(state: GameState): { state: GameState; teamId: string | null } {
  if (!state.player) return { state, teamId: null }
  const comps = competitionsForCountry(state.player.nationalityFifa)
  let s = state.rngState
  let poolTeams = comps.flatMap((competition) => teamsInCompetition(competition.id))
  if (poolTeams.length === 0) poolTeams = academyTeamsForCountry(state.player.nationalityFifa)
  if (poolTeams.length === 0) return { state, teamId: null }
  const weighted = poolTeams.map((team) => {
    const rep = team.international_reputation ?? 1
    let weight = 4
    if (rep >= 5) weight = 3
    else if (rep >= 4) weight = 4
    else if (rep >= 3) weight = 5
    else if (rep <= 1) weight = 6
    else weight = 5
    return { item: team, weight }
  })
  const pick = pickWeighted(s, weighted)
  s = pick.state
  return { state: { ...state, rngState: s }, teamId: pick.item.id }
}

export function acceptOffer(state: GameState, offerId: string): GameState {
  const offer =
    state.pendingOffers.find((candidate) => candidate.id === offerId) ||
    (state.currentEvent?.type === 'offer'
      ? state.currentEvent.offers.find((candidate) => candidate.id === offerId)
      : undefined)
  if (!offer || !state.player) return state

  const isLoan = offer.kind === 'loan'
  const player = {
    ...state.player,
    wealth: state.player.wealth + (isLoan ? 0 : offer.signingBonus),
  }
  const loanParent = isLoan ? state.activeLoanReturnTeamId ?? state.currentTeamId : null
  const signBonus = isLoan ? 0 : offer.signingBonus

  let next: GameState = {
    ...state,
    player,
    contract: {
      teamId: offer.teamId,
      annualWage: offer.annualWage,
      years: isLoan ? 1 : offer.years,
      yearsRemaining: isLoan ? 1 : offer.years,
      releaseClause: offer.releaseClause,
      signingBonus: signBonus,
      role: offer.role,
      transferFee: isLoan ? undefined : offer.transferFee,
    },
    currentTeamId: offer.teamId,
    activeLoanReturnTeamId: isLoan ? loanParent : null,
    wealthEarned: state.wealthEarned + signBonus,
    pendingOffers: [],
    currentEvent: null,
    undisputedSeasonsRemaining:
      offer.role === 'undisputed'
        ? Math.max(state.undisputedSeasonsRemaining, 1)
        : state.undisputedSeasonsRemaining,
    log: [
      ...state.log,
      msg(isLoan ? 'log.loanSigned' : 'log.signed', {
        team: getTeam(offer.teamId)?.name ?? offer.teamId,
        wage: offer.annualWage,
        role: offer.role,
      }),
    ],
    step: state.step + 1,
  }

  next = { ...next, careerStage: deriveCareerStage(next) }
  next = syncMilestones(next)
  next = assignObjective(next)
  next = markObjectiveBriefedSilent(next)
  next = advanceAfterDecision(next)
  saveState(next)
  return next
}

export function rejectOffers(state: GameState): GameState {
  if (state.currentEvent?.type !== 'offer' || !state.currentEvent.canReject) return state
  let next: GameState = {
    ...state,
    pendingOffers: [],
    currentEvent: null,
    step: state.step + 1,
    log: [...state.log, msg('log.rejected_offers')],
  }
  if (next.activeLoanReturnTeamId && next.contract && next.contract.yearsRemaining <= 0) {
    next = resolveLoanReturn(next)
  }
  if (!next.currentTeamId) {
    next = toRetireEvent(next, 'no_offers')
    saveState(next)
    return next
  }
  next = assignObjective(next)
  next = markObjectiveBriefedSilent(next)
  next = advanceAfterDecision(next)
  saveState(next)
  return next
}

export function openNegotiation(state: GameState, offerId: string): GameState {
  const offer =
    state.pendingOffers.find((candidate) => candidate.id === offerId) ||
    (state.currentEvent?.type === 'offer'
      ? state.currentEvent.offers.find((candidate) => candidate.id === offerId)
      : undefined)
  if (!offer) return state
  const next: GameState = {
    ...state,
    pendingOffers: state.pendingOffers.length
      ? state.pendingOffers
      : state.currentEvent?.type === 'offer'
        ? state.currentEvent.offers
        : [offer],
    currentEvent: {
      type: 'negotiation',
      title: msg('negotiate.title'),
      body: msg('negotiate.body', { team: getTeam(offer.teamId)?.name ?? offer.teamId }),
      offer,
    },
  }
  saveState(next)
  return next
}

export function submitNegotiation(
  state: GameState,
  ask: Partial<Pick<ClubOffer, 'annualWage' | 'years' | 'releaseClause' | 'role' | 'signingBonus'>>,
): GameState {
  if (state.currentEvent?.type !== 'negotiation') return state
  const result = negotiateOffer(state.rngState, state.currentEvent.offer, ask)
  let next: GameState = { ...state, rngState: result.state }

  if (result.result === 'walked') {
    const remaining = state.pendingOffers.filter((offer) => offer.id !== result.offer.id)
    if (remaining.length === 0 && !state.currentTeamId) {
      const academy = generateAcademyOffers({ ...next, pendingOffers: [] })
      next = academy.state
      next.currentEvent = {
        type: 'offer',
        title: msg('offer.academyTitle'),
        body: msg('negotiate.walked'),
        offers: academy.offers,
        canReject: false,
        canNegotiate: true,
      }
      next.pendingOffers = academy.offers
      next.log = [...next.log, msg('log.walked')]
      saveState(next)
      return next
    }
    next = {
      ...next,
      currentEvent: {
        type: 'offer',
        title: msg('offer.transferTitle'),
        body: msg('negotiate.walked'),
        offers: remaining,
        canReject: Boolean(state.currentTeamId),
        canNegotiate: true,
      },
      pendingOffers: remaining,
      log: [...next.log, msg('log.walked')],
    }
    if (remaining.length === 0) {
      return rejectOffers({
        ...next,
        currentEvent: {
          type: 'offer',
          title: msg('offer.transferTitle'),
          body: msg('negotiate.walked'),
          offers: [],
          canReject: true,
          canNegotiate: true,
        },
      })
    }
    saveState(next)
    return next
  }

  const updatedOffers = state.pendingOffers.map((offer) =>
    offer.id === result.offer.id ? result.offer : offer,
  )
  next = {
    ...next,
    pendingOffers: updatedOffers,
    currentEvent: {
      type: 'offer',
      title: msg(result.result === 'accepted' ? 'negotiate.accepted' : 'negotiate.counter'),
      body: msg(result.result === 'accepted' ? 'negotiate.acceptedBody' : 'negotiate.counterBody'),
      offers: updatedOffers,
      canReject: result.offer.kind !== 'academy',
      canNegotiate: result.offer.negotiationRound < 3,
    },
    log: [...next.log, msg(result.result === 'accepted' ? 'log.deal' : 'log.counter')],
  }
  saveState(next)
  return next
}

export function chooseCareerEvent(state: GameState, choiceId: string): GameState {
  const resolved = resolveCareerChoice(state, choiceId)
  return commitCareerChoiceResult(resolved)
}

export function previewCareerChoice(
  state: GameState,
  choiceId: string,
): {
  choiceId: string
  winningIndex: number
  outcomes: import('../data/eventAssets').EventOutcomePill[]
  resolved: ReturnType<typeof resolveCareerChoice>
} {
  const resolved = resolveCareerChoice(state, choiceId)
  const visual = eventChoiceVisual(
    state.currentEvent?.type === 'career_choice' ? state.currentEvent.eventId : '',
    choiceId,
  )
  const outcomes = visual?.outcomes ?? [{ tone: 'neutral' as const, label: 'actions.continue' }]
  return {
    choiceId,
    winningIndex: Math.min(resolved.outcomeIndex ?? 0, Math.max(0, outcomes.length - 1)),
    outcomes,
    resolved,
  }
}

export function commitCareerChoiceResult(resolved: ReturnType<typeof resolveCareerChoice>): GameState {
  let next = resolved.state
  if (resolved.forceRetire) {
    next = toRetireEvent(next, resolved.forceRetire)
    saveState(next)
    return next
  }
  next = syncMilestones(next)
  next = absorbSoftCelebration(next)
  if (!next.currentEvent && !next.celebration) next = advanceAfterDecision(next)
  saveState(next)
  return next
}

function absorbSoftCelebration(state: GameState): GameState {
  const celebration = state.celebration
  if (!celebration) return state
  if (celebration.kind === 'trophy' || (celebration.trophies && celebration.trophies.length > 0)) return state
  if (celebration.kind === 'boost' || celebration.kind === 'fortune' || celebration.kind === 'ruin') {
    return { ...state, celebration: null, log: [...state.log, celebration.message] }
  }
  return state
}

export function callAgentRerollOffers(state: GameState): GameState {
  if (state.agentRerollUsed || state.currentEvent?.type !== 'offer' || !state.player) return state
  if (!state.currentTeamId) return state
  const generated = generateTransferOffers({ ...state, pendingOffers: [] })
  if (!generated.offers.length) return state
  const next: GameState = {
    ...generated.state,
    agentRerollUsed: true,
    pendingOffers: generated.offers,
    currentEvent: {
      type: 'offer',
      title: msg('offer.transferTitle'),
      body: msg('offer.transferBody'),
      offers: generated.offers,
      canReject: true,
      canNegotiate: true,
    },
    log: [...state.log, msg('log.agent')],
  }
  saveState(next)
  return next
}

export function continueAfterSeason(state: GameState): GameState {
  let next: GameState = { ...state, currentEvent: null, celebration: null }
  next = advanceAfterDecision(next)
  saveState(next)
  return next
}

export function dismissCelebration(state: GameState): GameState {
  let next: GameState = { ...state, celebration: null }

  if (!next.currentEvent && hasModifier(next, 'career_ruined')) {
    const current = next.currentTeamId ? getTeam(next.currentTeamId) : undefined
    const alreadyAtMinor = (current?.international_reputation ?? 99) <= 2
    if (!alreadyAtMinor) {
      const recovery = generateRecoveryOffers(next)
      next = recovery.state
      if (recovery.offers.length) {
        next.currentEvent = {
          type: 'offer',
          title: msg('offer.recoveryTitle'),
          body: msg('offer.recoveryBody'),
          offers: recovery.offers,
          canReject: true,
          canNegotiate: true,
        }
        next.pendingOffers = recovery.offers
        saveState(next)
        return next
      }
    }
  }

  if (!next.currentEvent) {
    if (next.seasons.length === 0) next = maybeBriefThenAdvance(next)
    else next = advanceAfterDecision(next)
  }
  saveState(next)
  return next
}

function advanceAfterDecision(state: GameState): GameState {
  let next = syncMilestones(state)
  const retire = shouldRetire(next)
  if (retire.retire && retire.reason) return toRetireEvent(next, retire.reason)

  if (!next.currentTeamId || !next.contract) {
    const academy = generateAcademyOffers(next)
    next = academy.state
    if (!academy.offers.length) return toRetireEvent(next, 'no_offers')
    next.currentEvent = {
      type: 'offer',
      title: msg('offer.academyTitle'),
      body: msg('offer.academyBody'),
      offers: academy.offers,
      canReject: false,
      canNegotiate: true,
    }
    next.pendingOffers = academy.offers
    return next
  }

  next = ensureObjective(next)

  const period = MODE_CONFIG[next.mode].periodLengthSeasons
  let lastSeason = null as ReturnType<typeof simulateOneSeason>['season'] | null

  for (let i = 0; i < period; i += 1) {
    const sim = simulateOneSeason(next)
    next = sim.state
    lastSeason = sim.season
    const midRetire = shouldRetire(next)
    if (midRetire.retire && midRetire.reason) return toRetireEvent(next, midRetire.reason)
  }

  if (lastSeason) {
    const age = next.player?.age ?? lastSeason.age
    next.currentEvent = {
      type: 'season_result',
      title: msg('season.resultTitle', { age }),
      body: msg(`stage.${next.careerStage}`),
      season: lastSeason,
    }
    if (lastSeason.trophies.length) {
      next.celebration = {
        kind: 'trophy',
        message: msg('celebration.trophy'),
        trophies: lastSeason.trophies,
      }
    }
    return next
  }

  return next
}

export function afterSeasonContinue(state: GameState): GameState {
  let next: GameState = { ...state, currentEvent: null }

  if (next.activeLoanReturnTeamId && next.contract && next.contract.yearsRemaining <= 0) {
    if (loanPerformanceAllowsContinue(next) && (next.player?.age ?? 99) <= 22) {
      const generated = generateYouthLoanOffers(next)
      next = generated.state
      if (generated.offers.length) {
        next.currentEvent = {
          type: 'offer',
          title: msg('youthLoan.continueTitle'),
          body: msg('youthLoan.continueBody'),
          offers: generated.offers,
          canReject: true,
          canNegotiate: false,
        }
        next.pendingOffers = generated.offers
        saveState(next)
        return next
      }
    }
    next = resolveLoanReturn(next)
  }

  const needsNewObjective =
    !next.seasonObjective ||
    Boolean(next.seasonObjective.completed) ||
    Boolean(next.seasonObjective.failed)
  if (needsNewObjective) next = { ...next, seasonObjective: null }

  next = syncMilestones(next)

  const retire = shouldRetire(next)
  if (retire.retire && retire.reason) {
    next = toRetireEvent(next, retire.reason)
    saveState(next)
    return next
  }

  next = continueCareerPipeline(next)
  saveState(next)
  return next
}

export function dismissObjectiveBriefing(state: GameState): GameState {
  let next: GameState = {
    ...state,
    currentEvent: state.currentEvent?.type === 'objective_briefing' ? null : state.currentEvent,
  }
  next = ensureObjective(next)
  if (next.seasons.length === 0) next = advanceAfterDecision(next)
  else next = continueCareerPipeline(next)
  saveState(next)
  return next
}

function continueCareerPipeline(state: GameState): GameState {
  let next = state

  if (next.pendingNationalCallup && next.player) {
    const pending = next.pendingNationalCallup
    const countryFifa = pending.countryFifa || next.player.nationalityFifa
    const country = getCountry(countryFifa)
    const confCup = nationalCupName(country?.confederation)
    const projected = pending.projected
    next.currentEvent = {
      type: 'national_callup',
      title: msg(pending.viaHeritage ? 'national.heritageTitle' : 'national.callupTitle'),
      body: msg('national.callupBody', {
        countryFifa,
        apps: projected.appearances,
        goals: projected.goals,
        assists: projected.assists,
        cup: confCup,
      }),
      projected,
      countryFifa,
      viaHeritage: pending.viaHeritage,
    }
    return next
  }

  const contract = next.contract
  if (!next.player || !contract) return advanceAfterDecision(next)

  const chance = MODE_CONFIG[next.mode].personalEventChance
  const roll = nextRng(next.rngState)
  next = { ...next, rngState: roll.state }

  const contractEnding = contract.yearsRemaining <= 0
  const ambitiousBoost = (next.traits ?? []).includes('ambitious') ? 0.08 : 0
  const loyalNerf = (next.traits ?? []).includes('loyal') ? 0.1 : 0
  const wantTransfer = contractEnding || roll.value > 0.72 - ambitiousBoost + loyalNerf

  const ruined = hasModifier(next, 'career_ruined')
  if (wantTransfer || ruined) {
    if (ruined) {
      const recovery = generateRecoveryOffers(next)
      next = recovery.state
      if (recovery.offers.length) {
        next.currentEvent = {
          type: 'offer',
          title: msg('offer.recoveryTitle'),
          body: msg('offer.recoveryBody'),
          offers: recovery.offers,
          canReject: !contractEnding,
          canNegotiate: true,
        }
        next.pendingOffers = recovery.offers
        return next
      }
    }
    const offers = generateTransferOffers(next)
    next = offers.state
    if (offers.offers.length) {
      const hasRenewal = offers.offers.some((offer) => offer.kind === 'renewal')
      next.currentEvent = {
        type: 'offer',
        title: msg(
          contractEnding
            ? hasRenewal
              ? 'offer.contractExpiredRenewTitle'
              : 'offer.renewalTitle'
            : 'offer.transferTitle',
        ),
        body: msg(
          contractEnding
            ? hasRenewal
              ? 'offer.contractExpiredRenewBody'
              : 'offer.renewalBody'
            : 'offer.transferBody',
        ),
        offers: offers.offers,
        canReject: !contractEnding,
        canNegotiate: true,
      }
      next.pendingOffers = offers.offers
      return next
    }
    if (contractEnding) return toRetireEvent(next, 'no_offers')
  }

  if (roll.value < chance) {
    next = buildCareerEvent(next)
    if (next.currentEvent) return next
  }

  next = ensureObjective(next)
  return advanceAfterDecision(next)
}

export function respondNationalCallup(state: GameState, accept: boolean): GameState {
  let next = accept ? applyNationalCallup(state) : rejectNationalCallup(state)
  next = { ...next, currentEvent: null }
  next = syncMilestones(next)
  next = afterSeasonContinue({ ...next, pendingNationalCallup: null })
  saveState(next)
  return next
}

export function goToSummary(state: GameState): GameState {
  const next = { ...syncMilestones(state), phase: 'summary' as const }
  saveState(next)
  return next
}

export function eventLabel(eventId: string): string {
  const def = getEventDef(eventId)
  return def?.titleKey ?? eventId
}
