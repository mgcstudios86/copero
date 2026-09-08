import { Link } from 'react-router-dom'
import App from '../App'
import { AdsterraAd } from '../components/ads/AdsterraAd'
import { LanguageSwitcher } from '../components/layout/LanguageSwitcher'
import { localizePath, useI18n } from '../i18n/config'

export function GamePage() {
  const { locale, t } = useI18n()
  const home = localizePath('/', locale)

  return (
    <div className="game-page-shell">
      <header className="game-page-header">
        <div className="game-page-header__inner">
          <Link className="game-page-brand" to={home}>
            <span className="game-page-brand__mark" aria-hidden="true">C</span>
            <span>Copero</span>
          </Link>
          <div className="game-page-header__actions">
            <Link className="game-page-home-link" to={home}>
              {t('common', 'nav.home')}
            </Link>
            <LanguageSwitcher compact />
          </div>
        </div>
      </header>
      <App />
      <AdsterraAd />
    </div>
  )
}
