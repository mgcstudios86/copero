import { getCountry, getCompetition, getTeam } from '../../data/catalog'
import { flagUrl } from '../../data/flags'
import { aggregateTrophies } from '../../data/trophies'
import { hasModifier } from '../../engine/modifiers'
import type { GameState } from '../../engine/types'
import {
  BASE_RETIREMENT_AGE,
  LONGEVITY_RETIREMENT_AGE,
  MODE_CONFIG,
  START_AGE,
} from '../../engine/types'
import { useI18n } from '../../i18n/config'
import { countryDisplayName, type GameTranslate } from '../../i18n/game'
import { OvrBadge } from './OvrBadge'
import { AssistsIcon, GoalsIcon, MatchesIcon, StatIcons } from './StatIcons'
import { TrophyIcon } from './TrophyIcon'

function contrastText(hex?: string): string {
  if (!hex || !/^#?[0-9a-fA-F]{6}$/.test(hex.replace('#', ''))) return '#fff'
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 140 ? '#111' : '#fff'
}

export function CareerTimeline({
  state,
  choosingClub,
  decidingCareer,
}: {
  state: GameState
  choosingClub?: boolean
  decidingCareer?: boolean
}) {
  const { locale, t } = useI18n()
  const gameT: GameTranslate = (key, params) => t('game', key, params)
  const maxAge = hasModifier(state, 'iron_longevity') ? LONGEVITY_RETIREMENT_AGE : BASE_RETIREMENT_AGE
  const startAge = START_AGE
  const step = MODE_CONFIG[state.mode].periodLengthSeasons
  const currentAge = state.player?.age ?? startAge
  const lastSeason = state.seasons[state.seasons.length - 1]
  const retired = state.phase === 'summary' || state.currentEvent?.type === 'retire'
  const lastPlayedAge = lastSeason?.age ?? startAge
  const lastBucketWithData = startAge + Math.floor((lastPlayedAge - startAge) / step) * step
  const currentBucket = startAge + Math.floor((currentAge - startAge) / step) * step

  const ages: number[] = []
  if (state.seasons.length === 0 && !retired) {
    for (
      let age = startAge;
      age <= startAge + Math.floor((maxAge - startAge) / step) * step;
      age += step
    ) {
      ages.push(age)
    }
  } else {
    const displayEnd = retired
      ? lastBucketWithData
      : Math.min(maxAge, Math.max(lastBucketWithData, currentBucket))
    for (let age = startAge; age <= displayEnd; age += step) ages.push(age)
    while (ages.length > 0) {
      const tail = ages[ages.length - 1]!
      const hasData = state.seasons.some(
        (season) => startAge + Math.floor((season.age - startAge) / step) * step === tail,
      )
      const isActiveCareer = !retired && tail === currentBucket
      if (hasData || isActiveCareer) break
      ages.pop()
    }
  }

  const byAge = new Map<number, (typeof state.seasons)[number][]>()
  for (const season of state.seasons) {
    const bucket = startAge + Math.floor((season.age - startAge) / step) * step
    const list = byAge.get(bucket) ?? []
    list.push(season)
    byAge.set(bucket, list)
  }

  const country = state.player ? getCountry(state.player.nationalityFifa) : undefined
  const national = state.nationalTotals ?? {
    appearances: 0,
    goals: 0,
    assists: 0,
    cleanSheets: 0,
    goalsConceded: 0,
  }

  return (
    <div className="glass-card flex h-full min-h-[520px] flex-col overflow-hidden rounded-[var(--copero-radius-lg)]">
      <div className="grid grid-cols-[52px_1fr_52px_minmax(0,1.2fr)] gap-2 border-b border-[color:var(--copero-border)] px-3 py-2 font-[family-name:var(--copero-font-mono)] text-[10px] uppercase tracking-wider text-[color:var(--copero-muted)]">
        <span>{gameT('timeline.age')}</span>
        <span>{gameT('timeline.club')}</span>
        <span>OVR</span>
        <span className="flex items-center gap-2.5">
          <MatchesIcon className="h-3.5 w-3.5 text-[color:var(--copero-accent)]" />
          <GoalsIcon className="h-3.5 w-3.5 text-[color:var(--copero-fg)]" />
          <AssistsIcon className="h-3.5 w-3.5 text-sky-300" />
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {ages.map((age) => {
          const seasons = byAge.get(age) ?? []
          const isCurrent = currentAge >= age && currentAge < age + step
          const first = seasons[0]
          const last = seasons[seasons.length - 1]
          const loanSeason = [...seasons].reverse().find((season) => season.loan)
          const displaySeason = loanSeason ?? last
          const team = displaySeason ? getTeam(displaySeason.teamId) : undefined
          const competitionId =
            displaySeason?.competitionId ??
            (team && displaySeason
              ? (state.teamCompetitionOverrides?.[displaySeason.teamId] ?? team.competition_id)
              : undefined)
          const competition = competitionId ? getCompetition(competitionId) : undefined
          const displayTier = competition?.tier
          const hadRelegation = seasons.some((season) => season.struggle === 'relegated')
          const hadPromotion = seasons.some((season) => season.struggle === 'promoted')
          const hadSuspension = seasons.some((season) => season.suspended)
          const hadInjury = seasons.some((season) => season.injured)
          const hadLoan = Boolean(loanSeason)
          const loanParentId =
            loanSeason?.loanParentTeamId ??
            (hadLoan ? state.formativeTeamId ?? undefined : undefined)
          const parentTeam = loanParentId ? getTeam(loanParentId) : undefined
          const firstTeam =
            first && last && first.teamId !== last.teamId && !hadLoan
              ? getTeam(first.teamId)
              : undefined
          const fromTeam =
            hadLoan && parentTeam && parentTeam.id !== displaySeason?.teamId
              ? parentTeam
              : firstTeam
          const trophies = seasons.flatMap((season) => season.trophies)
          const aggregated =
            seasons.length === 0 || !displaySeason
              ? null
              : {
                  teamId: displaySeason.teamId,
                  overall: Math.max(...seasons.map((season) => season.overall)),
                  appearances: seasons.reduce((total, season) => total + season.stats.appearances, 0),
                  goals: seasons.reduce((total, season) => total + season.stats.goals, 0),
                  assists: seasons.reduce((total, season) => total + season.stats.assists, 0),
                }

          const badgeBg = aggregated ? team?.primary_color : undefined
          const badgeStyle = badgeBg
            ? { background: badgeBg, color: contrastText(badgeBg) }
            : undefined
          const shortName = (name: string, max = 12) =>
            name.length > max ? `${name.slice(0, max - 1)}…` : name

          return (
            <div
              key={age}
              className={`mb-1 grid grid-cols-[52px_1fr_52px_minmax(0,1.2fr)] items-center gap-2 rounded-[var(--copero-radius)] px-2 py-2 transition ${
                isCurrent
                  ? 'bg-[color:color-mix(in_oklch,var(--copero-accent)_7%,transparent)] ring-1 ring-[color:color-mix(in_oklch,var(--copero-accent)_22%,transparent)]'
                  : ''
              }`}
            >
              <span
                className={`inline-flex h-8 w-10 items-center justify-center rounded-lg font-[family-name:var(--copero-font-mono)] text-sm font-bold ${
                  badgeBg ? 'text-white' : 'bg-white/10 text-[color:var(--copero-muted)]'
                }`}
                style={badgeStyle}
              >
                {age}
              </span>
              <div className="min-w-0">
                {aggregated ? (
                  <div className="flex min-w-0 items-center gap-2 text-sm">
                    {fromTeam && (
                      <>
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/95 p-0.5 shadow-sm ring-1 ring-black/10"
                          title={fromTeam.name}
                        >
                          {fromTeam.logo_url ? (
                            <img src={fromTeam.logo_url} alt="" className="h-full w-full object-contain" />
                          ) : (
                            <span className="text-[9px] font-bold text-black/40">?</span>
                          )}
                        </span>
                        <span className="shrink-0 text-[color:var(--copero-muted)]" title={hadLoan ? gameT('timeline.loan') : gameT('timeline.clubChange')}>
                          →
                        </span>
                      </>
                    )}
                    {hadLoan && !fromTeam && (
                      <span className="text-[color:var(--copero-muted)]" title={gameT('timeline.loan')}>
                        ↳
                      </span>
                    )}
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/95 p-1 shadow-sm ring-1 ring-black/10">
                      {team?.logo_url ? (
                        <img src={team.logo_url} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <span className="text-[10px] font-bold text-black/40">?</span>
                      )}
                    </span>
                    <span className="min-w-0 truncate font-medium text-[color:var(--copero-fg)]">
                      {fromTeam
                        ? `${shortName(fromTeam.name)} → ${shortName(team?.name ?? aggregated.teamId)}`
                        : (team?.name ?? aggregated.teamId)}
                    </span>
                    {trophies.slice(0, 3).map((trophy, index) => (
                      <TrophyIcon
                        key={`${trophy.id}-${index}`}
                        src={trophy.assetPath}
                        name={trophy.name}
                        className="h-5 w-5"
                      />
                    ))}
                  </div>
                ) : isCurrent && choosingClub ? (
                  <span className="pulse-pick text-sm text-[color:var(--copero-muted)]">{gameT('timeline.choosingClub')}</span>
                ) : isCurrent && decidingCareer ? (
                  <span className="pulse-pick text-sm text-[color:var(--copero-muted)]">{gameT('timeline.careerDecision')}</span>
                ) : (
                  <span className="text-sm text-white/15">—</span>
                )}
                {aggregated && (
                  <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1">
                    {competition && (
                      <span
                        className="inline-flex max-w-full items-center gap-1 rounded-md border border-[color:var(--copero-border)] bg-[color:color-mix(in_oklch,var(--copero-bg)_54%,transparent)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[color:var(--copero-muted)]"
                        title={competition.name}
                      >
                        {competition.logo_url && <img src={competition.logo_url} alt="" className="h-3 w-3 shrink-0 object-contain" />}
                        <span className="truncate">
                          {displayTier === 1
                            ? gameT('timeline.tier1')
                            : displayTier != null && displayTier >= 2
                              ? gameT('timeline.tier2')
                              : competition.name.length > 14
                                ? `${competition.name.slice(0, 12)}…`
                                : competition.name}
                        </span>
                      </span>
                    )}
                    {hadLoan && <TimelineTag tone="info">{gameT('timeline.loan')}</TimelineTag>}
                    {hadPromotion && <TimelineTag tone="success">{gameT('timeline.promotion')}</TimelineTag>}
                    {hadRelegation && <TimelineTag tone="danger">{gameT('timeline.relegation')}</TimelineTag>}
                    {hadInjury && <TimelineTag tone="warning">{gameT('timeline.injury')}</TimelineTag>}
                    {hadSuspension && <TimelineTag tone="warning">{gameT('timeline.suspended')}</TimelineTag>}
                  </div>
                )}
              </div>
              <div>
                {aggregated ? (
                  <OvrBadge overall={aggregated.overall} size="sm" />
                ) : isCurrent && state.player ? (
                  <OvrBadge overall={state.player.overall} size="sm" />
                ) : null}
              </div>
              <div className="min-w-0">
                {aggregated ? (
                  <StatIcons
                    appearances={aggregated.appearances}
                    goals={aggregated.goals}
                    assists={aggregated.assists}
                    animate={false}
                    compact
                  />
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex flex-col gap-2 border-t border-[color:var(--copero-border)] bg-[color:color-mix(in_oklch,var(--copero-accent)_6%,transparent)] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            {country && <img src={flagUrl(country.iso_alpha2)} alt="" className="h-5 w-7 rounded-sm" />}
            {country?.logo_url && <img src={country.logo_url} alt="" className="h-6 w-6 object-contain" />}
            <div>
              <div className="font-[family-name:var(--copero-font-mono)] text-[10px] font-bold uppercase tracking-wide text-[color:var(--copero-accent)]">{gameT('national.title')}</div>
              <span className="font-semibold text-[color:var(--copero-fg)]">{countryDisplayName(locale, country) || gameT('national.title')}</span>
            </div>
            {(state.nationalTrophies ?? []).length > 0 && (
              <div className="ml-1 flex items-center gap-1">
                {aggregateTrophies(state.nationalTrophies ?? []).map((trophy) => (
                  <TrophyIcon
                    key={trophy.id}
                    src={trophy.assetPath}
                    name={`${trophy.name}${trophy.count > 1 ? ` ×${trophy.count}` : ''}`}
                    className="h-5 w-5"
                    count={trophy.count}
                  />
                ))}
              </div>
            )}
          </div>
          <StatIcons appearances={national.appearances} goals={national.goals} assists={national.assists} />
        </div>
        {(() => {
          const periods = state.nationalTeamPeriods ?? []
          const last = periods[periods.length - 1]
          if (!last) return <div className="text-[11px] font-medium text-[color:var(--copero-muted)]">{gameT('national.none')}</div>
          return (
            <div className="text-[11px] font-medium text-[color:var(--copero-muted)]">
              {gameT('national.last', {
                age: last.age,
                apps: last.stats.appearances,
                goals: last.stats.goals,
                assists: last.stats.assists,
              })}
            </div>
          )
        })()}
      </div>
    </div>
  )
}

function TimelineTag({
  children,
  tone,
}: {
  children: React.ReactNode
  tone: 'info' | 'success' | 'danger' | 'warning'
}) {
  const cls =
    tone === 'success'
      ? 'border-[color:color-mix(in_oklch,var(--copero-accent)_28%,transparent)] bg-[color:color-mix(in_oklch,var(--copero-accent)_10%,transparent)] text-[color:var(--copero-accent)]'
      : tone === 'danger'
        ? 'border-rose-400/30 bg-rose-500/15 text-rose-200'
        : tone === 'warning'
          ? 'border-[color:color-mix(in_oklch,var(--copero-gold)_28%,transparent)] bg-[color:color-mix(in_oklch,var(--copero-gold)_9%,transparent)] text-[color:var(--copero-gold)]'
          : 'border-sky-400/25 bg-sky-500/10 text-sky-200'
  return (
    <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${cls}`}>
      {children}
    </span>
  )
}
