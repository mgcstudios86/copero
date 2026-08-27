import { useState } from 'react'
import type { DraftMode } from '../../engine/types'
import { isDebugActive, setDebugMode } from '../../engine/debug'
import { useI18n } from '../../i18n/config'
import type { GameTranslate } from '../../i18n/game'
import { PITCH_LAYOUT } from '../ui/positions'
import { GameBadge, GameButton, SectionEyebrow, SectionTitle, Surface } from '../ui/Primitives'

const MODES: DraftMode[] = ['classic', 'purist']

export function IntroPhase({
  draftMode,
  hasResume = false,
  onDraftModeChange,
  onStart,
  onResume,
  onNewGame,
}: {
  draftMode: DraftMode
  hasResume?: boolean
  onDraftModeChange: (mode: DraftMode) => void
  onStart: () => void
  onResume?: () => void
  onNewGame?: () => void
}) {
  const { t } = useI18n()
  const [debugOn, setDebugOn] = useState<boolean>(() => isDebugActive())

  const toggleDebug = () => {
    if (isDebugActive()) {
      setDebugMode(null)
      setDebugOn(false)
    } else {
      setDebugMode('1')
      setDebugOn(true)
    }
    if (typeof window !== 'undefined') window.location.reload()
  }
  const gameT: GameTranslate = (key, params) => t('game', key, params)
  const modeDescription = gameT(`intro.mode.${draftMode}.desc`)
  const howSteps = [
    ['1', 'intro.how.identity.title', 'intro.how.identity.body'],
    ['2', 'intro.how.draft.title', 'intro.how.draft.body'],
    ['3', 'intro.how.career.title', 'intro.how.career.body'],
  ] as const
  const faqs = [
    ['intro.faq.free.q', 'intro.faq.free.a'],
    ['intro.faq.mode.q', 'intro.faq.mode.a'],
    ['intro.faq.potential.q', 'intro.faq.potential.a'],
    ['intro.faq.save.q', 'intro.faq.save.a'],
  ] as const

  return (
    <main>
      <section className="game-grid-shell grid min-h-[82vh] items-center gap-10 lg:grid-cols-[1.03fr_.97fr]">
        <Surface tone="gold" className="relative aspect-square overflow-hidden p-0 game-gold-glow">
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 24% 18%, color-mix(in oklch, var(--copero-accent) 16%, transparent) 0%, transparent 36%), radial-gradient(circle at 76% 74%, color-mix(in oklch, var(--copero-gold) 13%, transparent) 0%, transparent 38%)',
            }}
          />
          <div className="absolute inset-8 rounded-[22px] border border-white/15 bg-[color:var(--color-pitch)]/78 shadow-2xl">
            {PITCH_LAYOUT.filter((position) => ['ST', 'CAM', 'LM', 'CM', 'RM'].includes(position.id)).map((slot) => (
              <GameBadge
                key={slot.id}
                tone="neutral"
                mono
                style={{ top: slot.top, left: slot.left }}
                className="absolute -translate-x-1/2 -translate-y-1/2 bg-[color:var(--copero-fg)] text-[color:var(--copero-bg)]"
              >
                {slot.label}
              </GameBadge>
            ))}
            <div className="absolute left-1/2 top-1/2 w-[58%] -translate-x-1/2 -translate-y-1/2 rotate-[-4deg] rounded-[28px] border border-[color:color-mix(in_oklch,var(--copero-gold)_54%,white)] bg-[linear-gradient(145deg,color-mix(in_oklch,var(--copero-gold)_82%,white),color-mix(in_oklch,var(--copero-gold)_44%,#4c3600),#080b13)] p-1 shadow-2xl">
              <div className="rounded-[24px] bg-[color:color-mix(in_oklch,var(--copero-bg)_88%,black)] p-5">
                <div className="font-[family-name:var(--copero-font-display)] text-5xl font-black text-[color:var(--copero-fg)]">97</div>
                <div className="mt-1 font-[family-name:var(--copero-font-mono)] text-xl font-black text-[color:var(--copero-fg)]">ST</div>
                <div className="mt-12 text-center font-[family-name:var(--copero-font-display)] text-2xl font-black uppercase text-white">
                  {gameT('intro.legendCard')}
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 text-center font-[family-name:var(--copero-font-mono)] text-xs font-black text-white/75">
                  <span>95 PAC</span><span>96 SHO</span><span>91 PAS</span>
                  <span>96 DRI</span><span>88 PHY</span><span>5★ WF</span>
                </div>
              </div>
            </div>
          </div>
          <GameBadge tone="gold" className="absolute bottom-5 left-5">
            {gameT('intro.visualLabel')}
          </GameBadge>
        </Surface>

        <div className="space-y-7">
          <SectionEyebrow>{gameT('intro.eyebrow')}</SectionEyebrow>
          <SectionTitle as="h1" className="max-w-xl">{gameT('intro.title')}</SectionTitle>
          <p className="max-w-xl text-base leading-relaxed text-[color:var(--copero-muted)]">{gameT('intro.body')}</p>

          <Surface className="p-4" tone="strong">
            <div className="flex flex-wrap gap-2">
              {MODES.map((mode) => (
                <GameButton
                  key={mode}
                  type="button"
                  size="sm"
                  variant={draftMode === mode ? 'primary' : 'secondary'}
                  onClick={() => onDraftModeChange(mode)}
                >
                  {gameT(`intro.mode.${mode}.title`)}
                </GameButton>
              ))}
            </div>
            <p className="mt-3 max-w-lg text-sm text-[color:var(--copero-muted)]">{modeDescription}</p>
          </Surface>

          <div className="flex flex-wrap gap-3">
            <GameButton type="button" size="lg" onClick={onStart}>
              {gameT('intro.start')}
            </GameButton>
            {hasResume && onResume && (
              <GameButton
                type="button"
                size="lg"
                variant="secondary"
                onClick={onResume}
                data-testid="resume-game"
              >
                Continuar partida
              </GameButton>
            )}
            {hasResume && onNewGame && (
              <GameButton
                type="button"
                size="lg"
                variant="ghost"
                onClick={onNewGame}
                data-testid="new-game"
              >
                Nueva partida
              </GameButton>
            )}
            <GameButton
              type="button"
              size="lg"
              variant="secondary"
              onClick={() => document.getElementById('how-to')?.scrollIntoView({ behavior: 'smooth' })}
            >
              {gameT('intro.howTo')}
            </GameButton>
          </div>
          <p className="max-w-xl text-xs leading-relaxed text-[color:color-mix(in_oklch,var(--copero-muted)_58%,transparent)]">
            {gameT('intro.disclaimer')}
          </p>
        </div>
      </section>

      <section id="how-to" className="game-grid-shell py-16">
        <div className="max-w-3xl">
          <SectionEyebrow>{gameT('intro.how.eyebrow')}</SectionEyebrow>
          <SectionTitle className="mt-3">{gameT('intro.how.title')}</SectionTitle>
          <p className="mt-4 leading-relaxed text-[color:var(--copero-muted)]">{gameT('intro.how.body')}</p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {howSteps.map(([number, titleKey, bodyKey]) => (
            <Surface key={number} interactive className="p-6">
              <div className="font-[family-name:var(--copero-font-display)] text-5xl font-black text-[color:color-mix(in_oklch,var(--copero-accent)_20%,transparent)]">
                {number}
              </div>
              <h3 className="mt-4 font-[family-name:var(--copero-font-display)] text-xl font-black uppercase text-[color:var(--copero-fg)]">
                {gameT(titleKey)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[color:var(--copero-muted)]">{gameT(bodyKey)}</p>
            </Surface>
          ))}
        </div>
      </section>

      <section className="game-grid-shell pb-20 pt-0">
        <Surface tone="strong" className="p-7 sm:p-10">
          <SectionTitle>{gameT('intro.faq.title')}</SectionTitle>
          <div className="mt-7 grid gap-x-8 gap-y-7 md:grid-cols-2">
            {faqs.map(([questionKey, answerKey]) => (
              <div key={questionKey} className="border-t border-[color:var(--copero-border)] pt-4">
                <h3 className="font-bold text-[color:var(--copero-fg)]">{gameT(questionKey)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--copero-muted)]">{gameT(answerKey)}</p>
              </div>
            ))}
          </div>
        </Surface>
      </section>

      <footer className="border-t border-[color:var(--copero-border)] px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 text-xs text-[color:var(--copero-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 copero.top · {gameT('intro.disclaimer')}</p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={toggleDebug}
              className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--copero-muted)] transition hover:text-[color:var(--copero-fg)]"
              aria-pressed={debugOn}
              data-testid="debug-toggle"
              title="Alterna el panel de QA (avanzar temporadas, inyectar stats, forzar retiro)"
            >
              {debugOn ? 'QA · ON' : 'QA · OFF'}
            </button>
            <a href="mailto:support@copero.top" className="font-semibold transition hover:text-[color:var(--copero-fg)]">
              support@copero.top
            </a>
          </div>
        </div>
      </footer>
    </main>
  )
}
