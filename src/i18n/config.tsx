import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import languageAvailability from './language-availability.json'
import deCommon from './locales/de/common.json'
import deGame from './locales/de/game.json'
import deGameUi from './locales/de/game-ui.json'
import deHome from './locales/de/home.json'
import deHomePreview from './locales/de/home-preview.json'
import dePages from './locales/de/pages.json'
import enCommon from './locales/en/common.json'
import enGame from './locales/en/game.json'
import enGameUi from './locales/en/game-ui.json'
import enHome from './locales/en/home.json'
import enHomePreview from './locales/en/home-preview.json'
import enPages from './locales/en/pages.json'
import esCommon from './locales/es/common.json'
import esGame from './locales/es/game.json'
import esGameUi from './locales/es/game-ui.json'
import esHome from './locales/es/home.json'
import esHomePreview from './locales/es/home-preview.json'
import esPages from './locales/es/pages.json'
import itCommon from './locales/it/common.json'
import itGame from './locales/it/game.json'
import itGameUi from './locales/it/game-ui.json'
import itHome from './locales/it/home.json'
import itHomePreview from './locales/it/home-preview.json'
import itPages from './locales/it/pages.json'
import koCommon from './locales/ko/common.json'
import koGame from './locales/ko/game.json'
import koGameUi from './locales/ko/game-ui.json'
import koHome from './locales/ko/home.json'
import koHomePreview from './locales/ko/home-preview.json'
import koPages from './locales/ko/pages.json'
import ptBrCommon from './locales/pt-br/common.json'
import ptBrGame from './locales/pt-br/game.json'
import ptBrGameUi from './locales/pt-br/game-ui.json'
import ptBrHome from './locales/pt-br/home.json'
import ptBrHomePreview from './locales/pt-br/home-preview.json'
import ptBrPages from './locales/pt-br/pages.json'
import zhCommon from './locales/zh-cn/common.json'
import zhGame from './locales/zh-cn/game.json'
import zhGameUi from './locales/zh-cn/game-ui.json'
import zhHome from './locales/zh-cn/home.json'
import zhHomePreview from './locales/zh-cn/home-preview.json'
import zhPages from './locales/zh-cn/pages.json'

export const SUPPORTED_LOCALES = ['es', 'en', 'zh-cn', 'de', 'it', 'pt-br', 'ko'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export type TranslationNamespace = 'common' | 'home' | 'game' | 'pages'

export const DEFAULT_LOCALE: Locale = 'es'
export const LOCALE_PREFERENCE_KEY = 'copero:locale'

export const LOCALE_META: Record<Locale, { label: string; short: string; htmlLang: string; hrefLang: string }> = {
  es: { label: 'Español', short: 'ES', htmlLang: 'es', hrefLang: 'es' },
  en: { label: 'English', short: 'EN', htmlLang: 'en', hrefLang: 'en' },
  'zh-cn': { label: '中文', short: '中文', htmlLang: 'zh-CN', hrefLang: 'zh-CN' },
  de: { label: 'Deutsch', short: 'DE', htmlLang: 'de', hrefLang: 'de' },
  it: { label: 'Italiano', short: 'IT', htmlLang: 'it', hrefLang: 'it' },
  'pt-br': { label: 'Português (Brasil)', short: 'PT-BR', htmlLang: 'pt-BR', hrefLang: 'pt-BR' },
  ko: { label: '한국어', short: 'KO', htmlLang: 'ko', hrefLang: 'ko' },
}

type Dictionary = Record<string, unknown>
type Resources = Record<Locale, Record<TranslationNamespace, Dictionary>>

function homeResource(locale: Locale, home: Dictionary, preview: Dictionary): Dictionary {
  return {
    ...home,
    ...preview,
    'faq.items.save.answer': languageAvailability[locale].save,
  }
}

function pagesResource(locale: Locale, pages: Dictionary): Dictionary {
  return {
    ...pages,
    'about.sections.languages.body': languageAvailability[locale].about,
  }
}

const resources: Resources = {
  es: { common: esCommon, home: homeResource('es', esHome, esHomePreview), game: { ...esGame, ...esGameUi }, pages: pagesResource('es', esPages) },
  en: { common: enCommon, home: homeResource('en', enHome, enHomePreview), game: { ...enGame, ...enGameUi }, pages: pagesResource('en', enPages) },
  'zh-cn': { common: zhCommon, home: homeResource('zh-cn', zhHome, zhHomePreview), game: { ...zhGame, ...zhGameUi }, pages: pagesResource('zh-cn', zhPages) },
  de: { common: deCommon, home: homeResource('de', deHome, deHomePreview), game: { ...deGame, ...deGameUi }, pages: pagesResource('de', dePages) },
  it: { common: itCommon, home: homeResource('it', itHome, itHomePreview), game: { ...itGame, ...itGameUi }, pages: pagesResource('it', itPages) },
  'pt-br': { common: ptBrCommon, home: homeResource('pt-br', ptBrHome, ptBrHomePreview), game: { ...ptBrGame, ...ptBrGameUi }, pages: pagesResource('pt-br', ptBrPages) },
  ko: { common: koCommon, home: homeResource('ko', koHome, koHomePreview), game: { ...koGame, ...koGameUi }, pages: pagesResource('ko', koPages) },
}

export function isSupportedLocale(value: string | undefined | null): value is Locale {
  return Boolean(value && SUPPORTED_LOCALES.includes(value as Locale))
}

export function localeFromPathname(pathname: string): Locale | null {
  const firstSegment = pathname.split('/').filter(Boolean)[0]
  return isSupportedLocale(firstSegment) ? firstSegment : null
}

export function localizePath(pathname: string, locale: Locale): string {
  const segments = pathname.split('/').filter(Boolean)
  if (isSupportedLocale(segments[0])) segments.shift()
  const suffix = segments.length ? `/${segments.join('/')}` : '/'
  return locale === DEFAULT_LOCALE ? suffix : `/${locale}${suffix}`
}

function readPath(dictionary: Dictionary, key: string): unknown {
  if (Object.prototype.hasOwnProperty.call(dictionary, key)) return dictionary[key]
  return key.split('.').reduce<unknown>((value, part) => {
    if (!value || typeof value !== 'object') return undefined
    return (value as Dictionary)[part]
  }, dictionary)
}

function interpolate(value: string, params?: Record<string, string | number>): string {
  if (!params) return value
  return value.replace(/{{\s*([\w.-]+)\s*}}/g, (match, key: string) => {
    const replacement = params[key]
    return replacement == null ? match : String(replacement)
  })
}

export function translate(
  locale: Locale,
  namespace: TranslationNamespace,
  key: string,
  params?: Record<string, string | number>,
): string {
  const value = readPath(resources[locale][namespace], key)
  if (typeof value === 'string') return interpolate(value, params)
  if (locale !== DEFAULT_LOCALE) {
    const fallback = readPath(resources[DEFAULT_LOCALE][namespace], key)
    if (typeof fallback === 'string') return interpolate(fallback, params)
  }
  return key
}

type I18nContextValue = {
  locale: Locale
  t: (namespace: TranslationNamespace, key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = LOCALE_META[locale].htmlLang
    try {
      localStorage.setItem(LOCALE_PREFERENCE_KEY, locale)
    } catch {
      // URL remains the source of truth even when preference storage is unavailable.
    }
  }, [locale])

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      t: (namespace, key, params) => translate(locale, namespace, key, params),
    }),
    [locale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n must be used within I18nProvider')
  return context
}
