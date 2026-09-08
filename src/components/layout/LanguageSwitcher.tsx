import { useLocation, useNavigate } from 'react-router-dom'
import {
  LOCALE_META,
  SUPPORTED_LOCALES,
  localizePath,
  useI18n,
  type Locale,
} from '../../i18n/config'

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()

  const changeLocale = (nextLocale: Locale) => {
    if (nextLocale === locale) return
    navigate(`${localizePath(location.pathname, nextLocale)}${location.search}${location.hash}`)
  }

  return (
    <div className="language-switcher">
      <select
        className="min-w-[70px] cursor-pointer border-0 bg-transparent px-2 py-2 font-[var(--copero-font-mono)] text-[11px] font-bold text-[color:var(--copero-fg)] outline-none"
        aria-label={t('common', 'language.label')}
        value={locale}
        style={{ colorScheme: 'dark' }}
        onChange={(event) => changeLocale(event.target.value as Locale)}
      >
        {SUPPORTED_LOCALES.map((option) => (
          <option key={option} value={option}>
            {compact ? LOCALE_META[option].short : LOCALE_META[option].label}
          </option>
        ))}
      </select>
    </div>
  )
}
