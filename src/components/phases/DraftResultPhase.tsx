import { getCountry } from '../../data/catalog'
import { ATTRIBUTE_LABELS, ATTRIBUTE_ORDER } from '../../engine/draft'
import type { AttributeKey, GameState } from '../../engine/types'
import { useI18n } from '../../i18n/config'
import { countryDisplayName, type GameTranslate } from '../../i18n/game'
import { GameBadge, GameButton, Metric, SectionEyebrow, SectionTitle, Surface } from '../ui/Primitives'

function valueText(key: AttributeKey, value: number): string {
  if (key === 'skillMoves' || key === 'weakFoot') return `${value}★`
  return String(value)
}

export function DraftResultPhase({
  state,
  onContinue,
}: {
  state: GameState
  onContinue: () => void
}) {
  const { locale, t } = useI18n()
  const gameT: GameTranslate = (key, params) => t('game', key, params)
  const player = state.player
  if (!player) return null
  const country = getCountry(player.nationalityFifa)
  const playerName = player.lastName || gameT('common.playerFallback')

  return (
    <section className="game-grid-shell grid min-h-[calc(100vh-58px)] items-center gap-7 lg:grid-cols-[.88fr_1.12fr]">
      <div>
        <SectionEyebrow>{gameT('draftResult.eyebrow')}</SectionEyebrow>
        <SectionTitle as="h1" className="mt-3 max-w-xl">{gameT('draftResult.title')}</SectionTitle>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-[color:var(--copero-muted)]">
          {gameT('draftResult.body')}
        </p>
        <div className="mt-6 grid max-w-xl grid-cols-2 gap-3">
          <Metric label={gameT('draftResult.startOvr')} value={player.overall} />
          <Metric label={gameT('draftResult.potential')} value={player.potential} tone="accent" />
        </div>
        <GameButton type="button" size="lg" className="mt-7" onClick={onContinue}>
          {gameT('draftResult.continue')}
        </GameButton>
      </div>

      <Surface tone="gold" className="relative overflow-hidden p-1 game-gold-glow">
        <div className="rounded-[calc(var(--copero-radius-lg)-3px)] bg-[color:color-mix(in_oklch,var(--copero-bg)_88%,black)] p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <GameBadge tone="gold" mono>{gameT('draftResult.eyebrow')}</GameBadge>
              <div className="mt-4 font-[family-name:var(--copero-font-display)] text-6xl font-black leading-none text-[color:var(--copero-gold)]">
                {player.potential}
              </div>
              <div className="mt-1 font-[family-name:var(--copero-font-mono)] text-xl font-black text-[color:var(--copero-fg)]">
                {gameT(`position.${player.position}`)}
              </div>
              <div className="mt-3 font-[family-name:var(--copero-font-mono)] text-xs font-bold uppercase tracking-widest text-[color:var(--copero-muted)]">
                {countryDisplayName(locale, country) || player.nationalityFifa}
              </div>
            </div>
            <div className="text-right">
              <div className="font-[family-name:var(--copero-font-display)] text-3xl font-black uppercase text-[color:var(--copero-fg)]">
                {playerName}
              </div>
              <div className="mt-1 font-[family-name:var(--copero-font-mono)] text-sm text-[color:var(--copero-muted)]">
                #{player.preferredNumber} · {gameT(player.preferredFoot === 'left' ? 'foot.left' : 'foot.right')}
              </div>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ATTRIBUTE_ORDER.map((key) => (
              <Metric
                key={key}
                label={ATTRIBUTE_LABELS[key].short}
                value={valueText(key, player.attributes[key])}
              />
            ))}
          </div>

          <div className="mt-7 border-t border-[color:var(--copero-border)] pt-5">
            <SectionEyebrow className="text-[color:var(--copero-gold)]">{gameT('draftResult.builtWith')}</SectionEyebrow>
            <div className="mt-3 flex flex-wrap gap-2">
              {player.draftPicks.map((pick) => (
                <GameBadge key={`${pick.legendId}-${pick.attribute}`} tone="neutral" mono>
                  {ATTRIBUTE_LABELS[pick.attribute].short} · {pick.legendName}
                </GameBadge>
              ))}
            </div>
          </div>
        </div>
      </Surface>
    </section>
  )
}
