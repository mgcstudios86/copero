import type { Country, MessageDescriptor, SeasonObjective } from '../engine/types'
import { LOCALE_META, type Locale } from './config'

export type GameTranslate = (
  key: string,
  params?: Record<string, string | number>,
) => string

export function resolveGameText(
  t: GameTranslate,
  value: string | MessageDescriptor | null | undefined,
): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  return t(value.key, value.params)
}

export function objectiveLabel(t: GameTranslate, objective: SeasonObjective | null | undefined): string {
  if (!objective) return ''
  if (typeof objective.label === 'object') return resolveGameText(t, objective.label)
  if (typeof objective.label === 'string' && objective.label && !objective.label.startsWith('objective.')) {
    return objective.label
  }

  switch (objective.kind) {
    case 'starter_minutes':
      return t('objective.starterMinutes', { target: objective.target })
    case 'goal_contrib':
      return t('objective.goalContrib', { target: objective.target })
    case 'avoid_relegation':
      return t('objective.avoidRelegation')
    case 'win_trophy':
      return t('objective.winTrophy')
    case 'national_callup':
      return t('objective.nationalCallup')
  }
}

export function countryDisplayName(locale: Locale, country: Country | undefined): string {
  if (!country) return ''
  try {
    const formatter = new Intl.DisplayNames([LOCALE_META[locale].htmlLang], { type: 'region' })
    return formatter.of(country.iso_alpha2.toUpperCase()) ?? country.name_en ?? country.name_es
  } catch {
    return locale === 'es' ? country.name_es : country.name_en
  }
}

export function formatMoneyForLocale(locale: Locale, value: number): string {
  return new Intl.NumberFormat(LOCALE_META[locale].htmlLang, {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatNumberForLocale(locale: Locale, value: number): string {
  return new Intl.NumberFormat(LOCALE_META[locale].htmlLang).format(value)
}

export function formatAge(t: GameTranslate, age: number): string {
  return t('format.age', { age })
}
