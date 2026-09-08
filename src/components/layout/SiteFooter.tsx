import { Link } from 'react-router-dom'
import { localizePath, useI18n } from '../../i18n/config'
import { AdsterraAd } from '../ads/AdsterraAd'

const FOOTER_LINKS = ['about', 'contact', 'privacy', 'terms'] as const
const BUILD_CAREER_PATH = '/copero-build-your-own-football-career'

export function SiteFooter() {
  const { locale, t } = useI18n()

  return (
    <footer className="site-footer">
      <AdsterraAd />
      <div className="site-container site-footer__inner site-footer__inner--links">
        <div className="site-footer__copy">
          <p>© 2026 copero.top · {t('common', 'footer.independent')}</p>
          <p>{t('common', 'footer.disclaimer')}</p>
        </div>
        <nav className="site-footer__nav" aria-label={t('common', 'footer.navigation')}>
          {FOOTER_LINKS.map((page) => (
            <Link key={page} to={localizePath(`/${page}`, locale)}>
              {t('common', `footer.${page}`)}
            </Link>
          ))}
          {locale === 'en' && <Link to={BUILD_CAREER_PATH}>Build your career</Link>}
        </nav>
      </div>
    </footer>
  )
}
