import { Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { AnalyticsRouteTracker } from '../components/analytics/AnalyticsRouteTracker'
import { NotFoundPage } from '../components/pages/NotFoundPage'
import { PageSeo, type SeoPage } from '../components/seo/PageSeo'
import { HomePage } from '../pages/HomePage'
import { GamePage } from '../pages/GamePage'
import { InfoPage, type InfoPageKind } from '../pages/InfoPage'
import { BuildCareerPage } from '../pages/BuildCareerPage'
import { SimuladorCarreraFutbolPage } from '../pages/SimuladorCarreraFutbolPage'
import { CareerModePage } from '../pages/CareerModePage'
import { DEFAULT_LOCALE, I18nProvider, isSupportedLocale } from '../i18n/config'

const INFO_PAGES = ['about', 'contact', 'privacy', 'terms'] as const satisfies readonly InfoPageKind[]
const BUILD_CAREER_PATH = 'copero-build-your-own-football-career'
const SIMULATOR_PATH = 'simulador-carrera-futbol'
const FULL_CAREER_PATH = 'carrera-completa'
const QUICK_CAREER_PATH = 'carrera-rapida'

function seoPageFromPath(pathname: string): SeoPage {
  const segments = pathname.split('/').filter(Boolean)
  if (isSupportedLocale(segments[0])) segments.shift()
  const segment = segments[0]
  if (segment === 'game') return 'game'
  if (segment === BUILD_CAREER_PATH) return 'buildCareer'
  if (segment === SIMULATOR_PATH) return 'simuladorCarreraFutbol'
  if (segment === FULL_CAREER_PATH) return 'fullCareer'
  if (segment === QUICK_CAREER_PATH) return 'quickCareer'
  if (INFO_PAGES.includes(segment as InfoPageKind)) return segment as InfoPageKind
  return 'home'
}

function LocaleSeo() {
  const { pathname } = useLocation()
  return <PageSeo page={seoPageFromPath(pathname)} />
}

function DefaultLocaleLayout() {
  return (
    <I18nProvider locale={DEFAULT_LOCALE}>
      <LocaleSeo />
      <Outlet />
    </I18nProvider>
  )
}

function PrefixedLocaleLayout() {
  const { locale } = useParams()
  if (!isSupportedLocale(locale) || locale === DEFAULT_LOCALE) return <NotFoundPage />
  return (
    <I18nProvider locale={locale}>
      <LocaleSeo />
      <Outlet />
    </I18nProvider>
  )
}

function DefaultLocaleRedirect() {
  const location = useLocation()
  const suffix = location.pathname.replace(/^\/es(?=\/|$)/, '') || '/'
  return <Navigate to={`${suffix}${location.search}${location.hash}`} replace />
}

export function AppRouter() {
  return (
    <>
      <AnalyticsRouteTracker />
      <Routes>
        <Route path="/es/*" element={<DefaultLocaleRedirect />} />
        <Route element={<DefaultLocaleLayout />}>
          <Route index element={<HomePage />} />
          <Route path="game" element={<GamePage />} />
          <Route path={BUILD_CAREER_PATH} element={<BuildCareerPage />} />
          <Route path={SIMULATOR_PATH} element={<SimuladorCarreraFutbolPage />} />
          <Route path={FULL_CAREER_PATH} element={<CareerModePage mode="full" />} />
          <Route path={QUICK_CAREER_PATH} element={<CareerModePage mode="quick" />} />
          <Route path="about" element={<InfoPage page="about" />} />
          <Route path="contact" element={<InfoPage page="contact" />} />
          <Route path="privacy" element={<InfoPage page="privacy" />} />
          <Route path="terms" element={<InfoPage page="terms" />} />
        </Route>
        <Route path="/:locale" element={<PrefixedLocaleLayout />}>
          <Route index element={<HomePage />} />
          <Route path="game" element={<GamePage />} />
          <Route path={BUILD_CAREER_PATH} element={<BuildCareerPage />} />
          <Route path={SIMULATOR_PATH} element={<SimuladorCarreraFutbolPage />} />
          <Route path={FULL_CAREER_PATH} element={<CareerModePage mode="full" />} />
          <Route path={QUICK_CAREER_PATH} element={<CareerModePage mode="quick" />} />
          <Route path="about" element={<InfoPage page="about" />} />
          <Route path="contact" element={<InfoPage page="contact" />} />
          <Route path="privacy" element={<InfoPage page="privacy" />} />
          <Route path="terms" element={<InfoPage page="terms" />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  )
}
