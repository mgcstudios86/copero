import { getCompetition, getTeam } from '../data/catalog'
import { bumpOfferForElite } from '../engine/contract'
import { clampOverall, estimateMarketValue } from '../engine/development'
import { competitionAtTier, effectiveCompetitionId } from '../engine/league'
import { msg } from '../engine/messages'
import { addModifier, hasModifier, removeModifier } from '../engine/modifiers'
import { nextRng } from '../engine/rng'
import { generateEliteOffer, generateTransferOffers } from '../engine/transfer'
import type { GameState } from '../engine/types'
import { getEventDef } from './catalog'

export type ResolveResult = {
  state: GameState
  forceRetire?: 'medical' | 'ruined'
  /** Índice de la pill ganadora en eventAssets (ruleta UI) */
  outcomeIndex?: number
}

export function resolveCareerChoice(state: GameState, choiceId: string): ResolveResult {
  const event = state.currentEvent
  if (!event || event.type !== 'career_choice' || !state.player) return { state }

  const def = getEventDef(event.eventId)
  let next: GameState = {
    ...state,
    step: state.step + 1,
    currentEvent: null,
    celebration: null,
  }
  const player = { ...state.player }
  let s = next.rngState
  let outcomeIndex = 0

  const applyOvr = (delta: number) => {
    player.overall = clampOverall(next, player.overall + delta)
    const team = next.currentTeamId ? getTeam(next.currentTeamId) : undefined
    player.marketValue = estimateMarketValue(
      player.overall,
      player.age,
      team?.international_reputation ?? 1,
    )
  }

  switch (event.eventId) {
    case 'personal_coach':
      if (choiceId === 'accept') {
        const roll = nextRng(s)
        s = roll.state
        if (roll.value < 0.6) {
          applyOvr(3)
          next.celebration = { kind: 'boost', message: msg('celebration.nutrition_ok') }
          outcomeIndex = 0
        } else {
          applyOvr(-2)
          next.celebration = { kind: 'ruin', message: msg('celebration.nutrition_bad') }
          outcomeIndex = 1
        }
      }
      break
    case 'position_change':
      if (choiceId === 'accept') {
        applyOvr(-2)
        if (next.contract) {
          next.contract = { ...next.contract, role: 'starter' }
          next.undisputedSeasonsRemaining = Math.max(next.undisputedSeasonsRemaining, 1)
        }
        next.celebration = { kind: 'boost', message: msg('celebration.position_change') }
        outcomeIndex = 0
      } else if (next.contract) {
        next.contract = { ...next.contract, role: 'rotation' }
        next.log = [...next.log, msg('log.fewer_minutes')]
        outcomeIndex = 0
      }
      break
    case 'training_extra':
      if (choiceId === 'accept') {
        const roll = nextRng(s)
        s = roll.state
        if (roll.value < 0.7) {
          applyOvr(2)
          next.log = [...next.log, msg('log.training_boost')]
          next.celebration = { kind: 'boost', message: msg('celebration.nutrition_ok') }
          outcomeIndex = 0
        } else {
          applyOvr(-1)
          next.celebration = { kind: 'ruin', message: msg('celebration.nutrition_bad') }
          outcomeIndex = 1
        }
      }
      break
    case 'rival_offer':
      if (choiceId === 'listen') {
        const offers = generateTransferOffers({ ...next, player, rngState: s })
        next = { ...offers.state, player }
        s = next.rngState
        if (offers.offers.length) {
          next.currentEvent = {
            type: 'offer',
            title: msg('offer.transferTitle'),
            body: msg('offer.transferBody'),
            offers: offers.offers,
            canReject: true,
            canNegotiate: true,
          }
          next.pendingOffers = offers.offers
        }
        outcomeIndex = 0
      }
      break
    case 'club_crisis':
      if (choiceId === 'request_exit') {
        const offers = generateTransferOffers({ ...next, player, rngState: s })
        next = { ...offers.state, player }
        s = next.rngState
        if (offers.offers.length) {
          next.currentEvent = {
            type: 'offer',
            title: msg('offer.transferTitle'),
            body: msg('offer.transferBody'),
            offers: offers.offers,
            canReject: true,
            canNegotiate: true,
          }
          next.pendingOffers = offers.offers
        }
        next.celebration = { kind: 'boost', message: msg('celebration.crisis_exit') }
        outcomeIndex = 0
      } else {
        applyOvr(1)
        if (next.contract) {
          next.contract = { ...next.contract, role: 'undisputed' }
          next.undisputedSeasonsRemaining = Math.max(next.undisputedSeasonsRemaining, 1)
        }
        next.celebration = { kind: 'boost', message: msg('celebration.leader') }
        outcomeIndex = 0
      }
      break
    case 'mysterious_substance':
      if (choiceId === 'consume') {
        const roll = nextRng(s)
        s = roll.state
        if (roll.value < 0.45) {
          applyOvr(2)
          next = addModifier(next, 'glass_body')
          next.celebration = { kind: 'boost', message: msg('celebration.risky_boost') }
          outcomeIndex = 0
        } else {
          next = addModifier(next, 'banned')
          next.banSeasonsRemaining = 2
          applyOvr(-6)
          next.celebration = { kind: 'ruin', message: msg('celebration.substance_fail') }
          outcomeIndex = 1
        }
      } else {
        applyOvr(1)
        outcomeIndex = 0
      }
      break
    case 'scout_discovery': {
      applyOvr(4)
      next = addModifier(next, 'golden_boy')
      const elite = generateEliteOffer({ ...next, player, rngState: s })
      next = { ...elite.state, player }
      s = next.rngState
      if (elite.offer) {
        const bumped = bumpOfferForElite(s, elite.offer)
        s = bumped.state
        next.currentEvent = {
          type: 'offer',
          title: msg('offer.eliteTitle'),
          body: msg('offer.eliteBody'),
          offers: [bumped.offer],
          canReject: true,
          canNegotiate: true,
        }
        next.pendingOffers = [bumped.offer]
      }
      next.celebration = { kind: 'boost', message: msg('celebration.scout') }
      break
    }
    case 'final_hattrick':
      applyOvr(3)
      player.wealth += 500_000
      next.wealthEarned += 500_000
      next.undisputedSeasonsRemaining = Math.max(next.undisputedSeasonsRemaining, 2)
      if (next.contract) next.contract = { ...next.contract, role: 'undisputed' }
      next.celebration = { kind: 'boost', message: msg('celebration.hattrick') }
      break
    case 'iron_genetics':
      if (choiceId === 'accept') {
        next = addModifier(next, 'injury_immunity')
        next = removeModifier(next, 'glass_body')
        next.celebration = { kind: 'fortune', message: msg('celebration.immunity') }
      }
      break
    case 'miracle_doctor':
      if (choiceId === 'accept') {
        next = addModifier(next, 'iron_longevity')
        next.celebration = { kind: 'fortune', message: msg('celebration.longevity') }
      }
      break
    case 'media_scandal':
      if (choiceId === 'apologize') {
        applyOvr(-6)
        if (next.contract) next.contract = { ...next.contract, role: 'bench' }
        next = addModifier(next, 'form_dip')
        next.celebration = { kind: 'ruin', message: msg('celebration.scandal_sorry') }
      } else {
        applyOvr(-15)
        if (next.contract) next.contract = { ...next.contract, role: 'bench' }
        next = addModifier(next, 'career_ruined')
        next.ruinedAtSeasonIndex = next.seasons.length
        next.celebration = { kind: 'ruin', message: msg('celebration.scandal') }
      }
      break
    case 'career_ending_injury':
      if (hasModifier(next, 'injury_immunity')) {
        next.log = [...next.log, msg('log.immunity_saved')]
        next.celebration = { kind: 'fortune', message: msg('celebration.immunity_saved') }
        break
      }
      if (choiceId === 'retire_medical') {
        next = { ...next, player, rngState: s }
        return { state: next, forceRetire: 'medical' }
      }
      applyOvr(-20)
      next = addModifier(next, 'glass_body')
      next.celebration = { kind: 'ruin', message: msg('celebration.career_injury') }
      break
    case 'agent_scam': {
      const loss = Math.round(player.wealth * (choiceId === 'sue' ? 0.25 : 0.5))
      player.wealth = Math.max(0, player.wealth - loss)
      if (next.contract) {
        next.contract = {
          ...next.contract,
          annualWage: Math.round(next.contract.annualWage * 0.5),
          releaseClause: Math.round(next.contract.releaseClause * 0.6),
        }
      }
      next.celebration = { kind: 'ruin', message: msg('celebration.scam', { loss }) }
      break
    }
    case 'doping_temptation':
      if (choiceId === 'consume') {
        const roll = nextRng(s)
        s = roll.state
        if (roll.value < 0.25) {
          applyOvr(3)
          next = addModifier(next, 'glass_body')
          next.celebration = { kind: 'boost', message: msg('celebration.risky_boost') }
          outcomeIndex = 0
        } else {
          next = addModifier(next, 'banned')
          next = addModifier(next, 'career_ruined')
          next.ruinedAtSeasonIndex = next.ruinedAtSeasonIndex ?? next.seasons.length
          next.banSeasonsRemaining = 3
          applyOvr(-8)
          next.celebration = { kind: 'ruin', message: msg('celebration.doping') }
          outcomeIndex = 1
        }
      } else {
        applyOvr(1)
        next.log = [...next.log, msg('log.clean')]
        outcomeIndex = 0
      }
      break
    case 'mx_food_poisoning':
      if (choiceId === 'rest') {
        applyOvr(-1)
        next = addModifier(next, 'form_dip')
        next.celebration = { kind: 'ruin', message: msg('celebration.mx_food_rest') }
        outcomeIndex = 0
      } else {
        applyOvr(-3)
        next = addModifier(next, 'glass_body')
        next.celebration = { kind: 'ruin', message: msg('celebration.mx_food_play') }
        outcomeIndex = 1
      }
      break
    case 'mx_clasico_pressure':
      if (choiceId === 'embrace') {
        const roll = nextRng(s)
        s = roll.state
        if (roll.value < 0.55) {
          applyOvr(2)
          next = addModifier(next, 'form_boost')
          next.celebration = { kind: 'boost', message: msg('celebration.mx_clasico_ok') }
          outcomeIndex = 0
        } else {
          applyOvr(-1)
          next.celebration = { kind: 'ruin', message: msg('celebration.mx_clasico_bad') }
          outcomeIndex = 1
        }
      } else {
        if (next.contract) next.contract = { ...next.contract, role: 'bench' }
        next.log = [...next.log, msg('log.fewer_minutes')]
      }
      break
    case 'ar_media_pressure':
      if (choiceId === 'face_cameras') {
        applyOvr(1)
        player.wealth += 80_000
        next.wealthEarned += 80_000
        next.celebration = { kind: 'boost', message: msg('celebration.ar_media_ok') }
      } else {
        applyOvr(-1)
        next = addModifier(next, 'form_dip')
        next.celebration = { kind: 'ruin', message: msg('celebration.ar_media_silence') }
      }
      break
    case 'ar_clasico_week':
      if (choiceId === 'ready') {
        applyOvr(2)
        next.undisputedSeasonsRemaining = Math.max(next.undisputedSeasonsRemaining, 1)
        next.celebration = { kind: 'boost', message: msg('celebration.ar_clasico') }
      } else {
        applyOvr(-1)
      }
      break
    case 'ar_ascenso_opportunity':
      if (choiceId === 'seize') {
        applyOvr(3)
        next = addModifier(next, 'form_boost')
        if (next.currentTeamId) {
          const cid = effectiveCompetitionId(next.currentTeamId, next)
          const comp = getCompetition(cid)
          const tier = comp?.tier ?? 1
          if (comp && tier >= 2) {
            const up = competitionAtTier(comp.country_fifa_code, tier - 1)
            if (up) {
              next.teamCompetitionOverrides = {
                ...(next.teamCompetitionOverrides ?? {}),
                [next.currentTeamId]: up.id,
              }
            }
          }
        }
        next.celebration = { kind: 'fortune', message: msg('celebration.ar_ascenso') }
      }
      break
    case 'br_calendar_fatigue':
      if (choiceId === 'rotate') {
        applyOvr(1)
        next.celebration = { kind: 'boost', message: msg('celebration.br_rotate') }
      } else {
        applyOvr(-2)
        next = addModifier(next, 'glass_body')
        next.celebration = { kind: 'ruin', message: msg('celebration.br_push') }
      }
      break
    case 'br_rival_serie_a':
      if (choiceId === 'listen') {
        const offers = generateTransferOffers({ ...next, player, rngState: s })
        next = { ...offers.state, player }
        s = next.rngState
        if (offers.offers.length) {
          next.currentEvent = {
            type: 'offer',
            title: msg('offer.transferTitle'),
            body: msg('offer.transferBody'),
            offers: offers.offers,
            canReject: true,
            canNegotiate: true,
          }
          next.pendingOffers = offers.offers
        }
      }
      break
    case 'br_carnival_break':
      if (choiceId === 'rest') {
        applyOvr(1)
        next = removeModifier(next, 'form_dip')
        next.celebration = { kind: 'boost', message: msg('celebration.br_rest') }
      } else {
        const roll = nextRng(s)
        s = roll.state
        if (roll.value < 0.4) {
          applyOvr(1)
          next.celebration = { kind: 'fortune', message: msg('celebration.br_party_ok') }
        } else {
          applyOvr(-2)
          next = addModifier(next, 'form_dip')
          next.celebration = { kind: 'ruin', message: msg('celebration.br_party_bad') }
        }
      }
      break
    case 'eu_travel_fatigue':
      if (choiceId === 'recover') applyOvr(1)
      else {
        applyOvr(-1)
        next = addModifier(next, 'form_dip')
      }
      break
    case 'eu_adaptation':
      if (choiceId === 'integrate') {
        applyOvr(2)
        next = removeModifier(next, 'homesick')
        next.celebration = { kind: 'boost', message: msg('celebration.eu_adapt_ok') }
      } else {
        next = addModifier(next, 'homesick')
        applyOvr(-1)
        next.celebration = { kind: 'ruin', message: msg('celebration.eu_adapt_bad') }
      }
      break
    case 'mena_exit_clause':
      if (choiceId === 'accept_money') {
        player.wealth += 2_000_000
        next.wealthEarned += 2_000_000
        if (next.contract) {
          next.contract = {
            ...next.contract,
            releaseClause: Math.round(next.contract.releaseClause * 0.55),
            yearsRemaining: Math.max(1, next.contract.yearsRemaining),
          }
        }
        next.celebration = { kind: 'boost', message: msg('celebration.mena_money') }
      } else if (next.contract) {
        next.contract = {
          ...next.contract,
          releaseClause: Math.round(next.contract.releaseClause * 1.35),
        }
        next.celebration = { kind: 'fortune', message: msg('celebration.mena_clause') }
      }
      break
    case 'mls_adaptation':
      if (choiceId === 'buy_in') {
        applyOvr(2)
        next.celebration = { kind: 'boost', message: msg('celebration.mls_ok') }
      } else {
        applyOvr(-1)
        next = addModifier(next, 'homesick')
      }
      break
    case 'concacaf_heat':
      if (choiceId !== 'hydrate') {
        applyOvr(-2)
        next = addModifier(next, 'form_dip')
        next.celebration = { kind: 'ruin', message: msg('celebration.heat') }
      } else {
        applyOvr(0)
      }
      break
    default:
      break
  }

  const choiceDef = def?.choices.find((choice) => choice.id === choiceId)
  next = {
    ...next,
    player,
    rngState: s,
    log: def
      ? [
          ...next.log,
          msg('log.eventChoice', {
            event: def.titleKey,
            choice: choiceDef?.labelKey ?? choiceId,
          }),
        ]
      : next.log,
  }
  return { state: next, outcomeIndex }
}
