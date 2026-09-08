export type EventOutcomePill = {
  tone: 'positive' | 'negative' | 'neutral'
  /** Translation key for copy, or a language-neutral numeric label such as +2 OVR. */
  label: string
  chance?: number
}

export type EventChoiceVisual = {
  imageKey: string
  imageSrc: string
  outcomes: EventOutcomePill[]
}

const IMAGE_KEY: Record<string, Record<string, string>> = {
  training_extra: { accept: 'training_extra-accept', reject: 'training_extra-reject' },
  rival_offer: { listen: 'rival_offer-accept', reject: 'rival_offer-reject' },
  club_crisis: { stay_and_fight: 'tax_trouble-stay_and_fight', request_exit: 'rival_offer-accept' },
  mysterious_substance: { consume: 'mysterious_substance-consume', reject: 'mysterious_substance-reject' },
  scout_discovery: { embrace: 'unexpected_prospect-mentor' },
  final_hattrick: { celebrate: 'position_competition-compete' },
  iron_genetics: { accept: 'honesty_test-accept', ignore: 'honesty_test-reject' },
  miracle_doctor: { accept: 'injury_at_peak-recover', reject: 'injury_at_peak-play_injured' },
  media_scandal: { deny: 'controversial_post-support_club', apologize: 'controversial_statement-apologize' },
  career_ending_injury: { fight: 'injury-continue', retire_medical: 'injury_at_peak-recover' },
  agent_scam: { sue: 'indecent_proposal-reject', accept_loss: 'indecent_proposal-proceed' },
  doping_temptation: { consume: 'mysterious_substance-consume', reject: 'mysterious_substance-reject' },
  personal_coach: { accept: 'personal_coach-nutrition_plan-accept', reject: 'personal_coach-nutrition_plan-reject' },
  position_change: { accept: 'position_change-accept', reject: 'position_change-reject' },
  ar_media_pressure: { face_cameras: 'controversial_statement-apologize', silence: 'controversial_post-support_club' },
  mx_food_poisoning: { rest: 'injury_at_peak-recover', play_through: 'injury_at_peak-play_injured' },
  mx_clasico_pressure: { embrace: 'position_competition-compete', hide: 'season_load-stay_calm' },
  ar_clasico_week: { ready: 'position_competition-compete', nervous: 'season_load-stay_calm' },
  ar_ascenso_opportunity: { seize: 'unexpected_prospect-mentor', pass: 'rival_offer-reject' },
  br_calendar_fatigue: { rotate: 'season_load-accept', push: 'injury-continue' },
  br_rival_serie_a: { listen: 'rival_offer-accept', reject: 'rival_offer-reject' },
  br_carnival_break: { rest: 'injury_at_peak-recover', party: 'giant_tattoo-accept' },
  eu_travel_fatigue: { recover: 'season_load-stay_calm', play: 'season_load-accept' },
  eu_adaptation: { integrate: 'finish_high_school-accept', isolate: 'finish_high_school-reject' },
  mena_exit_clause: { accept_money: 'indecent_proposal-proceed', keep_clause: 'indecent_proposal-reject' },
  mls_adaptation: { buy_in: 'personal_coach-accept', tourist: 'personal_coach-reject' },
  concacaf_heat: { hydrate: 'injury_at_peak-recover', ignore: 'injury_at_peak-play_injured' },
}

const OUTCOMES: Record<string, Record<string, EventOutcomePill[]>> = {
  training_extra: {
    accept: [
      { tone: 'positive', label: '+2 OVR', chance: 70 },
      { tone: 'negative', label: '-1 OVR', chance: 30 },
    ],
    reject: [{ tone: 'neutral', label: 'outcome.noChange' }],
  },
  rival_offer: {
    listen: [{ tone: 'positive', label: 'outcome.viewOffers' }],
    reject: [{ tone: 'neutral', label: 'outcome.stay' }],
  },
  club_crisis: {
    stay_and_fight: [{ tone: 'positive', label: 'outcome.starterPlusOne' }],
    request_exit: [{ tone: 'neutral', label: 'outcome.viewOffers' }],
  },
  mysterious_substance: {
    consume: [
      { tone: 'positive', label: '+2 OVR', chance: 45 },
      { tone: 'negative', label: 'outcome.suspension', chance: 55 },
    ],
    reject: [{ tone: 'positive', label: '+1 OVR' }],
  },
  scout_discovery: {
    embrace: [{ tone: 'positive', label: 'outcome.plusFourTopClub' }],
  },
  final_hattrick: {
    celebrate: [{ tone: 'positive', label: 'outcome.undisputed' }],
  },
  iron_genetics: {
    accept: [{ tone: 'positive', label: 'outcome.injuryImmunity' }],
    ignore: [{ tone: 'neutral', label: 'outcome.noChange' }],
  },
  miracle_doctor: {
    accept: [{ tone: 'positive', label: 'outcome.career45' }],
    reject: [{ tone: 'neutral', label: 'outcome.noChange' }],
  },
  media_scandal: {
    deny: [{ tone: 'negative', label: 'outcome.minusFifteenRuin' }],
    apologize: [
      { tone: 'neutral', label: '-6 OVR' },
      { tone: 'neutral', label: 'outcome.benchSeason' },
    ],
  },
  career_ending_injury: {
    fight: [{ tone: 'negative', label: '-20 OVR' }],
    retire_medical: [{ tone: 'negative', label: 'outcome.medicalRetirement' }],
  },
  agent_scam: {
    sue: [{ tone: 'negative', label: 'outcome.minusTwentyFiveFortune' }],
    accept_loss: [{ tone: 'negative', label: 'outcome.minusFiftyFortune' }],
  },
  doping_temptation: {
    consume: [
      { tone: 'positive', label: 'outcome.plusThreeRisky', chance: 25 },
      { tone: 'negative', label: 'outcome.suspensionRuin', chance: 75 },
    ],
    reject: [{ tone: 'positive', label: 'outcome.plusOneClean' }],
  },
  personal_coach: {
    accept: [
      { tone: 'positive', label: '+3 OVR', chance: 60 },
      { tone: 'negative', label: '-2 OVR', chance: 40 },
    ],
    reject: [{ tone: 'neutral', label: 'outcome.noChange' }],
  },
  position_change: {
    accept: [
      { tone: 'positive', label: 'outcome.nextStarter' },
      { tone: 'negative', label: 'outcome.minusTwoTemporary' },
    ],
    reject: [{ tone: 'negative', label: 'outcome.fewerMinutes' }],
  },
  ar_media_pressure: {
    face_cameras: [
      { tone: 'positive', label: '+1 OVR' },
      { tone: 'positive', label: '+$80k' },
    ],
    silence: [
      { tone: 'negative', label: '-1 OVR' },
      { tone: 'negative', label: 'outcome.badForm' },
    ],
  },
  mx_food_poisoning: {
    rest: [{ tone: 'neutral', label: 'outcome.recover' }],
    play_through: [{ tone: 'negative', label: 'outcome.injuryRisk' }],
  },
  mx_clasico_pressure: {
    embrace: [{ tone: 'positive', label: 'outcome.performance' }],
    hide: [{ tone: 'negative', label: 'outcome.criticism' }],
  },
  ar_clasico_week: {
    ready: [
      { tone: 'positive', label: '+2 OVR' },
      { tone: 'positive', label: 'outcome.starter' },
    ],
    nervous: [{ tone: 'negative', label: '-1 OVR' }],
  },
  ar_ascenso_opportunity: {
    seize: [
      { tone: 'positive', label: '+3 OVR' },
      { tone: 'positive', label: 'outcome.promotion' },
    ],
    pass: [{ tone: 'neutral', label: 'outcome.noChange' }],
  },
  br_calendar_fatigue: {
    rotate: [{ tone: 'positive', label: '+1 OVR' }],
    push: [
      { tone: 'negative', label: '-2 OVR' },
      { tone: 'negative', label: 'outcome.fragile' },
    ],
  },
  br_rival_serie_a: {
    listen: [{ tone: 'positive', label: 'outcome.viewOffers' }],
    reject: [{ tone: 'neutral', label: 'outcome.stay' }],
  },
  br_carnival_break: {
    rest: [{ tone: 'positive', label: '+1 OVR' }],
    party: [
      { tone: 'positive', label: 'outcome.luck', chance: 40 },
      { tone: 'negative', label: 'outcome.hangover', chance: 60 },
    ],
  },
  eu_travel_fatigue: {
    recover: [{ tone: 'positive', label: 'outcome.fresh' }],
    play: [{ tone: 'negative', label: 'outcome.fatigue' }],
  },
  eu_adaptation: {
    integrate: [{ tone: 'positive', label: 'outcome.adaptation' }],
    isolate: [{ tone: 'negative', label: 'outcome.isolation' }],
  },
  mena_exit_clause: {
    accept_money: [{ tone: 'positive', label: 'outcome.bonus' }],
    keep_clause: [{ tone: 'neutral', label: 'outcome.clauseIntact' }],
  },
  mls_adaptation: {
    buy_in: [{ tone: 'positive', label: 'outcome.project' }],
    tourist: [{ tone: 'neutral', label: 'outcome.pass' }],
  },
  concacaf_heat: {
    hydrate: [{ tone: 'positive', label: 'outcome.ready' }],
    ignore: [{ tone: 'negative', label: 'outcome.cramps' }],
  },
}

export function eventChoiceVisual(eventId: string, choiceId: string): EventChoiceVisual | null {
  const key = IMAGE_KEY[eventId]?.[choiceId]
  if (!key) return null
  return {
    imageKey: key,
    imageSrc: `/career-simulator/career-events/${key}.jpg`,
    outcomes: OUTCOMES[eventId]?.[choiceId] ?? [{ tone: 'neutral', label: 'actions.continue' }],
  }
}

export const RETIREMENT_IMAGE = '/career-simulator/career-events/retirement.jpg'
