import { getTeam } from '../../data/catalog'
import { roleLabel } from '../../engine/contract'
import type { SeasonRecord } from '../../engine/types'
import { useI18n } from '../../i18n/config'
import { formatMoneyForLocale, type GameTranslate } from '../../i18n/game'
import { OvrBadge } from './OvrBadge'
import { GameBadge, GameButton, Metric, StatusPanel, Surface } from './Primitives'
import { StatIcons } from './StatIcons'
import { TrophyIcon } from './TrophyIcon'

function seasonForm(season: SeasonRecord): { key: string; tone: 'danger' | 'success' | 'info' | 'gold' } {
  const apps = Math.max(1, season.stats.appearances)
  const contrib = (season.stats.goals + season.stats.assists) / apps
  if (season.injured || season.suspended) return { key: 'season.form.bad', tone: 'danger' }
  if (season.role === 'bench' && apps < 15) return { key: 'season.form.bad', tone: 'danger' }
  if (contrib >= 0.45 || (season.role === 'undisputed' && apps >= 28)) {
    return { key: 'season.form.excellent', tone: 'success' }
  }
  if (contrib >= 0.22 || season.role === 'starter') return { key: 'season.form.good', tone: 'info' }
  if (contrib >= 0.1) return { key: 'season.form.regular', tone: 'gold' }
  return { key: 'season.form.bad', tone: 'danger' }
}

export function SeasonResultCard({
  title,
  season,
  playerAge,
  onContinue,
  objectiveLabel,
  objectiveCompleted,
  objectiveFailed,
  stageLabelText,
}: {
  title: string
  season: SeasonRecord
  playerAge: number
  onContinue: () => void
  objectiveLabel?: string
  objectiveCompleted?: boolean
  objectiveFailed?: boolean
  stageLabelText?: string
}) {
  const { locale, t } = useI18n()
  const gameT: GameTranslate = (key, params) => t('game', key, params)
  const team = getTeam(season.teamId)
  const parentTeam = season.loan ? getTeam(season.loanParentTeamId ?? '') : undefined
  const form = seasonForm(season)

  return (
    <Surface tone={season.trophies.length > 0 ? 'gold' : 'strong'} className="space-y-4 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {parentTeam && (
            <>
              <span className="game-icon-tile h-12 w-12 bg-white p-1.5">
                {parentTeam.logo_url ? (
                  <img src={parentTeam.logo_url} alt="" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-black/40">?</span>
                )}
              </span>
              <span className="text-[color:var(--copero-muted)]">→</span>
            </>
          )}
          {team?.logo_url ? (
            <span className="game-icon-tile h-14 w-14 bg-white p-1.5">
              <img src={team.logo_url} alt="" className="h-full w-full object-contain" />
            </span>
          ) : (
            <span className="game-icon-tile h-14 w-14">?</span>
          )}
          <div className="min-w-0">
            <h3 className="font-[family-name:var(--copero-font-display)] text-lg font-black uppercase text-[color:var(--copero-fg)]">
              {title}
            </h3>
            <p className="truncate text-sm text-[color:var(--copero-muted)]">{team?.name ?? season.teamId}</p>
            {season.loan && parentTeam && (
              <p className="mt-0.5 text-[11px] text-sky-200/80">
                {gameT('season.loanedBy', { team: parentTeam.name })}
              </p>
            )}
            {season.loan && !parentTeam && (
              <p className="mt-0.5 text-[11px] text-sky-200/80">{gameT('season.onLoan')}</p>
            )}
            {stageLabelText && <GameBadge mono className="mt-2">{stageLabelText}</GameBadge>}
          </div>
        </div>
        <OvrBadge overall={season.overall} size="md" />
      </div>

      {objectiveLabel && (
        <StatusPanel tone={objectiveCompleted ? 'success' : objectiveFailed ? 'danger' : 'neutral'}>
          <span className="game-eyebrow">{gameT('season.objective')}</span>
          <div className="mt-1 text-sm font-semibold text-[color:var(--copero-fg)]">
            {objectiveCompleted ? '✓ ' : objectiveFailed ? '✗ ' : ''}
            {objectiveLabel}
          </div>
        </StatusPanel>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label={gameT('season.age')} value={playerAge} />
        <Metric label={gameT('hud.value')} value={formatMoneyForLocale(locale, season.marketValue)} tone="accent" />
        <Metric label={gameT('season.salary')} value={formatMoneyForLocale(locale, season.wage)} />
        <Metric label={gameT('season.form')} value={<GameBadge tone={form.tone}>{gameT(form.key)}</GameBadge>} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <GameBadge>{gameT(roleLabel(season.role))}</GameBadge>
        {season.loan && <GameBadge tone="info">{gameT('season.loan')}</GameBadge>}
        {season.injured && <GameBadge tone="danger">{gameT('season.injured')}</GameBadge>}
        {season.suspended && <GameBadge tone="gold">{gameT('season.suspended')}</GameBadge>}
        {season.struggle === 'promoted' && <GameBadge tone="success">{gameT('season.promotion')}</GameBadge>}
        {season.struggle === 'relegated' && <GameBadge tone="danger">{gameT('season.relegation')}</GameBadge>}
        {season.struggle === 'relegation_battle' && <GameBadge tone="gold">{gameT('season.relegationBattle')}</GameBadge>}
      </div>

      <div className="rounded-[var(--copero-radius)] border border-[color:var(--copero-border)] bg-[color:color-mix(in_oklch,var(--copero-bg)_60%,transparent)] p-3">
        <StatIcons
          appearances={season.stats.appearances}
          goals={season.stats.goals}
          assists={season.stats.assists}
        />
      </div>

      {season.trophies.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-[color:var(--copero-border)] pt-3">
          {season.trophies.map((trophy, index) => (
            <TrophyIcon
              key={`${trophy.id}-${index}`}
              src={trophy.assetPath}
              name={trophy.name}
              className="h-12 w-12"
            />
          ))}
        </div>
      )}

      <GameButton type="button" onClick={onContinue}>
        {gameT('season.continue')}
      </GameButton>
    </Surface>
  )
}
