import { DEFAULT_LOCALE, localeFromPathname, translate, type Locale } from './config'

function activeLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE
  return localeFromPathname(window.location.pathname) ?? DEFAULT_LOCALE
}

/**
 * Compatibility facade for legacy game components.
 * New code should prefer useI18n(), but keeping this function locale-aware lets us
 * migrate components incrementally without ever falling back to a hard-coded Spanish dictionary.
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  return translate(activeLocale(), 'game', key, vars)
}
