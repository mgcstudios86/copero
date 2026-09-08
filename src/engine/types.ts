export type Phase =
  | 'intro'
  | 'identity'
  | 'draft'
  | 'draft_result'
  | 'origin'
  | 'career'
  | 'summary'
export type GameMode = 'long' | 'normal' | 'express'
export type DraftMode = 'classic' | 'purist'
export type PlayingRole = 'bench' | 'rotation' | 'starter' | 'undisputed'
export type Position = 'GK' | 'CB' | 'LB' | 'RB' | 'CDM' | 'CM' | 'CAM' | 'LM' | 'RM' | 'LW' | 'RW' | 'ST'
export type PreferredFoot = 'left' | 'right'

export type MessageParams = Record<string, string | number>
export type MessageDescriptor = {
  key: string
  params?: MessageParams
}
export type DisplayText = string | MessageDescriptor

export type AttributeKey =
  | 'pace'
  | 'shooting'
  | 'passing'
  | 'dribbling'
  | 'defending'
  | 'physical'
  | 'skillMoves'
  | 'weakFoot'

export type PlayerAttributes = Record<AttributeKey, number>

export type DraftPick = {
  round: number
  legendId: string
  legendName: string
  attribute: AttributeKey
  value: number
}

export type DraftState = {
  round: number
  currentLegendId: string | null
  usedLegendIds: string[]
  picks: DraftPick[]
  skipsRemaining: number
  completed: boolean
}

export type CareerStage = 'local' | 'regional' | 'continental' | 'elite'

export type TraitId = 'ambitious' | 'loyal' | 'party_risk' | 'professional' | 'media_magnet'

export type OfferPathReason =
  | 'local_scout'
  | 'regional_step'
  | 'continental_leap'
  | 'elite_pull'
  | 'loan_development'
  | 'home_return'
  | 'showcase_exit'
  | 'recovery'

export type SeasonObjectiveKind =
  | 'starter_minutes'
  | 'goal_contrib'
  | 'avoid_relegation'
  | 'win_trophy'
  | 'national_callup'

export type SeasonObjective = {
  kind: SeasonObjectiveKind
  /** New saves use a descriptor/key; old saves may still contain Spanish text. */
  label: DisplayText
  target: number
  progress: number
  completed?: boolean
  failed?: boolean
  /** Ya se mostró el card de briefing para este objetivo */
  briefed?: boolean
}

export type ModifierId =
  | 'injury_immunity'
  | 'iron_longevity'
  | 'glass_body'
  | 'golden_boy'
  | 'career_ruined'
  | 'banned'
  | 'form_boost'
  | 'form_dip'
  | 'homesick'

export type Country = {
  name_en: string
  name_es: string
  name_pt?: string
  iso_alpha2: string
  fifa_code: string
  slug: string
  flag_url: string
  logo_url?: string | null
  confederation: string
  continental_reputation?: number
  fifa_reputation?: number
  international_reputation?: number
  primary_color?: string
  kit_primary_color?: string
  kit_secondary_color?: string
  kit_tertiary_color?: string
}

export type Competition = {
  id: string
  name: string
  country_fifa_code: string
  logo_url?: string
  confederation?: string
  tier?: number
  domestic_cup_id?: string
}

export type Team = {
  id: string
  name: string
  logo_url?: string
  international_reputation: number
  primary_color?: string
  competition_id: string
  country_fifa_code: string
  confederation?: string
}

export type SeasonStats = {
  appearances: number
  goals: number
  assists: number
  cleanSheets: number
  goalsConceded: number
}

export type ContractTerms = {
  teamId: string
  annualWage: number
  years: number
  yearsRemaining: number
  releaseClause: number
  signingBonus: number
  role: PlayingRole
  transferFee?: number
}

export type ClubOffer = ContractTerms & {
  id: string
  negotiationRound: number
  kind: 'academy' | 'transfer' | 'renewal' | 'loan'
  pathReason?: OfferPathReason
}

export type Player = {
  lastName: string
  preferredNumber: number
  preferredFoot: PreferredFoot
  position: Position
  nationalityFifa: string
  /** Nacionalidad de un familiar directo (padre/madre); habilita otra selección */
  heritageNationalityFifa: string | null
  age: number
  overall: number
  potential: number
  peakOverall: number
  attributes: PlayerAttributes
  draftPicks: DraftPick[]
  marketValue: number
  wealth: number
}

export type SeasonRecord = {
  index: number
  age: number
  teamId: string
  overall: number
  marketValue: number
  wage: number
  role: PlayingRole
  stats: SeasonStats
  trophies: import('../data/trophies').TrophyWin[]
  awards: string[]
  suspended: boolean
  injured: boolean
  loan?: boolean
  /** Club dueño cuando `loan` es true */
  loanParentTeamId?: string
  /** Clubes: pelea de descenso, descenso o ascenso de categoría */
  struggle?: 'relegation_battle' | 'relegated' | 'promoted'
  /** Liga en la que se jugó esa temporada (snapshot) */
  competitionId?: string
  objectiveResult?: { label: DisplayText; completed: boolean; failed?: boolean }
}

export type PendingNationalCallup = {
  age: number
  projected: SeasonStats
  countryFifa: string
  viaHeritage?: boolean
}

export type CareerEventChoice = {
  id: string
  labelKey: string
}

export type CareerEventDef = {
  id: string
  impact: 'normal' | 'boost' | 'ruin' | 'fortune'
  titleKey: string
  bodyKey: string
  minAge?: number
  maxAge?: number
  weight: number
  requiresClub?: boolean
  choices: CareerEventChoice[]
  /** Copero-style visual outcomes shown on choice cards */
  visual?: boolean
  /** Filtros regionales / de contexto */
  countries?: string[]
  confederations?: string[]
  clubCountries?: string[]
  minClubRep?: number
  maxClubRep?: number
  requiresTraits?: TraitId[]
  blocksTraits?: TraitId[]
  regional?: boolean
}

export type ActiveEvent =
  | {
      type: 'career_choice'
      eventId: string
      title: DisplayText
      body: DisplayText
      impact: CareerEventDef['impact']
      choices: { id: string; label: DisplayText }[]
      regionalBadge?: string
    }
  | {
      type: 'offer'
      title: DisplayText
      body: DisplayText
      offers: ClubOffer[]
      canReject: boolean
      canNegotiate: boolean
    }
  | {
      type: 'negotiation'
      title: DisplayText
      body: DisplayText
      offer: ClubOffer
    }
  | {
      type: 'season_result'
      title: DisplayText
      body: DisplayText
      season: SeasonRecord
    }
  | {
      type: 'national_callup'
      title: DisplayText
      body: DisplayText
      projected: SeasonStats
      countryFifa: string
      viaHeritage?: boolean
    }
  | {
      type: 'retire'
      title: DisplayText
      body: DisplayText
      reason: 'age' | 'no_offers' | 'medical' | 'ruined'
    }
  | {
      type: 'trait_pick'
      title: DisplayText
      body: DisplayText
      options: { id: TraitId; label: DisplayText; desc: DisplayText }[]
    }
  | {
      type: 'youth_loan_choice'
      title: DisplayText
      body: DisplayText
    }
  | {
      type: 'objective_briefing'
      title: DisplayText
      body: DisplayText
      label: DisplayText
      kind?: SeasonObjectiveKind
      imageSrc?: string
    }

export type GameState = {
  phase: Phase
  mode: GameMode
  draftMode: DraftMode
  draft: DraftState
  seed: string
  rngState: number
  step: number
  player: Player | null
  contract: ContractTerms | null
  currentTeamId: string | null
  modifiers: ModifierId[]
  traits: TraitId[]
  careerStage: CareerStage
  seasonObjective: SeasonObjective | null
  objectiveHistory: { label: DisplayText; completed: boolean }[]
  milestones: string[]
  banSeasonsRemaining: number
  undisputedSeasonsRemaining: number
  seasons: SeasonRecord[]
  nationalTeamPeriods: { age: number; stats: SeasonStats }[]
  nationalTotals: SeasonStats
  totals: SeasonStats
  wealthEarned: number
  log: DisplayText[]
  currentEvent: ActiveEvent | null
  pendingOffers: ClubOffer[]
  celebration: {
    kind: 'boost' | 'ruin' | 'trophy' | 'fortune'
    message: DisplayText
    trophies?: import('../data/trophies').TrophyWin[]
  } | null
  activeLoanReturnTeamId: string | null
  /** Trofeos ganados con la selección (Copa América / Euro / Mundial…) */
  nationalTrophies: import('../data/trophies').TrophyWin[]
  /** Una sola vez por carrera: reroll de ofertas vía representante */
  agentRerollUsed: boolean
  /** Convocatoria pendiente de aceptar/rechazar */
  pendingNationalCallup: PendingNationalCallup | null
  /** Ya eligió rasgos al inicio */
  traitsChosen: boolean
  /** Ya se ofreció la card de préstamo juvenil inicial */
  youthLoanOffered: boolean
  /** Club de origen / formador (primera firma) */
  formativeTeamId: string | null
  /** Índice de temporada cuando se aplicó career_ruined (para retiro diferido) */
  ruinedAtSeasonIndex: number | null
  /** teamId → competitionId tras ascenso/descenso en esta carrera */
  teamCompetitionOverrides: Record<string, string>
}

export type ModeConfig = {
  periodLengthSeasons: number
  personalEventChance: number
}

export const MODE_CONFIG: Record<GameMode, ModeConfig> = {
  long: { periodLengthSeasons: 1, personalEventChance: 0.85 },
  normal: { periodLengthSeasons: 2, personalEventChance: 0.7 },
  express: { periodLengthSeasons: 3, personalEventChance: 0.55 },
}

export const BASE_RETIREMENT_AGE = 40
export const LONGEVITY_RETIREMENT_AGE = 45
export const START_AGE = 16
