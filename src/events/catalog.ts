import { filterCareerEventsByCooldown } from '../engine/eventCooldown'
import type { CareerEventDef } from '../engine/types'
import { REGIONAL_EVENTS } from './regionalCatalog'

export const CAREER_EVENTS: CareerEventDef[] = [
  {
    id: 'personal_coach',
    impact: 'normal',
    titleKey: 'events.personal_coach.title',
    bodyKey: 'events.personal_coach.body',
    weight: 12,
    requiresClub: true,
    visual: true,
    choices: [
      { id: 'accept', labelKey: 'events.personal_coach.accept' },
      { id: 'reject', labelKey: 'events.personal_coach.reject' },
    ],
  },
  {
    id: 'position_change',
    impact: 'normal',
    titleKey: 'events.position_change.title',
    bodyKey: 'events.position_change.body',
    weight: 11,
    minAge: 18,
    requiresClub: true,
    visual: true,
    choices: [
      { id: 'accept', labelKey: 'events.position_change.accept' },
      { id: 'reject', labelKey: 'events.position_change.reject' },
    ],
  },
  {
    id: 'training_extra',
    impact: 'normal',
    titleKey: 'events.training_extra.title',
    bodyKey: 'events.training_extra.body',
    weight: 18,
    requiresClub: true,
    choices: [
      { id: 'accept', labelKey: 'events.training_extra.accept' },
      { id: 'reject', labelKey: 'events.training_extra.reject' },
    ],
  },
  {
    id: 'rival_offer',
    impact: 'normal',
    titleKey: 'events.rival_offer.title',
    bodyKey: 'events.rival_offer.body',
    weight: 14,
    minAge: 18,
    requiresClub: true,
    choices: [
      { id: 'listen', labelKey: 'events.rival_offer.listen' },
      { id: 'reject', labelKey: 'events.rival_offer.reject' },
    ],
  },
  {
    id: 'club_crisis',
    impact: 'normal',
    titleKey: 'events.club_crisis.title',
    bodyKey: 'events.club_crisis.body',
    weight: 10,
    requiresClub: true,
    choices: [
      { id: 'stay_and_fight', labelKey: 'events.club_crisis.stay' },
      { id: 'request_exit', labelKey: 'events.club_crisis.exit' },
    ],
  },
  {
    id: 'mysterious_substance',
    impact: 'normal',
    titleKey: 'events.mysterious_substance.title',
    bodyKey: 'events.mysterious_substance.body',
    weight: 8,
    minAge: 20,
    requiresClub: true,
    choices: [
      { id: 'consume', labelKey: 'events.mysterious_substance.consume' },
      { id: 'reject', labelKey: 'events.mysterious_substance.reject' },
    ],
  },
  {
    id: 'scout_discovery',
    impact: 'boost',
    titleKey: 'events.scout_discovery.title',
    bodyKey: 'events.scout_discovery.body',
    weight: 5,
    maxAge: 22,
    requiresClub: true,
    choices: [{ id: 'embrace', labelKey: 'events.scout_discovery.embrace' }],
  },
  {
    id: 'final_hattrick',
    impact: 'boost',
    titleKey: 'events.final_hattrick.title',
    bodyKey: 'events.final_hattrick.body',
    weight: 4,
    minAge: 19,
    requiresClub: true,
    choices: [{ id: 'celebrate', labelKey: 'events.final_hattrick.celebrate' }],
  },
  {
    id: 'iron_genetics',
    impact: 'fortune',
    titleKey: 'events.iron_genetics.title',
    bodyKey: 'events.iron_genetics.body',
    weight: 3,
    maxAge: 26,
    choices: [
      { id: 'accept', labelKey: 'events.iron_genetics.accept' },
      { id: 'ignore', labelKey: 'events.iron_genetics.ignore' },
    ],
  },
  {
    id: 'miracle_doctor',
    impact: 'fortune',
    titleKey: 'events.miracle_doctor.title',
    bodyKey: 'events.miracle_doctor.body',
    weight: 3,
    minAge: 28,
    choices: [
      { id: 'accept', labelKey: 'events.miracle_doctor.accept' },
      { id: 'reject', labelKey: 'events.miracle_doctor.reject' },
    ],
  },
  {
    id: 'media_scandal',
    impact: 'ruin',
    titleKey: 'events.media_scandal.title',
    bodyKey: 'events.media_scandal.body',
    weight: 4,
    minAge: 21,
    requiresClub: true,
    choices: [
      { id: 'deny', labelKey: 'events.media_scandal.deny' },
      { id: 'apologize', labelKey: 'events.media_scandal.apologize' },
    ],
  },
  {
    id: 'career_ending_injury',
    impact: 'ruin',
    titleKey: 'events.career_ending_injury.title',
    bodyKey: 'events.career_ending_injury.body',
    weight: 2,
    minAge: 24,
    requiresClub: true,
    choices: [
      { id: 'fight', labelKey: 'events.career_ending_injury.fight' },
      { id: 'retire_medical', labelKey: 'events.career_ending_injury.retire' },
    ],
  },
  {
    id: 'agent_scam',
    impact: 'ruin',
    titleKey: 'events.agent_scam.title',
    bodyKey: 'events.agent_scam.body',
    weight: 4,
    minAge: 20,
    requiresClub: true,
    choices: [
      { id: 'sue', labelKey: 'events.agent_scam.sue' },
      { id: 'accept_loss', labelKey: 'events.agent_scam.accept' },
    ],
  },
  {
    id: 'doping_temptation',
    impact: 'ruin',
    titleKey: 'events.doping_temptation.title',
    bodyKey: 'events.doping_temptation.body',
    weight: 3,
    minAge: 22,
    requiresClub: true,
    choices: [
      { id: 'consume', labelKey: 'events.doping_temptation.consume' },
      { id: 'reject', labelKey: 'events.doping_temptation.reject' },
    ],
  },
]

export function allCareerEvents(): CareerEventDef[] {
  return filterCareerEventsByCooldown([...CAREER_EVENTS, ...REGIONAL_EVENTS])
}

export function getEventDef(id: string): CareerEventDef | undefined {
  return CAREER_EVENTS.find((e) => e.id === id) ?? REGIONAL_EVENTS.find((e) => e.id === id)
}
