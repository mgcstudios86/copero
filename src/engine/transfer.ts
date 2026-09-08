import { academyTeamsForCountry, getCompetition, getTeam, teams, teamsAtReputation, teamsUpToReputation } from '../data/catalog'
import {
  deriveCareerStage,
  isShowcaseClub,
  pathReasonFor,
  peakClubReputation,
  prestigePathScore,
} from './careerPath'
import { buildOffer } from './contract'
import { offerReputationCap } from './modifiers'
import { nextRng, pickOne, pickWeighted } from './rng'
import type { ClubOffer, GameState, Player, Team } from './types'

function targetReputation(player: Player, state: GameState): number {
  const cap = offerReputationCap(state)
  const stage = state.careerStage
  let target = 1
  if (player.overall < 55) target = 1
  else if (player.overall >= 88) target = 5
  else if (player.overall >= 82) target = 4
  else if (player.overall >= 74) target = 3
  else if (player.overall >= 65) target = 2
  else target = 1

  // La etapa de carrera topea el techo de destino
  if (stage === 'local') target = Math.min(target, 2)
  else if (stage === 'regional') target = Math.min(target, 3)
  else if (stage === 'continental') target = Math.min(target, 4)

  if (player.age < 20) target = Math.min(target, 3)
  if (player.age < 18) target = Math.min(target, 2)
  if (player.overall < 55) target = 1

  // Escaparate abre un techo extra
  const current = state.currentTeamId ? getTeam(state.currentTeamId) : undefined
  if (isShowcaseClub(current) && player.overall >= 74) {
    target = Math.min(cap, Math.max(target, Math.min(4, target + 1)))
  }

  return Math.min(cap, target)
}

/** Piso de OVR para fichar en un club (rep + división). */
function meetsOverallFloor(player: Player, team: Team): boolean {
  const destRep = team.international_reputation
  const tier = getCompetition(team.competition_id)?.tier ?? 1
  const ovr = player.overall

  if (destRep >= 5 && ovr < 84) return false
  if (destRep >= 4 && ovr < 78) return false
  if (destRep >= 3 && ovr < 68) return false
  if (destRep >= 2 && ovr < 55) return false
  // 1ª división: no con OVR de reserva de ascenso
  if (tier === 1 && ovr < 58) return false
  return true
}

function maxTierJump(player: Player, state: GameState): number {
  const current = state.currentTeamId ? getTeam(state.currentTeamId) : undefined
  if (isShowcaseClub(current) && player.overall >= 76) {
    if (player.age <= 18) return 2
    return 3
  }
  if (player.age <= 18 || player.overall < 72) return 1
  if (player.age <= 21 || player.overall < 78) return 1
  if (player.overall < 82) return 2
  return 2
}

function eligibleDestination(
  team: Team,
  player: Player,
  currentRep: number,
  current: Team | undefined,
  state: GameState,
): boolean {
  const destRep = team.international_reputation
  const gap = destRep - currentRep
  const peak = peakClubReputation(state)
  const prestige = prestigePathScore(state)
  const stage = state.careerStage
  const showcase = isShowcaseClub(current)

  if (!meetsOverallFloor(player, team)) return false

  if (gap > maxTierJump(player, state)) return false

  // Veteranos en declive: no elite / top
  if (player.age >= 34 && player.overall < 72 && destRep >= 4) return false
  if (
    player.age >= 36 &&
    player.overall < 70 &&
    destRep >= 3 &&
    !(
      current &&
      team.country_fifa_code === current.country_fifa_code &&
      destRep <= currentRep
    )
  ) {
    return false
  }

  // Cambio de confederación en carrera tardía: exigir nivel alto
  if (
    current?.confederation &&
    team.confederation &&
    team.confederation !== current.confederation &&
    player.age >= 33 &&
    player.overall < 76
  ) {
    return false
  }

  // Elite (rep 5): necesita puente real
  if (destRep >= 5) {
    if (player.overall < 84 || player.age < 22) return false
    if (peak < 3 && !state.modifiers.includes('golden_boy')) return false
    if (peak < 4 && prestige < 78 && !showcase) return false
    if (stage === 'local' || stage === 'regional') {
      if (!(showcase && player.overall >= 82 && prestige >= 80)) return false
    }
    // Preferir misma confederación salvo escaparate fuerte
    if (
      current?.confederation &&
      team.confederation &&
      team.confederation !== current.confederation &&
      !showcase &&
      peak < 4
    ) {
      return false
    }
  }

  // Top (rep 4): club actual >= 3 o crack con puente
  if (destRep >= 4) {
    if (player.overall < 78 || player.age < 20) return false
    const bridge = currentRep >= 3 || peak >= 3 || (showcase && player.overall >= 76)
    const crackPath = player.overall >= 82 && prestige >= 72 && peak >= 2
    if (!bridge && !crackPath) return false
    if (currentRep <= 2 && !showcase && player.overall < 80) return false
  }

  // Clubes chicos (rep 1–2): no Europa top ni saltos lejanos
  if (currentRep <= 2) {
    if (destRep >= 4) return false
    if (destRep >= 3) {
      // Solo saltos regionales CONMEBOL / mismos confed medios
      if (team.confederation !== current?.confederation) return false
      if (player.overall < 74 || prestige < 55) return false
    }
    // Destinos lejanos (UEFA/AFC/MLS) desde chico: bloquear salvo OVR alto y misma edad adulta
    if (
      current &&
      team.confederation &&
      current.confederation &&
      team.confederation !== current.confederation
    ) {
      const softLanding =
        team.international_reputation <= 2 &&
        player.overall >= 72 &&
        player.age >= 21 &&
        (team.confederation === 'CONCACAF' ||
          team.confederation === 'AFC' ||
          team.country_fifa_code === 'USA' ||
          team.country_fifa_code === 'KSA' ||
          team.country_fifa_code === 'QAT')
      if (!softLanding) return false
    }
  }

  // Confed distinta + gap de reputación
  if (
    current &&
    team.confederation &&
    current.confederation &&
    team.confederation !== current.confederation &&
    (player.age <= 20 || player.overall < 76) &&
    gap >= 1
  ) {
    return false
  }

  // De CONMEBOL a UEFA: exigir escaparate o rep>=3
  if (
    current?.confederation === 'CONMEBOL' &&
    team.confederation === 'UEFA' &&
    destRep >= 3
  ) {
    if (!(showcase || currentRep >= 3) || player.overall < 75) return false
  }

  return true
}

function destinationWeight(
  t: Team,
  player: Player,
  current: Team | undefined,
  currentRep: number,
  state: GameState,
): number {
  let weight = 8
  const tierGap = t.international_reputation - currentRep
  const prestige = prestigePathScore(state)

  if (current && t.country_fifa_code === current.country_fifa_code) weight += 32
  if (current && t.confederation === current.confederation) weight += 14
  if (t.country_fifa_code === player.nationalityFifa) weight += 20

  if (tierGap === 1) weight += 14
  else if (tierGap === 0) weight += 12
  else if (tierGap === 2) weight += 3
  else if (tierGap >= 3) weight += 1
  else if (tierGap < 0) weight += 8

  if (current && t.confederation !== current.confederation) {
    weight = Math.max(1, weight - (player.overall < 82 ? 26 : 10))
  }
  if (player.overall < 68 && t.international_reputation >= 4) weight = Math.max(1, weight - 25)

  // Escaparate: boost a Europa/top
  if (isShowcaseClub(current) && t.international_reputation >= 3) {
    weight += 18
    if (t.confederation === 'UEFA') weight += 10
  }

  // Club chico: sesgar fuerte a local
  if (currentRep <= 2) {
    if (current && t.country_fifa_code === current.country_fifa_code) weight += 40
    if (t.international_reputation >= currentRep + 2) weight = Math.max(1, weight - 30)
  }

  if (state.traits?.includes('loyal') && current && t.country_fifa_code === current.country_fifa_code) {
    weight += 16
  }
  if (state.traits?.includes('ambitious') && t.international_reputation > currentRep) {
    weight += 10
  }
  if (prestige < 50 && t.international_reputation >= 4) weight = Math.max(1, weight - 20)

  return Math.max(1, weight)
}

export function generateAcademyOffers(state: GameState): { state: GameState; offers: ClubOffer[] } {
  if (!state.player) return { state, offers: [] }
  let s = state.rngState
  const pool = academyTeamsForCountry(state.player.nationalityFifa)
  const offers: ClubOffer[] = []
  const used = new Set<string>()

  for (let i = 0; i < 3; i += 1) {
    const available = pool.filter((t) => !used.has(t.id))
    if (available.length === 0) break
    const pick = pickOne(s, available)
    s = pick.state
    used.add(pick.item.id)
    const built = buildOffer({
      rngState: s,
      player: state.player,
      teamId: pick.item.id,
      kind: 'academy',
      preferredRole: i === 0 ? 'starter' : 'rotation',
      step: state.step + i,
    })
    s = built.state
    offers.push({
      ...built.offer,
      pathReason: 'local_scout',
    })
  }

  return { state: { ...state, rngState: s }, offers }
}

export function generateTransferOffers(state: GameState): { state: GameState; offers: ClubOffer[] } {
  if (!state.player || !state.currentTeamId) return { state, offers: [] }
  let s = state.rngState
  const synced = { ...state, careerStage: deriveCareerStage(state) }
  const target = targetReputation(synced.player!, synced)
  const current = getTeam(synced.currentTeamId!)
  const currentRep = current?.international_reputation ?? 1
  const player = synced.player!

  let pool = [
    ...teamsAtReputation(target),
    ...teamsAtReputation(Math.max(1, target - 1)),
    ...teamsAtReputation(Math.min(5, target + 1)),
  ].filter((t) => t.id !== synced.currentTeamId && eligibleDestination(t, player, currentRep, current, synced))

  if (pool.length === 0) {
    pool = teamsUpToReputation(target).filter(
      (t) => t.id !== synced.currentTeamId && eligibleDestination(t, player, currentRep, current, synced),
    )
  }
  if (pool.length === 0) {
    pool = teamsUpToReputation(Math.max(1, currentRep + 1)).filter(
      (t) => t.id !== synced.currentTeamId && eligibleDestination(t, player, currentRep, current, synced),
    )
  }

  const weighted = pool.map((t) => ({
    item: t,
    weight: destinationWeight(t, player, current, currentRep, synced),
  }))

  const offers: ClubOffer[] = []
  const used = new Set<string>()
  const countRoll = nextRng(s)
  s = countRoll.state
  const count = 3 + Math.floor(countRoll.value * 3)

  for (let i = 0; i < count; i += 1) {
    const filtered = weighted.filter((w) => !used.has(w.item.id))
    if (filtered.length === 0) break
    const pick = pickWeighted(s, filtered)
    s = pick.state
    if (!pick.item) break
    used.add(pick.item.id)
    const built = buildOffer({
      rngState: s,
      player,
      teamId: pick.item.id,
      kind: 'transfer',
      step: synced.step + i,
    })
    s = built.state
    offers.push({
      ...built.offer,
      pathReason: pathReasonFor(pick.item, current, 'transfer', synced.formativeTeamId),
    })
  }

  // Renovación implícita del club actual a veces
  if (synced.contract && synced.contract.yearsRemaining <= 0 && current) {
    const renewRoll = nextRng(s)
    s = renewRoll.state
    if (renewRoll.value < ((synced.traits ?? []).includes('loyal') ? 0.55 : 0.35)) {
      const built = buildOffer({
        rngState: s,
        player,
        teamId: current.id,
        kind: 'renewal',
        preferredRole: synced.contract.role,
        step: synced.step + 50,
      })
      s = built.state
      offers.unshift({
        ...built.offer,
        pathReason: undefined,
      })
    }
  }

  // Vuelta triunfal al club formador (últimos años)
  const formativeId = synced.formativeTeamId
  const formativeTeam = formativeId ? getTeam(formativeId) : undefined
  const formativeRep = formativeTeam?.international_reputation ?? 1
  const formativeOvrFloor = Math.max(55, 52 + formativeRep * 4)
  if (
    formativeId &&
    formativeId !== synced.currentTeamId &&
    !used.has(formativeId) &&
    player.age >= 32 &&
    player.overall >= formativeOvrFloor &&
    formativeTeam
  ) {
    const homeRoll = nextRng(s)
    s = homeRoll.state
    if (homeRoll.value < (player.age >= 35 ? 0.42 : 0.28)) {
      const built = buildOffer({
        rngState: s,
        player,
        teamId: formativeId,
        kind: 'transfer',
        preferredRole: player.overall >= 72 ? 'starter' : 'rotation',
        step: synced.step + 80,
      })
      s = built.state
      used.add(formativeId)
      offers.unshift({
        ...built.offer,
        pathReason: 'home_return',
      })
    }
  }

  // Préstamo: contrato vigente + joven o debajo del nivel esperado
  const loanRoll = nextRng(s)
  s = loanRoll.state
  const expected = 52 + currentRep * 7
  const underLevel = player.overall <= expected - 6
  const lastSeason = synced.seasons[synced.seasons.length - 1]
  const badForm = lastSeason?.role === 'bench' || (lastSeason && lastSeason.stats.appearances < 12)
  const contractActive = Boolean(synced.contract && synced.contract.yearsRemaining >= 1)
  const canLoan =
    contractActive &&
    !synced.activeLoanReturnTeamId &&
    currentRep >= 2 &&
    ((player.age <= 21 && currentRep >= 3) || underLevel || badForm) &&
    loanRoll.value < (player.age <= 21 ? 0.38 : 0.22)

  if (canLoan) {
    const lower = teamsUpToReputation(Math.max(1, currentRep - 1)).filter(
      (t) =>
        t.id !== synced.currentTeamId &&
        !used.has(t.id) &&
        t.international_reputation < currentRep &&
        (!current || t.confederation === current.confederation || t.country_fifa_code === current.country_fifa_code),
    )
    if (lower.length) {
      const loanPick = pickOne(s, lower)
      s = loanPick.state
      const built = buildOffer({
        rngState: s,
        player,
        teamId: loanPick.item.id,
        kind: 'loan',
        preferredRole: 'starter',
        step: synced.step + 99,
      })
      s = built.state
      offers.push({
        ...built.offer,
        years: 1,
        yearsRemaining: 1,
        pathReason: 'loan_development',
      })
    }
  }

  return { state: { ...synced, rngState: s }, offers }
}

export function generateEliteOffer(state: GameState): { state: GameState; offer: ClubOffer | null } {
  if (!state.player) return { state, offer: null }
  const synced = { ...state, careerStage: deriveCareerStage(state) }
  const player = synced.player!
  const peak = peakClubReputation(synced)
  const prestige = prestigePathScore(synced)
  const current = synced.currentTeamId ? getTeam(synced.currentTeamId) : undefined

  if (player.overall < 84 || player.age < 22) return { state: synced, offer: null }
  if (peak < 3 && !synced.modifiers.includes('golden_boy')) return { state: synced, offer: null }
  if (peak < 4 && prestige < 78 && !isShowcaseClub(current)) return { state: synced, offer: null }

  let s = synced.rngState
  let elites = teamsAtReputation(5).filter((t) => t.id !== synced.currentTeamId)
  // Preferir misma confederación si el puente aún es regional
  if (peak < 4 && current?.confederation) {
    const same = elites.filter((t) => t.confederation === current.confederation)
    if (same.length) elites = same
  }
  if (elites.length === 0) return { state: synced, offer: null }
  const pick = pickOne(s, elites)
  s = pick.state
  const built = buildOffer({
    rngState: s,
    player: { ...player, overall: Math.max(player.overall, 84) },
    teamId: pick.item.id,
    kind: 'transfer',
    preferredRole: 'undisputed',
    step: synced.step,
  })
  return {
    state: { ...synced, rngState: built.state },
    offer: {
      ...built.offer,
      pathReason: pathReasonFor(pick.item, current, 'transfer', synced.formativeTeamId),
    },
  }
}

/** Préstamos juveniles: solo clubes del mismo nivel o inferior (nunca subir a 1ª desde 2ª). */
export function generateYouthLoanOffers(state: GameState): { state: GameState; offers: ClubOffer[] } {
  if (!state.player || !state.currentTeamId) return { state, offers: [] }
  const parentId = state.activeLoanReturnTeamId ?? state.currentTeamId
  const parent = getTeam(parentId)
  if (!parent) return { state, offers: [] }

  const parentRep = parent.international_reputation
  const parentComp = getCompetition(parent.competition_id)
  const parentTier = parentComp?.tier ?? 1
  let s = state.rngState
  const player = state.player

  let pool = teams.filter((t) => {
    if (t.id === parentId || t.id === state.currentTeamId) return false

    const destTier = getCompetition(t.competition_id)?.tier ?? 1
    // Nunca subir de división (tier más bajo = liga más alta)
    if (destTier < parentTier) return false

    const lowerDivision =
      t.country_fifa_code === parent.country_fifa_code && destTier > parentTier
    if (lowerDivision) return true

    // Misma división (o peor): solo si el club es claramente más chico
    if (destTier === parentTier) {
      if (t.country_fifa_code !== parent.country_fifa_code) return false
      return t.international_reputation < parentRep
    }

    // Tier peor en misma confederación / país
    if (destTier > parentTier) {
      return (
        t.country_fifa_code === parent.country_fifa_code ||
        (t.confederation === parent.confederation && t.international_reputation <= 2)
      )
    }
    return false
  })

  // Si el padre es de 1ª y no hay 2ª en el pool, forzar clubes de tier+1 del país
  const hasLowerDiv = pool.some(
    (t) =>
      t.country_fifa_code === parent.country_fifa_code &&
      (getCompetition(t.competition_id)?.tier ?? 1) > parentTier,
  )
  if (!hasLowerDiv && parentTier === 1) {
    const secondOnly = teams.filter(
      (t) =>
        t.id !== parentId &&
        t.country_fifa_code === parent.country_fifa_code &&
        (getCompetition(t.competition_id)?.tier ?? 1) >= parentTier + 1,
    )
    if (secondOnly.length) pool = secondOnly
  }

  // Padre ya en 2ª+: fallback solo mismo tier o inferior, mismo país
  if (pool.length === 0) {
    pool = teams.filter(
      (t) =>
        t.id !== parentId &&
        t.country_fifa_code === parent.country_fifa_code &&
        (getCompetition(t.competition_id)?.tier ?? 1) >= parentTier &&
        t.international_reputation <= parentRep,
    )
  }

  if (pool.length === 0) {
    pool = teams
      .filter(
        (t) =>
          t.id !== parentId &&
          t.confederation === parent.confederation &&
          (getCompetition(t.competition_id)?.tier ?? 1) >= Math.max(2, parentTier) &&
          t.international_reputation <= Math.max(1, parentRep),
      )
      .slice(0, 40)
  }

  const weighted = pool.map((t) => {
    let weight = 6
    const destTier = getCompetition(t.competition_id)?.tier ?? 1
    const isLowerDiv =
      t.country_fifa_code === parent.country_fifa_code && destTier > parentTier
    if (t.country_fifa_code === parent.country_fifa_code) weight += 24
    if (t.competition_id === parent.competition_id) weight += 8
    if (t.international_reputation < parentRep) weight += 12
    if (t.confederation === parent.confederation) weight += 8
    if (isLowerDiv) weight += 40
    // Si el padre ya está en 2ª, priorizar otros de 2ª/3ª, no “grandes”
    if (parentTier >= 2 && destTier >= parentTier) weight += 20
    return { item: t, weight: Math.max(1, weight) }
  })

  const offers: ClubOffer[] = []
  const used = new Set<string>()
  const count = Math.min(4, Math.max(2, weighted.length))

  for (let i = 0; i < count; i += 1) {
    const filtered = weighted.filter((w) => !used.has(w.item.id))
    if (!filtered.length) break
    const pick = pickWeighted(s, filtered)
    s = pick.state
    if (!pick.item) break
    used.add(pick.item.id)
    const destTier = getCompetition(pick.item.competition_id)?.tier ?? 1
    const clearlyLower =
      destTier > parentTier || pick.item.international_reputation <= parentRep - 1
    const built = buildOffer({
      rngState: s,
      player,
      teamId: pick.item.id,
      kind: 'loan',
      preferredRole: clearlyLower ? 'starter' : 'rotation',
      step: state.step + i,
    })
    s = built.state
    offers.push({
      ...built.offer,
      years: 1,
      yearsRemaining: 1,
      pathReason: 'loan_development',
    })
  }

  return { state: { ...state, rngState: s }, offers }
}

export function shouldOfferYouthLoan(state: GameState): boolean {
  if (state.youthLoanOffered) return false
  if (!state.player || !state.currentTeamId || !state.contract) return false
  if (state.seasons.length > 0) return false
  if (state.player.age > 18) return false
  return true
}

/** Tras escándalo / carrera ruinosa: fichajes en ligas menores para relanzarse. */
export function generateRecoveryOffers(state: GameState): { state: GameState; offers: ClubOffer[] } {
  if (!state.player) return { state, offers: [] }
  let s = state.rngState
  const player = state.player
  const current = state.currentTeamId ? getTeam(state.currentTeamId) : undefined
  const homeCountry = current?.country_fifa_code ?? player.nationalityFifa
  const homeConfed = current?.confederation

  const isMinorClub = (t: Team) => {
    if (t.international_reputation <= 2) return true
    const comp = getCompetition(t.competition_id)
    return (comp?.tier ?? 1) >= 2
  }

  let pool = teams.filter(
    (t) =>
      t.id !== state.currentTeamId &&
      isMinorClub(t) &&
      meetsOverallFloor(player, t) &&
      (t.country_fifa_code === homeCountry ||
        (homeConfed && t.confederation === homeConfed) ||
        t.country_fifa_code === player.nationalityFifa),
  )

  if (pool.length < 2) {
    pool = teams.filter(
      (t) => t.id !== state.currentTeamId && isMinorClub(t) && meetsOverallFloor(player, t),
    )
  }

  const weighted = pool.map((t) => {
    let weight = 3
    if (t.country_fifa_code === homeCountry) weight += 4
    if (t.country_fifa_code === player.nationalityFifa) weight += 3
    if (homeConfed && t.confederation === homeConfed) weight += 2
    if (t.international_reputation <= 1) weight += 1
    return { item: t, weight }
  })

  const offers: ClubOffer[] = []
  const used = new Set<string>()
  const targetCount = Math.max(2, Math.min(4, weighted.length))

  for (let i = 0; i < targetCount; i += 1) {
    const filtered = weighted.filter((w) => !used.has(w.item.id))
    if (filtered.length === 0) break
    const pick = pickWeighted(s, filtered)
    s = pick.state
    if (!pick.item) break
    used.add(pick.item.id)
    const built = buildOffer({
      rngState: s,
      player,
      teamId: pick.item.id,
      kind: 'transfer',
      preferredRole: player.overall >= 65 ? 'starter' : 'rotation',
      step: state.step + 80 + i,
    })
    s = built.state
    offers.push({
      ...built.offer,
      pathReason: 'recovery',
    })
  }

  return { state: { ...state, rngState: s }, offers }
}

/** Tras cesión: ¿vale la pena seguir prestado? */
export function loanPerformanceAllowsContinue(state: GameState): boolean {
  const last = state.seasons[state.seasons.length - 1]
  if (!last?.loan) return false
  const apps = last.stats.appearances
  const contrib = last.stats.goals + last.stats.assists
  const goodRole = last.role === 'starter' || last.role === 'undisputed'
  return apps >= 18 || (goodRole && apps >= 12) || contrib >= 6
}
