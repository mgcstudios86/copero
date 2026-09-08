import { useEffect } from 'react'
import { getBuildCareerContent } from '../../data/buildCareerContent'
import { simuladorCarreraFutbolContent } from '../../data/simulador-carrera-futbol'
import { careerModeContent } from '../../data/career-modes'
import { DEFAULT_LOCALE, LOCALE_META, SUPPORTED_LOCALES, useI18n, type Locale } from '../../i18n/config'

const SITE_ORIGIN = 'https://copero.top'
const OG_IMAGE_URL = `${SITE_ORIGIN}/og.png`
const OG_IMAGE_ALT = 'Copero football career simulator'
const OG_LOCALE: Record<Locale, string> = { es: 'es_ES', en: 'en_US', 'zh-cn': 'zh_CN', de: 'de_DE', it: 'it_IT', 'pt-br': 'pt_BR', ko: 'ko_KR' }
export type SeoPage = 'home' | 'game' | 'about' | 'contact' | 'privacy' | 'terms' | 'buildCareer' | 'simuladorCarreraFutbol' | 'fullCareer' | 'quickCareer'

function pagePath(page: SeoPage): string {
  if (page === 'home') return '/'
  if (page === 'buildCareer') return '/copero-build-your-own-football-career'
  if (page === 'simuladorCarreraFutbol') return '/simulador-carrera-futbol'
  if (page === 'fullCareer') return '/carrera-completa'
  if (page === 'quickCareer') return '/carrera-rapida'
  return `/${page}`
}
function pageUrl(locale: Locale, page: SeoPage): string { const suffix = pagePath(page); return locale === DEFAULT_LOCALE ? `${SITE_ORIGIN}${suffix}` : `${SITE_ORIGIN}/${locale}${suffix}` }
function homeUrl(locale: Locale): string { return pageUrl(locale, 'home') }
function gameUrl(locale: Locale): string { return pageUrl(locale, 'game') }
function upsertMeta(selector: string, attributes: Record<string, string>) { let node = document.head.querySelector<HTMLMetaElement>(selector); if (!node) { node = document.createElement('meta'); document.head.append(node) } Object.entries(attributes).forEach(([key, value]) => node?.setAttribute(key, value)) }
function upsertCanonical(href: string) { let node = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]'); if (!node) { node = document.createElement('link'); node.rel = 'canonical'; document.head.append(node) } node.href = href }
function clearLocalizedAlternates() { document.head.querySelectorAll('link[rel="alternate"][hreflang], meta[property="og:locale:alternate"]').forEach((node) => node.remove()) }
function addLocalizedAlternates(page: SeoPage) { for (const locale of SUPPORTED_LOCALES) { const link = document.createElement('link'); link.rel = 'alternate'; link.hreflang = LOCALE_META[locale].hrefLang; link.href = pageUrl(locale, page); link.dataset.coperoHreflang = 'true'; document.head.append(link) } const fallback = document.createElement('link'); fallback.rel = 'alternate'; fallback.hreflang = 'x-default'; fallback.href = pageUrl(DEFAULT_LOCALE, page); fallback.dataset.coperoHreflang = 'true'; document.head.append(fallback) }
function addOgLocaleAlternates(current: Locale) { for (const locale of SUPPORTED_LOCALES) { if (locale === current) continue; const meta = document.createElement('meta'); meta.setAttribute('property', 'og:locale:alternate'); meta.content = OG_LOCALE[locale]; meta.dataset.coperoOgAlternate = 'true'; document.head.append(meta) } }
function setStructuredData(locale: Locale, page: SeoPage, title: string, description: string) { let script = document.head.querySelector<HTMLScriptElement>('#copero-structured-data'); if (!script) { script = document.createElement('script'); script.id = 'copero-structured-data'; script.type = 'application/ld+json'; document.head.append(script) } const graph: Record<string, unknown>[] = [{ '@type': 'WebSite', '@id': `${SITE_ORIGIN}/#website`, url: homeUrl(DEFAULT_LOCALE), name: 'Copero' }, { '@type': 'WebPage', '@id': `${pageUrl(locale, page)}#webpage`, url: pageUrl(locale, page), name: title, description, inLanguage: LOCALE_META[locale].htmlLang, isPartOf: { '@id': `${SITE_ORIGIN}/#website` } }]; if (page === 'home' || page === 'buildCareer' || page === 'simuladorCarreraFutbol' || page === 'fullCareer' || page === 'quickCareer') graph.push({ '@type': 'WebApplication', '@id': `${SITE_ORIGIN}/#game`, url: gameUrl(locale), name: 'Copero', applicationCategory: 'GameApplication', operatingSystem: 'Any', browserRequirements: 'Requires JavaScript', isAccessibleForFree: true, inLanguage: LOCALE_META[locale].htmlLang, description }); script.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }) }

export function PageSeo({ page }: { page: SeoPage }) {
  const { locale, t } = useI18n()
  useEffect(() => {
    const home = page === 'home'; const game = page === 'game'; const buildCareer = page === 'buildCareer'; const simulator = page === 'simuladorCarreraFutbol'; const careerMode = page === 'fullCareer' ? careerModeContent[locale].full : page === 'quickCareer' ? careerModeContent[locale].quick : null
    const buildCareerContent = buildCareer ? getBuildCareerContent(locale) : null
    const simulatorContent = simulator ? simuladorCarreraFutbolContent[locale] : null
    const title = home ? t('home', 'seo.title') : game ? t('home', 'seo.ogTitle') : buildCareerContent ? buildCareerContent.seo.title : simulatorContent ? simulatorContent.seo.title : careerMode ? careerMode.seo.title : t('pages', `${page}.seo.title`)
    const description = home ? t('home', 'seo.description') : game ? t('home', 'seo.ogDescription') : buildCareerContent ? buildCareerContent.seo.description : simulatorContent ? simulatorContent.seo.description : careerMode ? careerMode.seo.description : t('pages', `${page}.seo.description`)
    const canonical = pageUrl(locale, page); const robots = game ? 'noindex, nofollow' : 'index, follow'
    document.documentElement.lang = LOCALE_META[locale].htmlLang; document.title = title; document.head.querySelector('meta[name="keywords"]')?.remove()
    upsertMeta('meta[name="description"]', { name: 'description', content: description }); upsertMeta('meta[name="robots"]', { name: 'robots', content: robots }); upsertCanonical(canonical)
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' }); upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'Copero' }); upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: OG_LOCALE[locale] }); upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical }); upsertMeta('meta[property="og:title"]', { property: 'og:title', content: home ? t('home', 'seo.ogTitle') : title }); upsertMeta('meta[property="og:description"]', { property: 'og:description', content: home ? t('home', 'seo.ogDescription') : description }); upsertMeta('meta[property="og:image"]', { property: 'og:image', content: OG_IMAGE_URL }); upsertMeta('meta[property="og:image:secure_url"]', { property: 'og:image:secure_url', content: OG_IMAGE_URL }); upsertMeta('meta[property="og:image:type"]', { property: 'og:image:type', content: 'image/png' }); upsertMeta('meta[property="og:image:width"]', { property: 'og:image:width', content: '1200' }); upsertMeta('meta[property="og:image:height"]', { property: 'og:image:height', content: '630' }); upsertMeta('meta[property="og:image:alt"]', { property: 'og:image:alt', content: OG_IMAGE_ALT })
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' }); upsertMeta('meta[name="twitter:domain"]', { name: 'twitter:domain', content: 'copero.top' }); upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title }); upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description }); upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: OG_IMAGE_URL }); upsertMeta('meta[name="twitter:image:alt"]', { name: 'twitter:image:alt', content: OG_IMAGE_ALT })
    clearLocalizedAlternates(); if (!game) { addLocalizedAlternates(page); addOgLocaleAlternates(locale); setStructuredData(locale, page, title, description) } else document.head.querySelector('#copero-structured-data')?.remove()
  }, [locale, page, t])
  return null
}
