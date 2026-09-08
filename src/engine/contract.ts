import { getTeam } from '../data/catalog'
import { estimateMarketValue } from './development'
import { nextRng, pickOne, randomInt } from './rng'
import type { ClubOffer, PlayingRole, Player } from './types'

const ROLE_WAGE_MULT: Record<PlayingRole, number> = {
  bench: 0.65,
  rotation: 0.85,
  starter: 1,
  undisputed: 1.35,
}

export function baseWage(overall: number, reputation: number, role: PlayingRole): number {
  const raw = Math.pow(Math.max(45, overall) / 50, 3.6) * 180_000 * (0.5 + reputation * 0.35)
  const wage = raw * ROLE_WAGE_MULT[role]
  if (wage >= 1_000_000) return Math.round(wage / 50_000) * 50_000
  if (wage >= 100_000) return Math.round(wage / 10_000) * 10_000
  return Math.round(wage / 5_000) * 5_000
}

export function buildOffer(params: {
  rngState: number
  player: Player
  teamId: string
  kind: ClubOffer['kind']
  preferredRole?: PlayingRole
  step: number
}): { state: number; offer: ClubOffer } {
  const team = getTeam(params.teamId)
  const rep = team?.international_reputation ?? 1
  let s = params.rngState

  const roleRoll = nextRng(s)
  s = roleRoll.state
  let role: PlayingRole = params.preferredRole ?? 'rotation'
  if (!params.preferredRole) {
    if (params.player.overall >= 82 && roleRoll.value > 0.35) role = 'starter'
    else if (params.player.overall >= 88 && roleRoll.value > 0.2) role = 'undisputed'
    else if (params.player.overall < 62) role = roleRoll.value > 0.5 ? 'bench' : 'rotation'
    else role = roleRoll.value > 0.55 ? 'starter' : 'rotation'
  }

  const yearsRoll = randomInt(s, 1, params.kind === 'loan' ? 1 : 5)
  s = yearsRoll.state
  const years = params.kind === 'academy' ? Math.max(2, yearsRoll.value) : yearsRoll.value

  const wage = baseWage(params.player.overall, rep, role)
  const market = estimateMarketValue(params.player.overall, params.player.age, rep)
  const bonusRoll = nextRng(s)
  s = bonusRoll.state
  const signingBonus = Math.round((wage * (0.15 + bonusRoll.value * 0.45)) / 10_000) * 10_000
  const clause = Math.round((market * (1.4 + bonusRoll.value)) / 100_000) * 100_000
  const fee =
    params.kind === 'transfer'
      ? Math.round((market * (0.7 + bonusRoll.value * 0.5)) / 100_000) * 100_000
      : undefined

  return {
    state: s,
    offer: {
      id: `${params.kind}-${params.teamId}-${params.step}`,
      teamId: params.teamId,
      annualWage: wage,
      years,
      yearsRemaining: years,
      releaseClause: Math.max(clause, wage * 3),
      signingBonus,
      role,
      transferFee: fee,
      negotiationRound: 0,
      kind: params.kind,
    },
  }
}

export function negotiateOffer(
  rngState: number,
  offer: ClubOffer,
  ask: Partial<Pick<ClubOffer, 'annualWage' | 'years' | 'releaseClause' | 'role' | 'signingBonus'>>,
): { state: number; result: 'accepted' | 'counter' | 'walked'; offer: ClubOffer } {
  let s = rngState
  const team = getTeam(offer.teamId)
  const rep = team?.international_reputation ?? 1
  const generosity = 0.35 + (5 - rep) * 0.06

  const desiredWage = ask.annualWage ?? offer.annualWage
  const desiredYears = ask.years ?? offer.years
  const desiredClause = ask.releaseClause ?? offer.releaseClause
  const desiredRole = ask.role ?? offer.role
  const desiredBonus = ask.signingBonus ?? offer.signingBonus

  const wagePush = desiredWage / Math.max(1, offer.annualWage)
  const roleUpgrade =
    (['bench', 'rotation', 'starter', 'undisputed'].indexOf(desiredRole) -
      ['bench', 'rotation', 'starter', 'undisputed'].indexOf(offer.role)) *
    0.12

  const pressure = (wagePush - 1) * 0.9 + roleUpgrade + (desiredYears - offer.years) * 0.05
  const roll = nextRng(s)
  s = roll.state
  const threshold = generosity + 0.15 - offer.negotiationRound * 0.12

  if (pressure > threshold + 0.35 && roll.value > 0.4) {
    return { state: s, result: 'walked', offer }
  }

  if (pressure <= threshold || roll.value < 0.35) {
    return {
      state: s,
      result: 'accepted',
      offer: {
        ...offer,
        annualWage: desiredWage,
        years: desiredYears,
        yearsRemaining: desiredYears,
        releaseClause: desiredClause,
        role: desiredRole,
        signingBonus: desiredBonus,
        negotiationRound: offer.negotiationRound + 1,
      },
    }
  }

  const midWage = Math.round(((offer.annualWage + desiredWage) / 2) / 5_000) * 5_000
  const roles: PlayingRole[] = ['bench', 'rotation', 'starter', 'undisputed']
  const currentIdx = roles.indexOf(offer.role)
  const askIdx = roles.indexOf(desiredRole)
  const midRole = roles[Math.min(askIdx, currentIdx + (askIdx > currentIdx ? 1 : 0))]

  return {
    state: s,
    result: 'counter',
    offer: {
      ...offer,
      annualWage: midWage,
      years: Math.round((offer.years + desiredYears) / 2),
      yearsRemaining: Math.round((offer.years + desiredYears) / 2),
      releaseClause: Math.round((offer.releaseClause + desiredClause) / 2 / 50_000) * 50_000,
      role: midRole,
      signingBonus: Math.round((offer.signingBonus + desiredBonus) / 2 / 10_000) * 10_000,
      negotiationRound: offer.negotiationRound + 1,
    },
  }
}

/** Translation key only; UI owns localization. */
export function roleLabel(role: PlayingRole): string {
  return `role.${role}`
}

export function pickRoleForAsk(current: PlayingRole): PlayingRole {
  const roles: PlayingRole[] = ['bench', 'rotation', 'starter', 'undisputed']
  return roles[Math.min(roles.length - 1, roles.indexOf(current) + 1)]
}

export function bumpOfferForElite(rngState: number, offer: ClubOffer) {
  const r = pickOne(rngState, [1.15, 1.25, 1.4] as const)
  return {
    state: r.state,
    offer: {
      ...offer,
      annualWage: Math.round((offer.annualWage * r.item) / 5_000) * 5_000,
      role: 'undisputed' as const,
      signingBonus: Math.round((offer.signingBonus * 1.5) / 10_000) * 10_000,
    },
  }
}
