import { useI18n } from '../../i18n/config'
import type { GameTranslate } from '../../i18n/game'
import { AnimatedNumber } from './AnimatedNumber'

type IconProps = { className?: string }

export function MatchesIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <line x1="12" y1="4" x2="12" y2="20" stroke="currentColor" strokeWidth="1.2" opacity="0.7" />
      <circle cx="12" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 8h4v8H2M22 8h-4v8h4" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

export function GoalsIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 3.2 14.2 8l5-.4-3.6 3.6 2.2 4.6L12 13.8 6.2 15.8l2.2-4.6L4.8 7.6l5 .4z"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.85" />
    </svg>
  )
}

export function AssistsIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M4 16.5c2.2-1.2 4.5-1.5 6.2-.3l1.4 1c.5.35 1.2.3 1.6-.15L16 14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M5.5 18.2c1.8.9 3.6 1.1 5.2.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
      <path
        d="M15.5 13.5 20 9.2M17.2 9.4l2.8-.2-.3 2.7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7.2" cy="15.2" r="1.1" fill="currentColor" />
    </svg>
  )
}

export function StatIcons({
  appearances,
  goals,
  assists,
  animate = true,
  compact = false,
}: {
  appearances: number
  goals: number
  assists: number
  animate?: boolean
  compact?: boolean
}) {
  const { t } = useI18n()
  const gameT: GameTranslate = (key, params) => t('game', key, params)
  const Num = ({ n }: { n: number }) =>
    animate ? <AnimatedNumber value={n} className="tabular-nums" /> : <span className="tabular-nums">{n}</span>
  const matchesLabel = gameT('summary.matches')
  const goalsLabel = gameT('summary.goals')
  const assistsLabel = gameT('summary.assists')

  if (compact) {
    const icon = 'h-3.5 w-3.5 shrink-0'
    return (
      <div className="flex items-center gap-2.5 text-[11px] font-semibold">
        <span className="inline-flex min-w-[2.25rem] items-center gap-0.5 text-[color:var(--copero-accent)]" title={matchesLabel}>
          <MatchesIcon className={icon} />
          <Num n={appearances} />
        </span>
        <span className="inline-flex min-w-[2.25rem] items-center gap-0.5 text-[color:var(--copero-fg)]" title={goalsLabel}>
          <GoalsIcon className={icon} />
          <Num n={goals} />
        </span>
        <span className="inline-flex min-w-[2.25rem] items-center gap-0.5 text-sky-300" title={assistsLabel}>
          <AssistsIcon className={icon} />
          <Num n={assists} />
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-4 text-sm font-semibold">
      <div className="flex items-center gap-1.5 text-[color:var(--copero-accent)]" title={matchesLabel}>
        <MatchesIcon className="h-5 w-5" />
        <Num n={appearances} />
        <span className="font-[family-name:var(--copero-font-mono)] text-[9px] font-medium uppercase tracking-wide opacity-65">M</span>
      </div>
      <div className="flex items-center gap-1.5 text-[color:var(--copero-fg)]" title={goalsLabel}>
        <GoalsIcon className="h-5 w-5" />
        <Num n={goals} />
        <span className="font-[family-name:var(--copero-font-mono)] text-[9px] font-medium uppercase tracking-wide opacity-55">G</span>
      </div>
      <div className="flex items-center gap-1.5 text-sky-300" title={assistsLabel}>
        <AssistsIcon className="h-5 w-5" />
        <Num n={assists} />
        <span className="font-[family-name:var(--copero-font-mono)] text-[9px] font-medium uppercase tracking-wide opacity-65">A</span>
      </div>
    </div>
  )
}
