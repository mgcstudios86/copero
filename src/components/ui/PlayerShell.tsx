import type { ReactNode } from 'react'
import { getCountry, getTeam } from '../../data/catalog'
import { flagUrl } from '../../data/flags'
import { aggregateTrophies, collectCareerTrophies } from '../../data/trophies'
import { stageLabel } from '../../engine/careerPath'
import { traitMeta } from '../../engine/objectives'
import type { GameState } from '../../engine/types'
import { useI18n } from '../../i18n/config'
import {
  countryDisplayName,
  formatMoneyForLocale,
  objectiveLabel,
  type GameTranslate,
} from '../../i18n/game'
import { AnimatedNumber } from './AnimatedNumber'
import { CareerTimeline } from './CareerTimeline'
import { OvrBadge } from './OvrBadge'
import { GameBadge, Metric, StatusPanel, Surface } from './Primitives'
import { StatIcons } from './StatIcons'
import { TrophyIcon } from './TrophyIcon'

export function PlayerShell({
  state,
  choosingClub,
  decidingCareer,
  leftExtra,
}: {
  state: GameState
  choosingClub?: boolean
  decidingCareer?: boolean
  leftExtra?: ReactNode
}) {
  const { locale, t } = useI18n()
  const gameT: GameTranslate = (key, params) => t('game', key, params)
  const player = state.player
  if (!player) return null
  const team = state.currentTeamId ? getTeam(state.currentTeamId) : undefined
  const country = getCountry(player.nationalityFifa)
  const trophies = aggregateTrophies(collectCareerTrophies(state.seasons))
  const currentObjective = state.seasonObjective
  const currentObjectiveLabel = objectiveLabel(gameT, currentObjective)

  return (
    <section className="game-grid-shell grid gap-4 lg:grid-cols-[minmax(300px,0.94fr)_minmax(0,1.56fr)]">
      <div className="game-panel-stack">
        <Surface tone="strong" className="overflow-hidden p-4 sm:p-5">
          <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-[color:color-mix(in_oklch,var(--copero-accent)_8%,transparent)] blur-3xl" />
          <div className="relative flex gap-4">
            <OvrBadge overall={player.overall} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {country && <img src={flagUrl(country.iso_alpha2)} alt="" className="h-4 w-6 rounded-sm" />}
                <GameBadge tone="accent" mono>#{player.preferredNumber} {gameT(`position.${player.position}`)}</GameBadge>
                <GameBadge tone="neutral">
                  {team?.logo_url ? <img src={team.logo_url} alt="" className="h-4 w-4 object-contain" /> : null}
                  {team?.name ?? gameT('offer.freeAgent')}
                </GameBadge>
              </div>
              <div className="mt-2 font-[family-name:var(--copero-font-mono)] text-[11px] text-[color:var(--copero-muted)]">
                {countryDisplayName(locale, country)} · {gameT(stageLabel(state.careerStage ?? 'local'))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Metric label={gameT('hud.age')} value={<AnimatedNumber value={player.age} />} />
                <Metric
                  label={gameT('hud.value')}
                  value={
                    <AnimatedNumber
                      value={player.marketValue}
                      format={(value) => formatMoneyForLocale(locale, Math.round(value))}
                    />
                  }
                  tone="accent"
                />
              </div>
            </div>
          </div>

          {currentObjective &&
            !currentObjective.completed &&
            !currentObjective.failed &&
            state.currentEvent?.type !== 'national_callup' && (
              <StatusPanel tone="info" className="mt-4">
                <div className="game-eyebrow text-sky-200">{gameT('hud.objective')}</div>
                <div className="mt-1 text-sm font-semibold text-[color:var(--copero-fg)]">
                  {gameT('objective.pending', { label: currentObjectiveLabel })}
                  {currentObjective.target > 1 && (
                    <span className="text-[color:var(--copero-muted)]"> · {currentObjective.progress}/{currentObjective.target}</span>
                  )}
                </div>
              </StatusPanel>
            )}

          {(state.traits?.length ?? 0) > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {state.traits.map((trait) => {
                const meta = traitMeta(trait)
                return (
                  <GameBadge key={trait} tone="info">
                    {meta ? gameT(meta.labelKey) : trait}
                  </GameBadge>
                )
              })}
            </div>
          )}

          <div className="mt-4 rounded-[var(--copero-radius)] border border-[color:var(--copero-border)] bg-[color:color-mix(in_oklch,var(--copero-bg)_60%,transparent)] p-3">
            <StatIcons
              appearances={state.totals.appearances}
              goals={state.totals.goals}
              assists={state.totals.assists}
            />
          </div>

          <NationalSummary state={state} />

          <div className="mt-4 border-t border-[color:var(--copero-border)] pt-4">
            {trophies.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-[color:var(--copero-muted)]">
                <span aria-hidden>🏆</span>
                <span>{gameT('timeline.emptyTrophies')}</span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                {trophies.map((trophy) => (
                  <TrophyIcon
                    key={`${trophy.id}-${trophy.assetPath}`}
                    src={trophy.assetPath}
                    name={trophy.name}
                    count={trophy.count}
                    className="h-9 w-9"
                  />
                ))}
              </div>
            )}
          </div>

          {state.modifiers.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {state.modifiers.map((modifier) => (
                <GameBadge key={modifier} tone="neutral">
                  {gameT(`mod.${modifier}`)}
                </GameBadge>
              ))}
            </div>
          )}
        </Surface>
        {leftExtra}
      </div>
      <CareerTimeline state={state} choosingClub={choosingClub} decidingCareer={decidingCareer} />
    </section>
  )
}

function NationalSummary({ state }: { state: GameState }) {
  const { locale, t } = useI18n()
  const gameT: GameTranslate = (key, params) => t('game', key, params)
  const player = state.player
  if (!player) return null
  const country = getCountry(player.nationalityFifa)
  const national = state.nationalTotals
  const periods = state.nationalTeamPeriods ?? []
  const last = periods[periods.length - 1]
  const hasCaps = (national?.appearances ?? 0) > 0 || periods.length > 0
  const recentCallup = Boolean(last && Math.abs(player.age - last.age) <= 1)

  return (
    <StatusPanel tone={hasCaps || recentCallup ? 'info' : 'neutral'} className="mt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {country && <img src={flagUrl(country.iso_alpha2)} alt="" className="h-4 w-6 rounded-sm" />}
          <span className="text-[10px] font-bold uppercase tracking-wide text-sky-100">
            {gameT('national.title')} · {countryDisplayName(locale, country)}
          </span>
          {recentCallup && <GameBadge tone="info">{gameT('national.called')}</GameBadge>}
        </div>
        {hasCaps && (
          <StatIcons
            appearances={national.appearances}
            goals={national.goals}
            assists={national.assists}
          />
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-[color:var(--copero-muted)]">
        {last
          ? gameT('national.last', {
              age: last.age,
              apps: last.stats.appearances,
              goals: last.stats.goals,
              assists: last.stats.assists,
            })
          : gameT('national.none')}
      </p>
    </StatusPanel>
  )
}
