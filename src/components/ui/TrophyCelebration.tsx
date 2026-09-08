import type { TrophyWin } from '../../data/trophies'
import { useI18n } from '../../i18n/config'
import type { GameTranslate } from '../../i18n/game'
import { GameButton, SectionTitle, Surface } from './Primitives'
import { TrophyIcon } from './TrophyIcon'

export function TrophyCelebration({
  message,
  trophies,
  onDismiss,
}: {
  message: string
  trophies: TrophyWin[]
  onDismiss: () => void
}) {
  const { t } = useI18n()
  const gameT: GameTranslate = (key, params) => t('game', key, params)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[color:color-mix(in_oklch,var(--copero-bg)_78%,transparent)] p-4 backdrop-blur-md animate-[trophy-fade-in_0.25s_ease-out]"
      role="dialog"
      aria-modal="true"
      aria-label={message}
    >
      <Surface tone="gold" className="game-gold-glow w-full max-w-md overflow-hidden p-6 text-center">
        <div className="pointer-events-none absolute inset-0 trophy-rays opacity-40" />
        <div className="relative flex flex-wrap items-center justify-center gap-4">
          {trophies.map((trophy) => (
            <TrophyIcon
              key={trophy.id + trophy.name}
              src={trophy.assetPath}
              name={trophy.name}
              className="h-20 w-20 animate-[trophy-float_2s_ease-in-out_infinite]"
            />
          ))}
        </div>
        <div className="relative mt-5">
          <SectionTitle as="h3">{message}</SectionTitle>
          <p className="mt-2 text-sm text-[color:var(--copero-muted)]">{trophies.map((trophy) => trophy.name).join(' · ')}</p>
          <GameButton type="button" variant="gold" className="mt-5" onClick={onDismiss}>
            {gameT('celebration.dismiss')}
          </GameButton>
        </div>
      </Surface>
    </div>
  )
}
