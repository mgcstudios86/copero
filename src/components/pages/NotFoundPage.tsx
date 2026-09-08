import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AdsterraAd } from '../ads/AdsterraAd'
import {
  DEFAULT_LOCALE,
  LOCALE_META,
  localeFromPathname,
  localizePath,
  translate,
  type Locale,
} from '../../i18n/config'

function ensureMeta(name: string, content: string) {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = name
    document.head.append(meta)
  }
  meta.content = content
}

export function NotFoundPage() {
  const location = useLocation()
  const locale: Locale = localeFromPathname(location.pathname) ?? DEFAULT_LOCALE
  const t = (key: string) => translate(locale, 'common', key)

  useEffect(() => {
    document.documentElement.lang = LOCALE_META[locale].htmlLang
    document.title = `${t('notFound.title')} · Copero`
    ensureMeta('robots', 'noindex, nofollow')
    ensureMeta('description', t('notFound.body'))

    document.head.querySelector('link[rel="canonical"]')?.remove()
    document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((node) => node.remove())
    document.head.querySelectorAll('meta[property="og:locale:alternate"]').forEach((node) => node.remove())
    document.head.querySelector('#copero-structured-data')?.remove()
  }, [locale])

  return (
    <div className="game-page-shell">
      <main className="game-grid-shell flex min-h-screen items-center justify-center py-16">
        <section className="game-surface game-surface--strong w-full max-w-xl p-8 text-center sm:p-12">
          <p className="game-eyebrow">Error 404</p>
          <h1 className="game-title game-title--h1 mt-4">{t('notFound.title')}</h1>
          <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-[var(--copero-muted)]">
            {t('notFound.body')}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to={localizePath('/', locale)} className="game-button game-button--primary game-button--md">
              {t('notFound.back')}
            </Link>
            <a
              href="mailto:support@copero.top"
              className="game-button game-button--secondary game-button--md"
            >
              {t('notFound.support')}
            </a>
          </div>
        </section>
      </main>
      <AdsterraAd />
    </div>
  )
}
