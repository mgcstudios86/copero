import { useCallback, useRef, useState } from 'react'
import { DebugPanel } from './components/debug/DebugPanel'
import { CareerPhase } from './components/phases/CareerPhase'
import { DraftPhase } from './components/phases/DraftPhase'
import { DraftResultPhase } from './components/phases/DraftResultPhase'
import { IdentityPhase } from './components/phases/IdentityPhase'
import { IntroPhase } from './components/phases/IntroPhase'
import { OriginPhase } from './components/phases/OriginPhase'
import { SummaryPhase } from './components/phases/SummaryPhase'
import type { ChoiceSpinResult } from './components/ui/EventChoiceCards'
import {
  acceptRecommendedDraftAttribute,
  continueFromDraftResult,
  createDraftState,
  initializeDraft,
  rerollDraftLegend,
} from './engine/draft'
import {
  acceptOffer,
  afterSeasonContinue,
  beginCareer,
  callAgentRerollOffers,
  chooseTraits,
  commitCareerChoiceResult,
  confirmIdentity,
  confirmOriginClub,
  dismissCelebration,
  dismissObjectiveBriefing,
  goToSummary,
  openNegotiation,
  previewCareerChoice,
  rejectOffers,
  respondNationalCallup,
  respondYouthLoanChoice,
  submitNegotiation,
} from './engine/game'
import { clearState, createInitialState, loadLatestState, saveState } from './engine/state'
import { LAST_SAVE_KEY } from './engine/eventCooldown'
import type {
  DraftMode,
  GameState,
  Position,
  PreferredFoot,
  TraitId,
} from './engine/types'
import { trackGameEvent } from './lib/analytics'

export default function App() {
  const [state, setState] = useState<GameState>(() => loadLatestState() ?? createInitialState('long'))
  const pendingChoice = useRef<ReturnType<typeof previewCareerChoice> | null>(null)

  const update = useCallback((fn: (s: GameState) => GameState) => {
    setState((prev) => {
      const next = fn(prev)
      saveState(next)
      return next
    })
  }, [])

  let content: React.ReactNode

  if (state.phase === 'intro') {
    const savedSeed =
      typeof window !== 'undefined' ? window.localStorage.getItem(LAST_SAVE_KEY) : null
    const hasResume = Boolean(savedSeed)
    content = (
      <IntroPhase
        draftMode={state.draftMode}
        hasResume={hasResume}
        onDraftModeChange={(draftMode: DraftMode) =>
          update((s) => ({ ...s, draftMode, draft: createDraftState(draftMode) }))
        }
        onStart={() => {
          trackGameEvent('game_started', { draft_mode: state.draftMode })
          update(beginCareer)
        }}
        onResume={() => {
          if (!savedSeed) return
          const latest = loadLatestState()
          if (latest) setState(latest)
        }}
        onNewGame={() => {
          trackGameEvent('game_started', { draft_mode: state.draftMode, fresh: true })
          clearState(state.seed)
          setState(createInitialState(state.mode, state.draftMode))
        }}
      />
    )
  } else if (state.phase === 'identity') {
    content = (
      <IdentityPhase
        onBack={() => update((s) => ({ ...s, phase: 'intro' }))}
        onSubmit={(input: {
          lastName: string
          preferredNumber: number
          preferredFoot: PreferredFoot
          position: Position
          nationalityFifa: string
          heritageNationalityFifa: string | null
        }) => {
          trackGameEvent('identity_completed', {
            position: input.position,
            nationality: input.nationalityFifa,
            preferred_foot: input.preferredFoot,
            has_heritage_nationality: Boolean(input.heritageNationalityFifa),
          })
          update((s) => initializeDraft(confirmIdentity(s, input)))
        }}
      />
    )
  } else if (state.phase === 'draft' && state.player) {
    content = (
      <DraftPhase
        state={state}
        onEnsureLegend={() => update(initializeDraft)}
        onTake={() => {
          const round = state.draft.picks.length + 1
          trackGameEvent('draft_round_completed', {
            round,
            draft_mode: state.draftMode,
            position: state.player?.position,
          })
          if (round >= 8) {
            trackGameEvent('draft_completed', {
              draft_mode: state.draftMode,
              position: state.player?.position,
            })
          }
          update(acceptRecommendedDraftAttribute)
        }}
        onSkip={() => {
          trackGameEvent('draft_legend_skipped', {
            round: state.draft.round,
            skips_remaining: Math.max(0, state.draft.skipsRemaining - 1),
          })
          update(rerollDraftLegend)
        }}
        onBack={() =>
          update((s) => ({
            ...s,
            phase: 'identity',
            player: null,
            draft: createDraftState(s.draftMode),
          }))
        }
      />
    )
  } else if (state.phase === 'draft_result' && state.player) {
    content = <DraftResultPhase state={state} onContinue={() => update(continueFromDraftResult)} />
  } else if (state.phase === 'origin' && state.player) {
    content = (
      <OriginPhase
        state={state}
        onBack={() => update((s) => ({ ...s, phase: 'draft_result' }))}
        onConfirmClub={(teamId) => {
          trackGameEvent('origin_club_selected', {
            team_id: teamId,
            position: state.player?.position,
            potential: state.player?.potential,
          })
          update((s) => confirmOriginClub(s, teamId))
        }}
      />
    )
  } else if (state.phase === 'summary' || state.currentEvent?.type === 'retire') {
    const summaryState = state.phase === 'summary' ? state : { ...state, phase: 'summary' as const }
    content = (
      <SummaryPhase
        state={summaryState}
        onReplay={() => {
          trackGameEvent('career_restarted', {
            seasons: state.seasons.length,
            position: state.player?.position,
          })
          clearState(state.seed)
          setState(createInitialState(state.mode, state.draftMode))
        }}
      />
    )
  } else {
    content = (
      <CareerPhase
        state={state}
        onAcceptOffer={(id) => {
          const offer =
            state.pendingOffers.find((item) => item.id === id) ??
            (state.currentEvent?.type === 'offer'
              ? state.currentEvent.offers.find((item) => item.id === id)
              : undefined)
          if (offer?.kind === 'transfer') {
            trackGameEvent('transfer_offer_accepted', {
              team_id: offer.teamId,
              role: offer.role,
              transfer_fee: offer.transferFee,
              season: state.seasons.length,
            })
          }
          update((s) => acceptOffer(s, id))
        }}
        onRejectOffers={() => update(rejectOffers)}
        onNegotiate={(id) => update((s) => openNegotiation(s, id))}
        onSubmitNegotiation={(ask) => update((s) => submitNegotiation(s, ask))}
        onPreviewChoice={(id): ChoiceSpinResult => {
          const preview = previewCareerChoice(state, id)
          pendingChoice.current = preview
          return {
            choiceId: preview.choiceId,
            winningIndex: preview.winningIndex,
            outcomes: preview.outcomes,
          }
        }}
        onCommitChoice={() => {
          const preview = pendingChoice.current
          pendingChoice.current = null
          if (!preview) return
          setState(commitCareerChoiceResult(preview.resolved))
        }}
        onContinueSeason={() => {
          if (state.currentEvent?.type === 'season_result') {
            const season = state.currentEvent.season
            trackGameEvent('season_completed', {
              season: season.index + 1,
              age: season.age,
              team_id: season.teamId,
              overall: season.overall,
              appearances: season.stats.appearances,
              goals: season.stats.goals,
              assists: season.stats.assists,
              trophies: season.trophies.length,
            })
          }
          update(afterSeasonContinue)
        }}
        onDismissCelebration={() => update(dismissCelebration)}
        onDismissObjective={() => update(dismissObjectiveBriefing)}
        onRetire={() => update(goToSummary)}
        onCallAgent={() => update(callAgentRerollOffers)}
        onRespondCallup={(accept) => update((s) => respondNationalCallup(s, accept))}
        onRespondYouthLoan={(request) => update((s) => respondYouthLoanChoice(s, request))}
        onChooseTraits={(ids: TraitId[]) => update((s) => chooseTraits(s, ids))}
        onBackFromNegotiation={() =>
          update((s) => {
            if (s.currentEvent?.type !== 'negotiation') return s
            return {
              ...s,
              currentEvent: {
                type: 'offer',
                title: s.currentEvent.title,
                body: s.currentEvent.body,
                offers: s.pendingOffers,
                canReject: true,
                canNegotiate: true,
              },
            }
          })
        }
      />
    )
  }

  return (
    <div className="min-h-screen">
      {content}
      <DebugPanel state={state} onChange={setState} />
    </div>
  )
}
