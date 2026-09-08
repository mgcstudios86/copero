import type { SeasonObjectiveKind } from '../engine/types'

const KIND_IMAGE: Record<SeasonObjectiveKind, string> = {
  starter_minutes: 'training_extra-accept',
  goal_contrib: 'position_competition-compete',
  avoid_relegation: 'tax_trouble-stay_and_fight',
  win_trophy: 'position_competition-compete',
  national_callup: 'unexpected_prospect-mentor',
}

export function objectiveBriefingImage(kind: SeasonObjectiveKind): string {
  const key = KIND_IMAGE[kind] ?? 'training_extra-accept'
  return `/career-simulator/career-events/${key}.jpg`
}
