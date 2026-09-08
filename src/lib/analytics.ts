type AnalyticsPrimitive = string | number | boolean
export type AnalyticsParams = Record<string, AnalyticsPrimitive | undefined>

export type GameAnalyticsEvent =
  | 'game_started'
  | 'identity_completed'
  | 'draft_round_completed'
  | 'draft_legend_skipped'
  | 'draft_completed'
  | 'origin_club_selected'
  | 'season_completed'
  | 'transfer_offer_accepted'
  | 'career_finished'
  | 'result_shared'
  | 'result_card_downloaded'
  | 'career_restarted'

type Gtag = (...args: unknown[]) => void
type Clarity = ((...args: unknown[]) => void) & { q?: unknown[][] }

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: Gtag
    clarity?: Clarity
  }
}

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim()
const CLARITY_PROJECT_ID = import.meta.env.VITE_CLARITY_PROJECT_ID?.trim()
const analyticsEnabled = import.meta.env.PROD && Boolean(GA_MEASUREMENT_ID || CLARITY_PROJECT_ID)

function appendScript(id: string, src: string): void {
  if (document.getElementById(id)) return
  const script = document.createElement('script')
  script.id = id
  script.async = true
  script.src = src
  document.head.appendChild(script)
}

function initGoogleAnalytics(): void {
  if (!GA_MEASUREMENT_ID) return

  window.dataLayer = window.dataLayer ?? []
  window.gtag =
    window.gtag ??
    function gtag(..._args: unknown[]): void {
      window.dataLayer?.push(arguments)
    }

  window.gtag('js', new Date())
  window.gtag('config', GA_MEASUREMENT_ID, {
    anonymize_ip: true,
    send_page_view: false,
  })
  appendScript(
    'copero-google-analytics',
    `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`,
  )
}

function initClarity(): void {
  if (!CLARITY_PROJECT_ID) return

  if (!window.clarity) {
    const clarity: Clarity = (...args: unknown[]) => {
      clarity.q = clarity.q ?? []
      clarity.q.push(args)
    }
    window.clarity = clarity
  }

  appendScript(
    'copero-microsoft-clarity',
    `https://www.clarity.ms/tag/${encodeURIComponent(CLARITY_PROJECT_ID)}`,
  )
}

export function initAnalytics(): void {
  if (!analyticsEnabled || typeof document === 'undefined') return
  initGoogleAnalytics()
  initClarity()
}

export function trackPageView(path: string): void {
  if (!analyticsEnabled || !GA_MEASUREMENT_ID || typeof window === 'undefined') return

  window.gtag?.('event', 'page_view', {
    page_path: path,
    page_location: `${window.location.origin}${path}`,
  })
}

export function trackGameEvent(name: GameAnalyticsEvent, params: AnalyticsParams = {}): void {
  if (!analyticsEnabled || typeof window === 'undefined') return

  const cleanParams = Object.fromEntries(
    Object.entries(params).filter((entry): entry is [string, AnalyticsPrimitive] => entry[1] !== undefined),
  )

  window.gtag?.('event', name, cleanParams)
  window.clarity?.('event', name)
}

export function trackGameEventOnce(
  dedupeKey: string,
  name: GameAnalyticsEvent,
  params: AnalyticsParams = {},
): void {
  if (!analyticsEnabled || typeof sessionStorage === 'undefined') return

  const storageKey = `copero:analytics:${dedupeKey}`
  try {
    if (sessionStorage.getItem(storageKey)) return
    sessionStorage.setItem(storageKey, '1')
  } catch {
    // Analytics must never block the game when storage is unavailable.
  }
  trackGameEvent(name, params)
}
