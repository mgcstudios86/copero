import { useRef, useState } from 'react'
import type { EventOutcomePill } from '../../data/eventAssets'
import { eventChoiceVisual } from '../../data/eventAssets'
import { useI18n } from '../../i18n/config'
import type { GameTranslate } from '../../i18n/game'
import { GameBadge, GameButton, SectionTitle, Surface } from './Primitives'

export type ChoiceSpinResult = {
  choiceId: string
  winningIndex: number
  outcomes: EventOutcomePill[]
  imageSrc?: string
}

type Props = {
  eventId: string
  title: string
  body: string
  choices: { id: string; label: string }[]
  impact?: string
  onPreview: (choiceId: string) => ChoiceSpinResult
  onCommit: (choiceId: string) => void
}

function buildDecelDelays(totalMs: number, tickCount: number): number[] {
  const weights: number[] = []
  for (let i = 0; i < tickCount; i += 1) {
    weights.push(0.35 + (i / Math.max(1, tickCount - 1)) ** 1.6 * 1.8)
  }
  const sum = weights.reduce((a, b) => a + b, 0)
  return weights.map((weight) => (weight / sum) * totalMs)
}

function translateOutcome(gameT: GameTranslate, label: string): string {
  return label.startsWith('outcome.') || label.startsWith('actions.') ? gameT(label) : label
}

export function EventChoiceCards({
  eventId,
  title,
  body,
  choices,
  impact,
  onPreview,
  onCommit,
}: Props) {
  const { t } = useI18n()
  const gameT: GameTranslate = (key, params) => t('game', key, params)
  const [spinning, setSpinning] = useState(false)
  const [highlightPill, setHighlightPill] = useState<number | null>(null)
  const [result, setResult] = useState<{
    choiceId: string
    label: string
    tone: EventOutcomePill['tone']
    winningIndex: number
    outcomes: EventOutcomePill[]
  } | null>(null)
  const [activeChoice, setActiveChoice] = useState<string | null>(null)
  const [exiting, setExiting] = useState(false)
  const committed = useRef(false)
  const timers = useRef<number[]>([])

  const clearTimers = () => {
    for (const id of timers.current) window.clearTimeout(id)
    timers.current = []
  }

  const startSpin = (choiceId: string) => {
    if (spinning || result) return
    const visual = eventChoiceVisual(eventId, choiceId)
    const preview = onPreview(choiceId)
    const outcomes = preview.outcomes.length
      ? preview.outcomes
      : visual?.outcomes ?? [{ tone: 'neutral' as const, label: 'actions.continue' }]
    const rouletteIdx = outcomes
      .map((outcome, index) =>
        outcome.tone === 'positive' || outcome.tone === 'negative' ? index : -1,
      )
      .filter((index) => index >= 0)
    const hasRoulette = rouletteIdx.length >= 2

    setActiveChoice(choiceId)
    committed.current = false
    clearTimers()

    if (!hasRoulette) {
      const win = outcomes[preview.winningIndex] ?? outcomes[0]
      setResult({
        choiceId,
        label: win.label,
        tone: win.tone,
        winningIndex: preview.winningIndex,
        outcomes,
      })
      return
    }

    setSpinning(true)
    setHighlightPill(null)
    const duration = 2800 + Math.random() * 800
    const tickCount = 14 + Math.floor(Math.random() * 7)
    const delays = buildDecelDelays(duration, tickCount)
    let elapsed = 0
    let tickIdx = 0

    for (let i = 0; i < tickCount; i += 1) {
      elapsed += delays[i]!
      const delay = elapsed
      const index = i
      const timerId = window.setTimeout(() => {
        setHighlightPill(rouletteIdx[tickIdx % rouletteIdx.length]!)
        tickIdx += 1
        if (index === tickCount - 1) {
          const landId = window.setTimeout(() => {
            setSpinning(false)
            setHighlightPill(null)
            const win = outcomes[preview.winningIndex] ?? outcomes[0]
            setResult({
              choiceId,
              label: win.label,
              tone: win.tone,
              winningIndex: preview.winningIndex,
              outcomes,
            })
          }, 280)
          timers.current.push(landId)
        }
      }, delay)
      timers.current.push(timerId)
    }
  }

  const finish = () => {
    if (!result || committed.current || exiting) return
    committed.current = true
    setExiting(true)
    const id = result.choiceId
    window.setTimeout(() => {
      setResult(null)
      setActiveChoice(null)
      setExiting(false)
      onCommit(id)
    }, 220)
  }

  return (
    <Surface tone={impact === 'ruin' ? 'danger' : 'strong'} className={`space-y-4 p-4 sm:p-5 transition-opacity duration-300 ${exiting ? 'opacity-40' : 'opacity-100'}`}>
      <div>
        <SectionTitle as="h3">{title}</SectionTitle>
        <p className="mt-2 text-sm leading-relaxed text-[color:var(--copero-muted)]">{body}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {choices.map((choice) => {
          const visual = eventChoiceVisual(eventId, choice.id)
          if (!visual) {
            return (
              <GameButton
                key={choice.id}
                type="button"
                size="lg"
                variant={impact === 'ruin' && (choice.id === 'consume' || choice.id === 'retire_medical') ? 'danger' : 'primary'}
                disabled={spinning || Boolean(result)}
                onClick={() => startSpin(choice.id)}
              >
                {choice.label}
              </GameButton>
            )
          }

          const showOutcomes = visual.outcomes
          const isActiveCard = activeChoice === choice.id

          return (
            <button
              key={choice.id}
              type="button"
              disabled={spinning || Boolean(result)}
              onClick={() => startSpin(choice.id)}
              className={`game-card-action group relative overflow-hidden rounded-[var(--copero-radius-lg)] border bg-[color:color-mix(in_oklch,var(--copero-surface)_92%,black)] text-left shadow-[var(--copero-shadow)] ${
                result?.choiceId === choice.id
                  ? 'border-[color:var(--copero-accent)] ring-1 ring-[color:color-mix(in_oklch,var(--copero-accent)_32%,transparent)]'
                  : spinning && isActiveCard
                    ? 'border-[color:var(--copero-gold)] ring-1 ring-[color:color-mix(in_oklch,var(--copero-gold)_28%,transparent)]'
                    : 'border-[color:var(--copero-border)]'
              }`}
            >
              <div className="aspect-[16/10] w-full overflow-hidden bg-black/40">
                <img
                  src={visual.imageSrc}
                  alt=""
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]"
                />
              </div>
              <div className="space-y-3 p-4">
                <div className="font-[family-name:var(--copero-font-display)] text-sm font-black uppercase text-[color:var(--copero-fg)]">
                  {choice.label}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {showOutcomes.map((outcome, index) => {
                    const isWinner = result?.choiceId === choice.id && result.winningIndex === index
                    const isLoser =
                      result?.choiceId === choice.id &&
                      result.winningIndex !== index &&
                      showOutcomes.length > 1
                    const isSpinHighlight = spinning && isActiveCard && highlightPill === index
                    const tone = outcome.tone === 'positive' ? 'success' : outcome.tone === 'negative' ? 'danger' : 'neutral'
                    return (
                      <GameBadge
                        key={index}
                        tone={tone}
                        mono
                        className={`${
                          isLoser
                            ? 'scale-95 opacity-35 line-through'
                            : isWinner
                              ? 'outcome-overlay scale-110 shadow-lg'
                              : isSpinHighlight
                                ? 'roulette-spin scale-110'
                                : ''
                        }`}
                      >
                        {translateOutcome(gameT, outcome.label)}
                        {outcome.chance != null ? ` · ${outcome.chance}%` : ''}
                      </GameBadge>
                    )
                  })}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {result && (
        <div className="outcome-overlay flex flex-col items-center gap-3 border-t border-[color:var(--copero-border)] pt-4">
          <GameBadge tone={result.tone === 'positive' ? 'success' : result.tone === 'negative' ? 'danger' : 'neutral'}>
            {translateOutcome(gameT, result.label)}
          </GameBadge>
          <GameButton type="button" onClick={finish}>
            {gameT('actions.continue')}
          </GameButton>
        </div>
      )}
    </Surface>
  )
}
