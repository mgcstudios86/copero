import { useState } from 'react'
import { Link } from 'react-router-dom'
import { localizePath, useI18n, type Locale } from '../../i18n/config'
import { LanguageSwitcher } from './LanguageSwitcher'

const BUILD_CAREER_PATH = '/copero-build-your-own-football-career'
const SIMULATOR_PATH = '/simulador-carrera-futbol'
const FULL_CAREER_PATH = '/carrera-completa'
const QUICK_CAREER_PATH = '/carrera-rapida'
const BUILD_CAREER_LABEL: Record<Locale, string> = {
  es: 'Crea tu carrera',
  en: 'Build your career',
  'zh-cn': '创建你的足球生涯',
  de: 'Erstelle deine Karriere',
  it: 'Crea la tua carriera',
  'pt-br': 'Crie sua carreira',
  ko: '나만의 커리어 만들기',
}
const SIMULATOR_NAV_LABEL: Record<Locale, string> = {
  es: 'Simulador de carrera',
  en: 'Career Simulator',
  'zh-cn': '足球生涯模拟器',
  de: 'Karrieresimulator',
  it: 'Simulatore di carriera',
  'pt-br': 'Simulador de carreira',
  ko: '축구 커리어 시뮬레이터',
}
const MODE_NAV_LABEL: Record<Locale, { full: string; quick: string }> = {
  es: { full: 'Carrera completa', quick: 'Carrera rápida' },
  en: { full: 'Full career', quick: 'Quick career' },
  'zh-cn': { full: '完整生涯', quick: '快速生涯' },
  de: { full: 'Volle Karriere', quick: 'Schnelle Karriere' },
  it: { full: 'Carriera completa', quick: 'Carriera veloce' },
  'pt-br': { full: 'Carreira completa', quick: 'Carreira rápida' },
  ko: { full: '전체 커리어', quick: '빠른 커리어' },
}

export function SiteHeader({ playHref, showLanguageSwitcher = true }: { playHref?: string; showLanguageSwitcher?: boolean } = {}) {
  const { locale, t } = useI18n()
  const home = localizePath('/', locale)
  const buildCareer = localizePath(BUILD_CAREER_PATH, locale)
  const simulatorHref = localizePath(SIMULATOR_PATH, locale)
  const fullCareerHref = localizePath(FULL_CAREER_PATH, locale)
  const quickCareerHref = localizePath(QUICK_CAREER_PATH, locale)
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  return (
    <header className="site-header">
      <div className="site-container site-header__inner">
        <Link className="brand-lockup" to={home} aria-label={t('common', 'brand')}>
          <img className="brand-mark" src="/favicon.svg" alt="" width="42" height="42" aria-hidden="true" />
          <span>Copero</span>
        </Link>
        <nav className="site-nav" id="site-navigation" aria-label={t('common', 'nav.primary')} data-open={menuOpen}>
          <Link to={simulatorHref} onClick={closeMenu}>{SIMULATOR_NAV_LABEL[locale]}</Link>
          <Link to={buildCareer} onClick={closeMenu}>{BUILD_CAREER_LABEL[locale]}</Link>
          <Link to={fullCareerHref} onClick={closeMenu}>{MODE_NAV_LABEL[locale].full}</Link>
          <Link to={quickCareerHref} onClick={closeMenu}>{MODE_NAV_LABEL[locale].quick}</Link>
          <a href={`${home}#how-to-play`} onClick={closeMenu}>{t('common', 'nav.howToPlay')}</a>
          <a href={`${home}#mechanics`} onClick={closeMenu}>{t('common', 'nav.mechanics')}</a>
          <a href={`${home}#faq`} onClick={closeMenu}>{t('common', 'nav.faq')}</a>
          <a className="site-nav__mobile-play" href={playHref ?? `${home}#play`} onClick={closeMenu}>{t('common', 'nav.play')}</a>
        </nav>
        <div className="site-header__actions">
          {showLanguageSwitcher && <LanguageSwitcher compact />}
          <button className="site-nav-toggle" type="button" aria-expanded={menuOpen} aria-controls="site-navigation" aria-label={t('common', 'nav.primary')} onClick={() => setMenuOpen((open) => !open)}><span aria-hidden="true" /></button>
          <a className="button button--primary button--small" href={playHref ?? `${home}#play`}>{t('common', 'nav.play')}</a>
        </div>
      </div>
    </header>
  )
}
