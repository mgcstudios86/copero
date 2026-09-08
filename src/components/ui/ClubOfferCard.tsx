import type { ReactNode } from 'react'
import { getCompetition, getTeam } from '../../data/catalog'
import { pathReasonLabel } from '../../engine/careerPath'
import { roleLabel } from '../../engine/contract'
import { academyStartRole, originOvrDelta } from '../../engine/originStart'
import { previewObjectiveForClub } from '../../engine/objectives'
import type { ClubOffer, Player, PlayingRole } from '../../engine/types'
import { useI18n } from '../../i18n/config'
import { formatMoneyForLocale, resolveGameText, type GameTranslate } from '../../i18n/game'
import { shortClubName } from './positions'
import { GameBadge, SectionTitle, StatusPanel } from './Primitives'

const ROLE_RANK: Record<PlayingRole, number> = {
  bench: 0,
  rotation: 1,
  starter: 2,
  undisputed: 3,
}

type BadgeTone = 'neutral' | 'accent' | 'gold' | 'success' | 'danger' | 'info'
type BadgeDef = { key: string; tone: BadgeTone }

function tierClass(rep: number): string {
  if (rep >= 5) return 'border-[color:color-mix(in_oklch,var(--copero-gold)_46%,var(--copero-border))] game-gold-glow'
  if (rep >= 4) return 'border-[color:color-mix(in_oklch,var(--copero-accent)_30%,var(--copero-border))]'
  if (rep >= 3) return 'border-[color:color-mix(in_oklch,var(--copero-fg)_20%,var(--copero-border))]'
  return 'border-[color:var(--copero-border)]'
}

function offerBadges(offer: ClubOffer, currentRep: number): BadgeDef[] {
  const team = getTeam(offer.teamId)
  const rep = team?.international_reputation ?? 1
  const badges: BadgeDef[] = []
  if (offer.kind === 'renewal') badges.push({ key: 'offer.badge.renewal', tone: 'accent' })
  if (offer.kind === 'loan') badges.push({ key: 'offer.badge.loan', tone: 'info' })
  if (offer.kind === 'academy') badges.push({ key: 'offer.badge.academy', tone: 'neutral' })
  if (offer.kind === 'transfer' && offer.pathReason === 'home_return') {
    badges.push({ key: 'offer.badge.home', tone: 'gold' })
  }
  if (offer.pathReason === 'recovery') badges.push({ key: 'offer.badge.recovery', tone: 'gold' })
  if (
    offer.kind === 'transfer' &&
    rep >= currentRep + 2 &&
    offer.pathReason !== 'home_return' &&
    offer.pathReason !== 'recovery'
  ) {
    badges.push({ key: 'offer.badge.blockbuster', tone: 'danger' })
  }
  const pathKey = pathReasonLabel(offer.pathReason)
  if (
    pathKey &&
    offer.pathReason !== 'home_return' &&
    offer.pathReason !== 'recovery' &&
    offer.kind !== 'renewal'
  ) {
    badges.push({ key: pathKey, tone: 'neutral' })
  }
  return badges
}

function minutesImpactKey(offerRole: PlayingRole, currentRole?: PlayingRole): { key: string; role?: PlayingRole } {
  if (!currentRole) return { key: 'offer.minutes.start', role: offerRole }
  const delta = ROLE_RANK[offerRole] - ROLE_RANK[currentRole]
  if (delta > 0) return { key: 'offer.minutes.more' }
  if (delta < 0) return { key: 'offer.minutes.less' }
  return { key: 'offer.minutes.start', role: offerRole }
}

const cardBase =
  'offer-card-potrero game-card-action relative flex min-h-[210px] flex-col overflow-hidden rounded-[var(--copero-radius-lg)] border p-4 text-left focus-visible:outline-none'

function TeamMark({ logo, name }: { logo?: string | null; name: string }) {
  return (
    <span className="game-icon-tile h-11 w-11 bg-white p-1.5">
      {logo ? (
        <img src={logo} alt="" className="h-full w-full object-contain" />
      ) : (
        <span className="font-black text-black/40">{name.slice(0, 2)}</span>
      )}
    </span>
  )
}

export function ClubOfferCard({
  offer,
  onSign,
  stay,
  origin,
  selected,
  currentRole,
  currentRep = 1,
  seasonsAtClub = 0,
  playerOvr = 60,
  player,
}: {
  offer?: ClubOffer
  stay?: { teamId: string; onStay: () => void }
  origin?: { teamId: string; label?: string; onPick: () => void }
  onSign?: () => void
  selected?: boolean
  currentRole?: PlayingRole
  currentRep?: number
  seasonsAtClub?: number
  playerOvr?: number
  player?: Player | null
}) {
  const { locale, t } = useI18n()
  const gameT: GameTranslate = (key, params) => t('game', key, params)
  const ring = selected
    ? 'ring-2 ring-[color:var(--copero-accent)] border-[color:var(--copero-accent)]'
    : ''

  if (origin) {
    const team = getTeam(origin.teamId)
    const comp = team ? getCompetition(team.competition_id) : undefined
    const name = shortClubName(team?.name ?? origin.teamId)
    const rep = team?.international_reputation ?? 1
    const tipKey = rep >= 3 ? 'offer.origin.big' : rep <= 1 ? 'offer.origin.small' : 'offer.origin.balanced'
    const previewRole = academyStartRole(team, 0.5)
    const ovr = originOvrDelta(team, previewRole)
    return (
      <button type="button" onClick={origin.onPick} className={`${cardBase} ${tierClass(rep)} ${ring}`}>
        {team?.logo_url && (
          <img src={team.logo_url} alt="" className="pointer-events-none absolute -right-4 -top-2 h-36 w-36 object-contain opacity-[0.08]" />
        )}
        <div className="relative z-10 flex items-center gap-3">
          <TeamMark logo={team?.logo_url} name={name} />
          <div>
            <div className="font-[family-name:var(--copero-font-display)] text-sm font-black uppercase tracking-wide text-[color:var(--copero-fg)]">{name}</div>
            <div className="mt-1 text-[11px] text-[color:var(--copero-muted)]">{gameT(tipKey)}</div>
          </div>
        </div>
        <div className="relative z-10 mt-3 flex flex-wrap gap-2">
          <GameBadge tone={ovr.delta >= 0 ? 'accent' : 'danger'} mono>
            {ovr.delta > 0 ? `+${ovr.delta}` : ovr.delta} OVR
          </GameBadge>
          <GameBadge>{gameT(roleLabel(previewRole))}</GameBadge>
        </div>
        <div className="relative z-10 mt-auto flex items-center gap-1.5 pt-4 text-[11px] text-[color:var(--copero-muted)]">
          {comp?.logo_url && <img src={comp.logo_url} alt="" className="h-4 w-4 object-contain" />}
          {comp?.name ?? gameT('offer.league')}
        </div>
      </button>
    )
  }

  if (stay) {
    const team = getTeam(stay.teamId)
    const name = shortClubName(team?.name ?? stay.teamId)
    const rep = team?.international_reputation ?? 1
    const referente = Math.min(100, Math.round(seasonsAtClub * 18 + Math.max(0, playerOvr - 68) * 2.5))
    const stayMeta = previewObjectiveForClub(player, stay.teamId, currentRole ?? 'rotation')
    return (
      <button type="button" onClick={stay.onStay} className={`${cardBase} ${tierClass(rep)} ${ring}`}>
        {team?.logo_url && (
          <img src={team.logo_url} alt="" className="pointer-events-none absolute -right-4 -top-2 h-36 w-36 object-contain opacity-[0.08]" />
        )}
        <div className="relative z-10 mb-2"><GameBadge tone="accent">{gameT('offer.badge.renewal')}</GameBadge></div>
        <div className="relative z-10 flex items-center gap-3">
          <TeamMark logo={team?.logo_url} name={name} />
          <div>
            <div className="font-[family-name:var(--copero-font-display)] text-sm font-black uppercase tracking-wide text-[color:var(--copero-fg)]">{name}</div>
            <div className="text-[11px] text-[color:var(--copero-muted)]">{gameT('offer.stay')}</div>
          </div>
        </div>
        <div className="relative z-10 mt-4">
          <div className="mb-1 flex justify-between font-[family-name:var(--copero-font-mono)] text-[10px] uppercase tracking-wide text-[color:var(--copero-muted)]">
            <span>{gameT('offer.referencePath')}</span>
            <span>{referente}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[color:color-mix(in_oklch,var(--copero-fg)_8%,transparent)]">
            <div className="h-full rounded-full bg-[color:var(--copero-accent)]" style={{ width: `${referente}%` }} />
          </div>
        </div>
        <StatusPanel tone="info" className="relative z-10 mt-3 py-2 text-[11px]">
          <span className="font-semibold">{gameT('offer.goalThere')}</span>{resolveGameText(gameT, stayMeta.label)}
        </StatusPanel>
      </button>
    )
  }

  if (!offer || !onSign) return null
  const team = getTeam(offer.teamId)
  const comp = team ? getCompetition(team.competition_id) : undefined
  const label = shortClubName(team?.name ?? offer.teamId)
  const rep = team?.international_reputation ?? 1
  const badges = offerBadges(offer, currentRep)
  const impact = minutesImpactKey(offer.role, currentRole)
  const monthly = Math.round(offer.annualWage / 12)
  const pathKey = pathReasonLabel(offer.pathReason)
  const meta = previewObjectiveForClub(player, offer.teamId, offer.role)

  return (
    <button
      type="button"
      onClick={onSign}
      className={`${cardBase} ${tierClass(rep)} ${ring} ${offer.kind === 'loan' ? 'border-dashed' : ''}`}
    >
      {team?.logo_url && (
        <img src={team.logo_url} alt="" className="pointer-events-none absolute -right-6 -top-4 h-40 w-40 object-contain opacity-[0.09]" />
      )}
      <div className="relative z-10 mb-2 flex flex-wrap gap-1.5">
        {badges.map((badge) => (
          <GameBadge key={badge.key} tone={badge.tone}>{gameT(badge.key)}</GameBadge>
        ))}
      </div>
      <div className="relative z-10 flex items-center gap-3">
        <TeamMark logo={team?.logo_url} name={label} />
        <div className="min-w-0">
          <div className="truncate font-[family-name:var(--copero-font-display)] text-sm font-black uppercase tracking-wide text-[color:var(--copero-fg)]">{label}</div>
          <div className="flex items-center gap-1 text-[11px] text-[color:var(--copero-muted)]">
            {comp?.logo_url && <img src={comp.logo_url} alt="" className="h-3.5 w-3.5 object-contain" />}
            <span className="truncate">{comp?.name ?? gameT('offer.league')}</span>
          </div>
        </div>
      </div>
      <div className="relative z-10 mt-4">
        <div className="money-neon font-[family-name:var(--copero-font-display)] text-2xl font-black tabular-nums">
          {formatMoneyForLocale(locale, monthly)}
          <span className="ml-1 text-sm font-semibold">{gameT('offer.month')}</span>
        </div>
        <div className="mt-1 font-[family-name:var(--copero-font-mono)] text-[11px] text-[color:var(--copero-muted)]">
          {formatMoneyForLocale(locale, offer.annualWage)}{gameT('offer.year')} · {offer.years}{' '}
          {gameT(offer.years === 1 ? 'offer.yearCount.one' : 'offer.yearCount.other')}
        </div>
      </div>
      {pathKey && offer.pathReason !== 'home_return' && offer.pathReason !== 'recovery' && (
        <div className="relative z-10 mt-2 text-[11px] text-sky-200/80">
          {gameT('offer.reason', { reason: gameT(pathKey) })}
        </div>
      )}
      {offer.pathReason === 'home_return' && (
        <div className="relative z-10 mt-2 text-[11px] font-semibold text-[color:var(--copero-gold)]">{gameT('offer.homeHint')}</div>
      )}
      {offer.pathReason === 'recovery' && (
        <div className="relative z-10 mt-2 text-[11px] font-semibold text-[color:var(--copero-gold)]">{gameT('offer.recoveryHint')}</div>
      )}
      {offer.transferFee != null && offer.transferFee > 0 && (
        <div className="relative z-10 mt-1 text-[11px] text-[color:var(--copero-muted)]">
          {gameT('offer.transferFee', { fee: formatMoneyForLocale(locale, offer.transferFee) })}
        </div>
      )}
      <div className="relative z-10 mt-2 text-[11px] font-semibold text-[color:var(--copero-fg)]">
        {gameT(impact.key, impact.role ? { role: gameT(roleLabel(impact.role)) } : undefined)}
      </div>
      <StatusPanel tone="info" className="relative z-10 mt-3 py-2 text-[11px]">
        <span className="font-semibold">{gameT('offer.goalThere')}</span>{resolveGameText(gameT, meta.label)}
      </StatusPanel>
    </button>
  )
}

export function OfferGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
}

export function MarketHeader({ title, subtitle }: { title?: string; subtitle?: string }) {
  const { t } = useI18n()
  const gameT: GameTranslate = (key, params) => t('game', key, params)
  return (
    <div className="mb-1">
      <SectionTitle as="h3">{title ?? gameT('offer.transferTitle')}</SectionTitle>
      <p className="mt-2 text-sm text-[color:var(--copero-muted)]">{subtitle ?? gameT('offer.marketSubtitle')}</p>
    </div>
  )
}

export function RetireCard({ onRetire }: { onRetire: () => void }) {
  const { t } = useI18n()
  const gameT: GameTranslate = (key, params) => t('game', key, params)
  return (
    <button
      type="button"
      onClick={onRetire}
      className="offer-card-potrero game-card-action relative mt-2 flex min-h-[94px] w-full overflow-hidden rounded-[var(--copero-radius-lg)] border border-[color:var(--copero-border)] text-left"
    >
      <img
        src="/career-simulator/career-events/retirement.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-40"
      />
      <div className="relative z-10 flex w-full flex-col justify-center bg-gradient-to-r from-black/85 to-black/35 px-4 py-3">
        <div className="font-[family-name:var(--copero-font-display)] text-sm font-black uppercase text-[color:var(--copero-gold)]">{gameT('offer.retire')}</div>
        <div className="mt-1 text-xs text-[color:var(--copero-muted)]">{gameT('offer.retireHint')}</div>
      </div>
    </button>
  )
}
