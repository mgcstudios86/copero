import { useEffect, useMemo, useState } from 'react'
import { getCountry, getTeam } from '../../data/catalog'
import { flagUrl } from '../../data/flags'
import { stageLabel } from '../../engine/careerPath'
import { pickRoleForAsk, roleLabel } from '../../engine/contract'
import type { ClubOffer, DisplayText, GameState, PlayingRole, TraitId } from '../../engine/types'
import { useI18n } from '../../i18n/config'
import {
  countryDisplayName,
  formatMoneyForLocale,
  resolveGameText,
  type GameTranslate,
} from '../../i18n/game'
import { ClubOfferCard, MarketHeader, OfferGrid, RetireCard } from '../ui/ClubOfferCard'
import { EventChoiceCards, type ChoiceSpinResult } from '../ui/EventChoiceCards'
import { PlayerShell } from '../ui/PlayerShell'
import { GameBadge, GameButton, Metric, SectionTitle, StatusPanel, Surface } from '../ui/Primitives'
import { SeasonResultCard } from '../ui/SeasonResultCard'
import { StatIcons } from '../ui/StatIcons'
import { TrophyCelebration } from '../ui/TrophyCelebration'

const fieldClass =
  'mt-1 w-full rounded-[var(--copero-radius)] border border-[color:var(--copero-border)] bg-[color:color-mix(in_oklch,var(--copero-bg)_68%,transparent)] px-3 py-2 text-sm text-[color:var(--copero-fg)] outline-none transition focus:border-[color:var(--copero-accent)]'

export function CareerPhase({
  state,
  onAcceptOffer,
  onRejectOffers,
  onNegotiate,
  onSubmitNegotiation,
  onPreviewChoice,
  onCommitChoice,
  onContinueSeason,
  onDismissCelebration,
  onDismissObjective,
  onBackFromNegotiation,
  onRetire,
  onCallAgent,
  onRespondCallup,
  onChooseTraits,
  onRespondYouthLoan,
}: {
  state: GameState
  onAcceptOffer: (id: string) => void
  onRejectOffers: () => void
  onNegotiate: (id: string) => void
  onSubmitNegotiation: (
    ask: Partial<Pick<ClubOffer, 'annualWage' | 'years' | 'releaseClause' | 'role' | 'signingBonus'>>,
  ) => void
  onPreviewChoice: (id: string) => ChoiceSpinResult
  onCommitChoice: (id: string) => void
  onContinueSeason: () => void
  onDismissCelebration: () => void
  onDismissObjective: () => void
  onBackFromNegotiation: () => void
  onRetire: () => void
  onCallAgent: () => void
  onRespondCallup: (accept: boolean) => void
  onChooseTraits: (ids: TraitId[]) => void
  onRespondYouthLoan: (requestLoan: boolean) => void
}) {
  const { t } = useI18n()
  const gameT: GameTranslate = (key, params) => t('game', key, params)
  const event = state.currentEvent

  useEffect(() => {
    if (state.currentEvent?.type === 'objective_briefing') onDismissObjective()
  }, [state.currentEvent, onDismissObjective])

  const choosingClub = event?.type === 'offer' || event?.type === 'negotiation'
  const decidingCareer =
    event?.type === 'career_choice' ||
    event?.type === 'national_callup' ||
    event?.type === 'trait_pick' ||
    event?.type === 'youth_loan_choice'
  const showRetire =
    event?.type === 'offer' &&
    Boolean(state.player && state.player.age >= 32) &&
    ((state.contract?.yearsRemaining ?? 1) <= 0 || event.offers.some((offer) => offer.kind === 'renewal'))

  const currentTeam = state.currentTeamId ? getTeam(state.currentTeamId) : undefined
  const currentRep = currentTeam?.international_reputation ?? 1
  const seasonsAtClub = state.currentTeamId
    ? state.seasons.filter((season) => season.teamId === state.currentTeamId).length
    : 0

  const left = (
    <div className="game-panel-stack">
      {event?.type === 'trait_pick' && (
        <TraitPickPanel
          title={event.title}
          body={event.body}
          options={event.options}
          onConfirm={onChooseTraits}
        />
      )}

      {event?.type === 'youth_loan_choice' && (
        <Surface tone="strong" className="space-y-4 p-4 sm:p-5">
          <div>
            <SectionTitle as="h3">{resolveGameText(gameT, event.title)}</SectionTitle>
            <p className="mt-2 text-sm leading-relaxed text-[color:var(--copero-muted)]">{resolveGameText(gameT, event.body)}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onRespondYouthLoan(false)}
              className="game-card-action rounded-[var(--copero-radius-lg)] border border-[color:var(--copero-border)] bg-[color:color-mix(in_oklch,var(--copero-bg)_54%,transparent)] px-4 py-3 text-left"
            >
              <div className="font-[family-name:var(--copero-font-display)] text-sm font-black uppercase text-[color:var(--copero-fg)]">{gameT('youthLoan.stay')}</div>
              <div className="mt-1 text-[11px] text-[color:var(--copero-muted)]">{gameT('youthLoan.stayHint')}</div>
            </button>
            <button
              type="button"
              onClick={() => onRespondYouthLoan(true)}
              className="game-card-action rounded-[var(--copero-radius-lg)] border border-[color:color-mix(in_oklch,var(--copero-accent)_34%,var(--copero-border))] bg-[color:color-mix(in_oklch,var(--copero-accent)_10%,transparent)] px-4 py-3 text-left"
            >
              <div className="font-[family-name:var(--copero-font-display)] text-sm font-black uppercase text-[color:var(--copero-accent)]">{gameT('youthLoan.request')}</div>
              <div className="mt-1 text-[11px] text-[color:var(--copero-muted)]">{gameT('youthLoan.requestHint')}</div>
            </button>
          </div>
        </Surface>
      )}

      {event?.type === 'offer' && (
        <Surface tone="strong" className="space-y-4 p-4 sm:p-5">
          <MarketHeader
            title={resolveGameText(gameT, event.title)}
            subtitle={resolveGameText(gameT, event.body) || gameT('offer.marketSubtitle')}
          />
          <OfferGrid>
            {event.offers.map((offer) => (
              <ClubOfferCard
                key={offer.id}
                offer={offer}
                onSign={() => onAcceptOffer(offer.id)}
                currentRole={state.contract?.role}
                currentRep={currentRep}
                player={state.player}
              />
            ))}
            {event.canReject && state.currentTeamId && (
              <ClubOfferCard
                stay={{ teamId: state.currentTeamId, onStay: onRejectOffers }}
                seasonsAtClub={seasonsAtClub}
                playerOvr={state.player?.overall ?? 60}
                player={state.player}
                currentRole={state.contract?.role}
              />
            )}
          </OfferGrid>
          {showRetire && <RetireCard onRetire={onRetire} />}
          <div className="flex flex-wrap items-center gap-2 border-t border-[color:var(--copero-border)] pt-3">
            {event.canNegotiate && event.offers[0] && (
              <GameButton type="button" size="sm" variant="secondary" onClick={() => onNegotiate(event.offers[0].id)}>
                {gameT('offer.negotiate')}
              </GameButton>
            )}
            {!state.agentRerollUsed &&
              state.currentTeamId &&
              event.offers.some((offer) => offer.kind === 'transfer') && (
                <GameButton type="button" size="sm" onClick={onCallAgent}>
                  {gameT('offer.agent')}
                </GameButton>
              )}
          </div>
        </Surface>
      )}

      {event?.type === 'negotiation' && (
        <NegotiationPanel
          offer={event.offer}
          title={event.title}
          body={event.body}
          pendingOffers={state.pendingOffers}
          onSubmit={onSubmitNegotiation}
          onBack={onBackFromNegotiation}
          onNegotiateOther={onNegotiate}
        />
      )}

      {event?.type === 'career_choice' && (
        <EventChoiceCards
          eventId={event.eventId}
          title={resolveGameText(gameT, event.title)}
          body={resolveGameText(gameT, event.body)}
          choices={event.choices.map((choice) => ({
            id: choice.id,
            label: resolveGameText(gameT, choice.label),
          }))}
          impact={event.impact}
          onPreview={onPreviewChoice}
          onCommit={onCommitChoice}
        />
      )}

      {event?.type === 'season_result' && (
        <SeasonResultCard
          title={resolveGameText(gameT, event.title)}
          season={event.season}
          playerAge={state.player?.age ?? event.season.age}
          onContinue={onContinueSeason}
          objectiveLabel={resolveGameText(
            gameT,
            state.seasonObjective?.label ?? event.season.objectiveResult?.label,
          )}
          objectiveCompleted={state.seasonObjective?.completed ?? event.season.objectiveResult?.completed}
          objectiveFailed={state.seasonObjective?.failed ?? event.season.objectiveResult?.failed}
          stageLabelText={gameT(stageLabel(state.careerStage ?? 'local'))}
        />
      )}

      {event?.type === 'national_callup' && <NationalCallupPanel event={event} onRespond={onRespondCallup} />}

      {!event && !state.celebration && (
        <Surface tone="accent" className="p-4">
          <GameButton type="button" size="lg" onClick={onContinueSeason}>
            {gameT('season.simulate')}
          </GameButton>
        </Surface>
      )}
    </div>
  )

  return (
    <>
      {state.celebration?.kind === 'trophy' && state.celebration.trophies?.length ? (
        <TrophyCelebration
          message={resolveGameText(gameT, state.celebration.message)}
          trophies={state.celebration.trophies}
          onDismiss={onDismissCelebration}
        />
      ) : null}

      <PlayerShell
        state={state}
        choosingClub={choosingClub}
        decidingCareer={decidingCareer}
        leftExtra={left}
      />
    </>
  )
}

function NationalCallupPanel({
  event,
  onRespond,
}: {
  event: Extract<NonNullable<GameState['currentEvent']>, { type: 'national_callup' }>
  onRespond: (accept: boolean) => void
}) {
  const { locale, t } = useI18n()
  const gameT: GameTranslate = (key, params) => t('game', key, params)
  const country = getCountry(event.countryFifa)
  const countryName = countryDisplayName(locale, country) || event.countryFifa
  const body = gameT('national.callupBody', {
    country: countryName,
    apps: event.projected.appearances,
    goals: event.projected.goals,
    assists: event.projected.assists,
    cup:
      typeof event.body === 'object' && typeof event.body.params?.cup === 'string'
        ? event.body.params.cup
        : '',
  })

  return (
    <Surface tone="accent" className="space-y-4 p-4 sm:p-5 game-accent-glow">
      <div className="flex items-center gap-3">
        {country && <img src={flagUrl(country.iso_alpha2)} alt="" className="h-6 w-9 rounded-sm" />}
        {country?.logo_url && <img src={country.logo_url} alt="" className="h-10 w-10 object-contain" />}
        <div>
          <SectionTitle as="h3">{resolveGameText(gameT, event.title)}</SectionTitle>
          <p className="mt-1 text-sm text-[color:var(--copero-muted)]">{countryName}</p>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-[color:var(--copero-muted)]">{body}</p>
      {event.viaHeritage && <StatusPanel tone="warning">{gameT('national.heritageNote')}</StatusPanel>}
      <div className="rounded-[var(--copero-radius)] border border-[color:var(--copero-border)] bg-[color:color-mix(in_oklch,var(--copero-bg)_58%,transparent)] p-3">
        <StatIcons
          appearances={event.projected.appearances}
          goals={event.projected.goals}
          assists={event.projected.assists}
          animate={false}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onRespond(true)}
          className="game-card-action rounded-[var(--copero-radius-lg)] border border-[color:color-mix(in_oklch,var(--copero-accent)_35%,var(--copero-border))] bg-[color:color-mix(in_oklch,var(--copero-accent)_11%,transparent)] px-4 py-3 text-left"
        >
          <div className="font-[family-name:var(--copero-font-display)] text-sm font-black uppercase text-[color:var(--copero-accent)]">{gameT('national.accept')}</div>
          <div className="mt-1 text-[11px] text-[color:var(--copero-muted)]">{gameT('national.acceptHint')}</div>
        </button>
        <button
          type="button"
          onClick={() => onRespond(false)}
          className="game-card-action rounded-[var(--copero-radius-lg)] border border-[color:var(--copero-border)] bg-[color:color-mix(in_oklch,var(--copero-bg)_52%,transparent)] px-4 py-3 text-left"
        >
          <div className="font-[family-name:var(--copero-font-display)] text-sm font-black uppercase text-[color:var(--copero-fg)]">{gameT('national.reject')}</div>
          <div className="mt-1 text-[11px] text-[color:var(--copero-muted)]">{gameT('national.rejectHint')}</div>
        </button>
      </div>
    </Surface>
  )
}

function TraitPickPanel({
  title,
  body,
  options,
  onConfirm,
}: {
  title: DisplayText
  body: DisplayText
  options: { id: TraitId; label: DisplayText; desc: DisplayText }[]
  onConfirm: (ids: TraitId[]) => void
}) {
  const { t } = useI18n()
  const gameT: GameTranslate = (key, params) => t('game', key, params)
  const [selected, setSelected] = useState<TraitId[]>([])

  const toggle = (id: TraitId) => {
    setSelected((previous) => {
      if (previous.includes(id)) return previous.filter((item) => item !== id)
      if (previous.length >= 2) return [previous[1]!, id]
      return [...previous, id]
    })
  }

  return (
    <Surface tone="strong" className="space-y-4 p-4 sm:p-5">
      <div>
        <SectionTitle as="h3">{resolveGameText(gameT, title)}</SectionTitle>
        <p className="mt-2 text-sm text-[color:var(--copero-muted)]">{resolveGameText(gameT, body)}</p>
        <p className="mt-1 text-[11px] text-[color:var(--copero-muted)]">{gameT('traits.pickHint')}</p>
      </div>
      <div className="grid gap-2">
        {options.map((option) => {
          const active = selected.includes(option.id)
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => toggle(option.id)}
              className={`game-card-action rounded-[var(--copero-radius-lg)] border px-4 py-3 text-left ${
                active
                  ? 'border-[color:var(--copero-accent)] bg-[color:color-mix(in_oklch,var(--copero-accent)_10%,transparent)]'
                  : 'border-[color:var(--copero-border)] bg-[color:color-mix(in_oklch,var(--copero-bg)_52%,transparent)]'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-[family-name:var(--copero-font-display)] text-sm font-black uppercase text-[color:var(--copero-fg)]">
                  {resolveGameText(gameT, option.label)}
                </div>
                {active && <GameBadge tone="accent">✓</GameBadge>}
              </div>
              <div className="mt-1 text-[12px] text-[color:var(--copero-muted)]">{resolveGameText(gameT, option.desc)}</div>
            </button>
          )
        })}
      </div>
      <GameButton type="button" disabled={selected.length === 0} onClick={() => onConfirm(selected)}>
        {gameT('traits.confirm')}
      </GameButton>
    </Surface>
  )
}

function NegotiationPanel({
  offer,
  title,
  body,
  pendingOffers,
  onSubmit,
  onBack,
  onNegotiateOther,
}: {
  offer: ClubOffer
  title: DisplayText
  body: DisplayText
  pendingOffers: ClubOffer[]
  onSubmit: (
    ask: Partial<Pick<ClubOffer, 'annualWage' | 'years' | 'releaseClause' | 'role' | 'signingBonus'>>,
  ) => void
  onBack: () => void
  onNegotiateOther: (id: string) => void
}) {
  const { locale, t } = useI18n()
  const gameT: GameTranslate = (key, params) => t('game', key, params)
  const team = getTeam(offer.teamId)
  const [wage, setWage] = useState(Math.round(offer.annualWage * 1.15))
  const [years, setYears] = useState(Math.min(5, offer.years + 1))
  const [role, setRole] = useState<PlayingRole>(pickRoleForAsk(offer.role))
  const [clause, setClause] = useState(Math.round(offer.releaseClause * 1.2))
  const [pressureId, setPressureId] = useState<string | null>(null)

  const otherOffers = pendingOffers.filter((candidate) => candidate.id !== offer.id)
  const pressure = pressureId ? otherOffers.find((candidate) => candidate.id === pressureId) : null

  const effectiveWage = useMemo(
    () => (pressure ? Math.max(wage, Math.round(pressure.annualWage * 1.05)) : wage),
    [pressure, wage],
  )

  const applyPreset = (kind: 'p10' | 'p20' | 'starter' | 'y1') => {
    if (kind === 'p10') setWage(Math.round(offer.annualWage * 1.1))
    if (kind === 'p20') setWage(Math.round(offer.annualWage * 1.2))
    if (kind === 'starter') setRole('starter')
    if (kind === 'y1') setYears(Math.min(5, offer.years + 1))
  }

  return (
    <Surface tone="strong" className="relative space-y-4 overflow-hidden p-4 sm:p-5">
      {team?.logo_url && (
        <img src={team.logo_url} alt="" className="pointer-events-none absolute -right-6 -top-4 h-40 w-40 object-contain opacity-[0.08]" />
      )}
      <div className="relative z-10 flex items-center gap-3">
        <span className="game-icon-tile h-12 w-12 bg-white p-1.5">
          {team?.logo_url ? <img src={team.logo_url} alt="" className="h-full w-full object-contain" /> : '?'}
        </span>
        <div>
          <SectionTitle as="h3">{resolveGameText(gameT, title)}</SectionTitle>
          <p className="mt-1 text-sm text-[color:var(--copero-muted)]">{resolveGameText(gameT, body)}</p>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-2 gap-3">
        <Metric label={gameT('negotiate.offered')} value={`${formatMoneyForLocale(locale, offer.annualWage)}${gameT('offer.year')}`} />
        <Metric label={gameT('negotiate.asking')} value={`${formatMoneyForLocale(locale, effectiveWage)}${gameT('offer.year')}`} tone="accent" />
      </div>

      <div className="relative z-10 flex flex-wrap gap-2">
        {(
          [
            ['p10', '+10%'],
            ['p20', '+20%'],
            ['starter', gameT('negotiate.presetStarter')],
            ['y1', gameT('negotiate.presetYear')],
          ] as const
        ).map(([kind, label]) => (
          <GameButton key={kind} type="button" size="sm" variant="secondary" onClick={() => applyPreset(kind)}>
            {label}
          </GameButton>
        ))}
      </div>

      {otherOffers.length >= 1 && (
        <StatusPanel tone="neutral" className="relative z-10">
          <div className="font-[family-name:var(--copero-font-mono)] text-[10px] font-bold uppercase tracking-wide text-[color:var(--copero-muted)]">
            {gameT('negotiate.usePressure')}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {otherOffers.map((candidate) => {
              const otherTeam = getTeam(candidate.teamId)
              const active = pressureId === candidate.id
              return (
                <GameButton
                  key={candidate.id}
                  type="button"
                  size="sm"
                  variant={active ? 'primary' : 'secondary'}
                  onClick={() => setPressureId(active ? null : candidate.id)}
                >
                  {otherTeam?.logo_url && <img src={otherTeam.logo_url} alt="" className="h-4 w-4 object-contain" />}
                  {formatMoneyForLocale(locale, candidate.annualWage)}
                </GameButton>
              )
            })}
          </div>
          {pressure && (
            <GameButton type="button" size="sm" variant="ghost" className="mt-2" onClick={() => onNegotiateOther(pressure.id)}>
              {gameT('negotiate.switchOffer')}
            </GameButton>
          )}
        </StatusPanel>
      )}

      <div className="relative z-10 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-[color:var(--copero-muted)]">
          {gameT('negotiate.wage')}
          <input type="number" className={fieldClass} value={wage} onChange={(event) => setWage(Number(event.target.value) || wage)} />
        </label>
        <label className="text-xs text-[color:var(--copero-muted)]">
          {gameT('negotiate.years')}
          <input type="number" min={1} max={5} className={fieldClass} value={years} onChange={(event) => setYears(Number(event.target.value) || years)} />
        </label>
        <label className="text-xs text-[color:var(--copero-muted)]">
          {gameT('negotiate.role')}
          <select className={fieldClass} value={role} onChange={(event) => setRole(event.target.value as PlayingRole)}>
            {(['bench', 'rotation', 'starter', 'undisputed'] as const).map((candidateRole) => (
              <option key={candidateRole} value={candidateRole}>
                {gameT(roleLabel(candidateRole))}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-[color:var(--copero-muted)]">
          {gameT('negotiate.clause')}
          <div className="flex items-center gap-2">
            <input type="number" className={fieldClass} value={clause} onChange={(event) => setClause(Number(event.target.value) || clause)} />
            <GameBadge mono className="mt-1 whitespace-nowrap">{formatMoneyForLocale(locale, clause)}</GameBadge>
          </div>
        </label>
      </div>
      <div className="relative z-10 flex flex-wrap gap-2 border-t border-[color:var(--copero-border)] pt-3">
        <GameButton
          type="button"
          onClick={() =>
            onSubmit({
              annualWage: effectiveWage,
              years,
              role,
              releaseClause: clause,
              signingBonus: Math.round(effectiveWage * 0.4),
            })
          }
        >
          {gameT('negotiate.submit')}
        </GameButton>
        <GameButton type="button" variant="secondary" onClick={onBack}>
          {gameT('negotiate.back')}
        </GameButton>
      </div>
    </Surface>
  )
}
