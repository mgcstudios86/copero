import { getCompetition } from '../../data/catalog'
import { roleLabel } from '../../engine/contract'
import { originChoicePreview, originClubChoices } from '../../engine/originStart'
import type { GameState } from '../../engine/types'
import { useI18n } from '../../i18n/config'
import type { GameTranslate } from '../../i18n/game'
import { PlayerShell } from '../ui/PlayerShell'
import { EmptyState, GameBadge, GameButton, Metric, SectionEyebrow, SectionTitle, Surface } from '../ui/Primitives'

export function OriginPhase({
  state,
  onConfirmClub,
  onBack,
}: {
  state: GameState
  onConfirmClub: (teamId: string) => void
  onBack: () => void
}) {
  const { t } = useI18n()
  const gameT: GameTranslate = (key, params) => t('game', key, params)
  const choices = originClubChoices(state)

  const left = (
    <div className="game-panel-stack">
      <Surface tone="strong" className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <SectionEyebrow>{gameT('origin.eyebrow')}</SectionEyebrow>
            <SectionTitle as="h3" className="mt-2">{gameT('origin.title')}</SectionTitle>
            <p className="mt-2 text-sm leading-relaxed text-[color:var(--copero-muted)]">{gameT('origin.body')}</p>
          </div>
          <Metric
            label={gameT('origin.profile')}
            value={`OVR ${state.player?.overall ?? 0} · POT ${state.player?.potential ?? 0}`}
            tone="accent"
          />
        </div>

        {choices.length === 0 ? (
          <EmptyState className="mt-5">{gameT('origin.empty')}</EmptyState>
        ) : (
          <div className="mt-5 grid gap-3">
            {choices.map((team, index) => {
              const preview = originChoicePreview(team)
              const competition = getCompetition(team.competition_id)
              const pathKey =
                index === 0
                  ? 'origin.path.development'
                  : index === 1
                    ? 'origin.path.balance'
                    : 'origin.path.ambition'
              const tone = index === 2 ? 'gold' : index === 0 ? 'accent' : 'default'
              return (
                <Surface key={team.id} tone={tone} interactive className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="game-icon-tile h-14 w-14 bg-white p-2">
                      {team.logo_url ? (
                        <img src={team.logo_url} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <span className="text-lg font-black text-black">{team.name.slice(0, 2)}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <GameBadge tone={index === 2 ? 'gold' : index === 0 ? 'accent' : 'neutral'}>
                          {gameT(pathKey)}
                        </GameBadge>
                        <GameBadge mono>{gameT('origin.reputation', { rep: team.international_reputation })}</GameBadge>
                      </div>
                      <h4 className="mt-3 truncate font-[family-name:var(--copero-font-display)] text-lg font-black uppercase text-[color:var(--copero-fg)]">
                        {team.name}
                      </h4>
                      <p className="mt-1 text-xs text-[color:var(--copero-muted)]">
                        {competition?.name ?? team.country_fifa_code} ·{' '}
                        {gameT('origin.probableRole', { role: gameT(roleLabel(preview.role)) })}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                    <Metric label={gameT('origin.minutes')} value={gameT(preview.minutesKey)} />
                    <Metric label={gameT('origin.growth')} value={gameT(preview.growthKey)} tone="accent" />
                    <Metric label={gameT('origin.trophies')} value={gameT(preview.trophiesKey)} tone="gold" />
                    <Metric label={gameT('origin.risk')} value={gameT(preview.riskKey)} />
                  </div>

                  <GameButton type="button" className="mt-4 w-full" onClick={() => onConfirmClub(team.id)}>
                    {gameT('origin.sign', { team: team.name })}
                  </GameButton>
                </Surface>
              )
            })}
          </div>
        )}
      </Surface>
      <GameButton type="button" variant="ghost" size="sm" onClick={onBack}>
        {gameT('origin.back')}
      </GameButton>
    </div>
  )

  return <PlayerShell state={state} choosingClub leftExtra={left} />
}
