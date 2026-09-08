import { useEffect } from 'react'
import { legendById } from '../../data/legends'
import { ATTRIBUTE_LABELS, ATTRIBUTE_ORDER, recommendedAttribute } from '../../engine/draft'
import type { AttributeKey, GameState } from '../../engine/types'
import { useI18n } from '../../i18n/config'
import type { GameTranslate } from '../../i18n/game'
import { EmptyState, GameBadge, GameButton, Metric, SectionEyebrow, SectionTitle, StatusPanel, Surface } from '../ui/Primitives'

function valueText(key: AttributeKey, value: number): string {
  if (key === 'skillMoves' || key === 'weakFoot') return `${value}★`
  return String(value)
}

export function DraftPhase({
  state,
  onEnsureLegend,
  onTake,
  onSkip,
  onBack,
}: {
  state: GameState
  onEnsureLegend: () => void
  onTake: () => void
  onSkip: () => void
  onBack: () => void
}) {
  const { t } = useI18n()
  const gameT: GameTranslate = (key, params) => t('game', key, params)

  useEffect(() => {
    if (!state.draft.currentLegendId) onEnsureLegend()
  }, [state.draft.currentLegendId, onEnsureLegend])

  const legend = state.draft.currentLegendId ? legendById(state.draft.currentLegendId) : undefined
  const recommended = recommendedAttribute(state)
  const selected = new Set(state.draft.picks.map((pick) => pick.attribute))
  const isPurist = state.draftMode === 'purist'
  const playerName = state.player?.lastName || gameT('common.playerFallback')

  return (
    <section className="game-grid-shell min-h-screen">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <SectionEyebrow>{gameT('draft.eyebrow')}</SectionEyebrow>
          <SectionTitle as="h1" className="mt-2">
            {gameT('draft.round', {
              round: state.draft.picks.length + 1,
              total: ATTRIBUTE_ORDER.length,
            })}
          </SectionTitle>
          <p className="mt-3 text-sm leading-relaxed text-[color:var(--copero-muted)]">{gameT('draft.body')}</p>
        </div>
        <GameBadge tone={isPurist ? 'gold' : 'accent'} mono>
          {isPurist
            ? gameT('draft.puristBadge')
            : gameT('draft.classicBadge', { count: state.draft.skipsRemaining })}
        </GameBadge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.08fr_.92fr]">
        <Surface tone="gold" className="relative overflow-hidden p-6 sm:p-7 game-gold-glow">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[color:color-mix(in_oklch,var(--copero-gold)_12%,transparent)] blur-3xl" />
          {legend ? (
            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <GameBadge tone="neutral" mono>{legend.country} · {legend.era}</GameBadge>
                  <SectionTitle as="h2" className="mt-3">{legend.name}</SectionTitle>
                  <p className="mt-2 font-[family-name:var(--copero-font-mono)] text-xs text-[color:var(--copero-muted)]">
                    {legend.positions.join(' · ')}
                  </p>
                </div>
                <div className="game-icon-tile h-24 w-24 rounded-[22px] border-[color:color-mix(in_oklch,var(--copero-gold)_26%,var(--copero-border))] font-[family-name:var(--copero-font-display)] text-4xl font-black text-[color:var(--copero-gold)]">
                  {legend.name
                    .split(' ')
                    .map((part) => part[0])
                    .join('')
                    .slice(0, 2)}
                </div>
              </div>

              <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ATTRIBUTE_ORDER.map((key) => {
                  const locked = selected.has(key)
                  const highlighted = recommended === key
                  return (
                    <Metric
                      key={key}
                      label={ATTRIBUTE_LABELS[key].short}
                      value={locked ? '—' : isPurist ? '??' : valueText(key, legend.attributes[key])}
                      tone={highlighted && !isPurist ? 'accent' : 'default'}
                      className={locked ? 'opacity-35' : ''}
                    />
                  )
                })}
              </div>

              <StatusPanel tone={isPurist ? 'warning' : 'success'} className="mt-6">
                {isPurist ? (
                  <>
                    <div className="font-extrabold text-[color:var(--copero-fg)]">{gameT('draft.puristTitle')}</div>
                    <p className="mt-1 text-xs leading-relaxed">{gameT('draft.puristBody')}</p>
                  </>
                ) : recommended ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="game-eyebrow">{gameT('draft.best')}</div>
                      <div className="mt-1 font-[family-name:var(--copero-font-display)] text-2xl font-black text-[color:var(--copero-fg)]">
                        {ATTRIBUTE_LABELS[recommended].short} · {valueText(recommended, legend.attributes[recommended])}
                      </div>
                    </div>
                    <GameBadge tone="accent" mono>{ATTRIBUTE_LABELS[recommended].short}</GameBadge>
                  </div>
                ) : null}
              </StatusPanel>

              <div className="mt-5 flex flex-wrap gap-3">
                <GameButton type="button" size="lg" onClick={onTake} disabled={!recommended}>
                  {gameT('draft.confirm')}
                </GameButton>
                {!isPurist && (
                  <GameButton
                    type="button"
                    size="lg"
                    variant="secondary"
                    onClick={onSkip}
                    disabled={state.draft.skipsRemaining <= 0}
                  >
                    {gameT('draft.swap', { count: state.draft.skipsRemaining })}
                  </GameButton>
                )}
              </div>
            </div>
          ) : (
            <EmptyState className="grid min-h-[420px] place-items-center border-0 bg-transparent">
              {gameT('draft.loading')}
            </EmptyState>
          )}
        </Surface>

        <Surface tone="strong" className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <SectionEyebrow>{gameT('draft.player')}</SectionEyebrow>
              <h3 className="mt-2 font-[family-name:var(--copero-font-display)] text-xl font-black uppercase text-[color:var(--copero-fg)]">
                {playerName}
              </h3>
            </div>
            {state.player && <GameBadge mono>{gameT(`position.${state.player.position}`)}</GameBadge>}
          </div>

          <div className="mt-5 space-y-2">
            {ATTRIBUTE_ORDER.map((key) => {
              const pick = state.draft.picks.find((item) => item.attribute === key)
              return (
                <div
                  key={key}
                  className="flex items-center gap-3 rounded-[var(--copero-radius)] border border-[color:var(--copero-border)] bg-[color:color-mix(in_oklch,var(--copero-bg)_58%,transparent)] px-4 py-3"
                >
                  <GameBadge mono className="w-12 justify-center">{ATTRIBUTE_LABELS[key].short}</GameBadge>
                  <div className="flex-1 truncate text-sm font-semibold text-[color:var(--copero-muted)]">
                    {pick ? pick.legendName : gameT('draft.unpicked')}
                  </div>
                  <div className="font-[family-name:var(--copero-font-display)] text-lg font-black text-[color:var(--copero-fg)]">
                    {pick ? valueText(key, pick.value) : '—'}
                  </div>
                </div>
              )
            })}
          </div>
          <GameButton type="button" variant="ghost" size="sm" className="mt-5" onClick={onBack}>
            {gameT('draft.back')}
          </GameButton>
        </Surface>
      </div>
    </section>
  )
}
