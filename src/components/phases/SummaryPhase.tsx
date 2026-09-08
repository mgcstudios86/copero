import { useEffect } from 'react'
import { getCountry, getTeam } from '../../data/catalog'
import { stageLabel } from '../../engine/careerPath'
import { ATTRIBUTE_LABELS, ATTRIBUTE_ORDER } from '../../engine/draft'
import { traitMeta } from '../../engine/objectives'
import { calculateCareerRating } from '../../engine/rating'
import { buildCareerTimeline } from '../../engine/timeline'
import type { AttributeKey, GameState } from '../../engine/types'
import { useI18n } from '../../i18n/config'
import {
  countryDisplayName,
  formatMoneyForLocale,
  resolveGameText,
  type GameTranslate,
} from '../../i18n/game'
import { trackGameEvent, trackGameEventOnce } from '../../lib/analytics'
import { PlayerShell } from '../ui/PlayerShell'
import { GameBadge, GameButton, Metric, SectionEyebrow, SectionTitle, Surface } from '../ui/Primitives'
import { TrophyIcon } from '../ui/TrophyIcon'

const MILESTONE_KEYS: Record<string, string> = {
  stage_regional: 'milestone.stage_regional',
  stage_continental: 'milestone.stage_continental',
  stage_elite: 'milestone.stage_elite',
  national_debut: 'milestone.national_debut',
  first_trophy: 'milestone.first_trophy',
  trophy_cabinet: 'milestone.trophy_cabinet',
  ovr_85: 'milestone.ovr_85',
}

function valueText(key: AttributeKey, value: number): string {
  if (key === 'skillMoves' || key === 'weakFoot') return `${value}★`
  return String(value)
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'\"]/g, (char) => {
    const replacements: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      "'": '&apos;',
      '"': '&quot;',
    }
    return replacements[char] ?? char
  })
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 500)
}

async function svgToPng(svg: string, width: number, height: number): Promise<Blob | null> {
  const source = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(source)
  try {
    const image = new Image()
    image.decoding = 'async'
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Card render failed'))
    })
    image.src = url
    await loaded

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(image, 0, 0, width, height)
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.94))
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function SummaryPhase({ state, onReplay }: { state: GameState; onReplay: () => void }) {
  const { locale, t } = useI18n()
  const gameT: GameTranslate = (key, params) => t('game', key, params)
  const player = state.player
  const careerRating = player ? calculateCareerRating(state) : null

  useEffect(() => {
    if (!player || !careerRating) return
    const peakOverall = Math.max(
      player.peakOverall ?? player.overall,
      player.overall,
      ...state.seasons.map((season) => season.overall),
      0,
    )
    const trophyCount =
      state.seasons.reduce((total, season) => total + season.trophies.length, 0) +
      (state.nationalTrophies?.length ?? 0)

    trackGameEventOnce(`career_finished:${state.seed}`, 'career_finished', {
      grade: careerRating.grade,
      score: careerRating.score,
      position: player.position,
      seasons: state.seasons.length,
      peak_overall: peakOverall,
      potential: player.potential,
      trophies: trophyCount,
    })
  }, [careerRating, player, state.nationalTrophies, state.seed, state.seasons])

  if (!player || !careerRating) return null

  const peakOvr = Math.max(
    player.peakOverall ?? player.overall,
    player.overall,
    ...state.seasons.map((season) => season.overall),
    0,
  )
  const clubTrophies = state.seasons.flatMap((season) => season.trophies)
  const allTrophies = [...clubTrophies, ...(state.nationalTrophies ?? [])]
  const trophies = allTrophies.length
  const objectivesOk = (state.objectiveHistory ?? []).filter((objective) => objective.completed).length
  const rating = careerRating
  const ratingLabel = gameT(rating.label)
  const timeline = buildCareerTimeline(state)
  const defensivePosition = ['GK', 'CB', 'LB', 'RB', 'CDM'].includes(player.position)
  const fileBase = player.lastName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'copero'
  const country = getCountry(player.nationalityFifa)
  const countryName = countryDisplayName(locale, country) || player.nationalityFifa
  const playerName = player.lastName || gameT('common.playerFallback')
  const traitLabels = (state.traits ?? []).map((trait) => {
    const meta = traitMeta(trait)
    return meta ? gameT(meta.labelKey) : trait
  })

  const text = [
    `${playerName} · Copero`,
    `${rating.grade} · ${ratingLabel} · ${gameT('summary.points', { points: rating.score })}`,
    `${gameT('summary.maxOvr')} ${peakOvr} · ${gameT('summary.potential')} ${player.potential} · ${gameT(stageLabel(state.careerStage ?? 'local'))}`,
    `${gameT('summary.matches')} ${state.totals.appearances} · ${gameT('summary.goals')} ${state.totals.goals} · ${gameT('summary.assists')} ${state.totals.assists}`,
    defensivePosition ? `${gameT('summary.cleanSheets')} ${state.totals.cleanSheets}` : '',
    `${gameT('summary.national')} ${state.nationalTotals?.appearances ?? 0}`,
    `${gameT('summary.wealth')} ${formatMoneyForLocale(locale, player.wealth)} · ${gameT('summary.trophies')} ${trophies}`,
    `${gameT('summary.clubs')} ${timeline.length} · ${gameT('summary.objectives')} ${objectivesOk}`,
    traitLabels.join(', '),
  ]
    .filter(Boolean)
    .join('\n')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      alert(gameT('summary.copied'))
    } catch {
      alert(text)
    }
  }

  const buildCardSvg = () => {
    const fg = '#f6f8f3'
    const muted = '#9eabb9'
    const accent = '#7cf08a'
    const gold = '#e6c45d'
    const border = '#2d3a4b'

    const attrRows = ATTRIBUTE_ORDER.map((key, index) => {
      const column = index % 2
      const row = Math.floor(index / 2)
      const x = column === 0 ? 86 : 382
      const y = 390 + row * 58
      return `<text x="${x}" y="${y}" fill="${muted}" font-size="18" font-family="Arial, sans-serif" font-weight="700">${ATTRIBUTE_LABELS[key].short}</text><text x="${x + 76}" y="${y}" fill="${fg}" font-size="28" font-family="Arial, sans-serif" font-weight="900">${escapeXml(valueText(key, player.attributes[key]))}</text>`
    }).join('')

    const timelineRows = timeline.slice(0, 5).map((spell, index) => {
      const y = 790 + index * 48
      const name = spell.teamName.length > 27 ? `${spell.teamName.slice(0, 25)}…` : spell.teamName
      const age = gameT('summary.years', { start: spell.startAge, end: spell.endAge })
      return `<circle cx="93" cy="${y - 7}" r="6" fill="${accent}"/><text x="118" y="${y}" fill="${fg}" font-size="20" font-family="Arial, sans-serif" font-weight="700">${escapeXml(name)}</text><text x="505" y="${y}" fill="${muted}" font-size="17" font-family="Arial, sans-serif" text-anchor="end">${escapeXml(age)}</text><text x="642" y="${y}" fill="${muted}" font-size="17" font-family="Arial, sans-serif" text-anchor="end">${spell.appearances}</text>`
    }).join('')

    const statsLine = `${gameT('summary.matches')} ${state.totals.appearances}   ${gameT('summary.goals')} ${state.totals.goals}   ${gameT('summary.assists')} ${state.totals.assists}`
    const trophyLine = `${gameT('summary.trophies')} ${trophies}   ${gameT('summary.national')} ${state.nationalTotals?.appearances ?? 0}${defensivePosition ? `   ${gameT('summary.cleanSheets')} ${state.totals.cleanSheets}` : ''}`

    return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1160" viewBox="0 0 720 1160"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#12233a"/><stop offset="0.52" stop-color="#091522"/><stop offset="1" stop-color="#050a12"/></linearGradient><radialGradient id="goldGlow" cx="88%" cy="8%" r="48%"><stop stop-color="${gold}" stop-opacity="0.32"/><stop offset="1" stop-color="${gold}" stop-opacity="0"/></radialGradient><radialGradient id="greenGlow" cx="12%" cy="38%" r="46%"><stop stop-color="${accent}" stop-opacity="0.15"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient></defs><rect width="720" height="1160" rx="48" fill="url(#bg)"/><rect width="720" height="1160" rx="48" fill="url(#goldGlow)"/><rect width="720" height="1160" rx="48" fill="url(#greenGlow)"/><rect x="42" y="42" width="636" height="1076" rx="38" fill="#08101b" fill-opacity="0.88" stroke="${border}"/><text x="78" y="105" fill="${gold}" font-size="18" font-family="Arial, sans-serif" font-weight="700" letter-spacing="4">${escapeXml(gameT('summary.cardTitle'))}</text><text x="78" y="188" fill="${fg}" font-size="60" font-family="Arial, sans-serif" font-weight="900">${escapeXml(playerName.toUpperCase())}</text><text x="78" y="235" fill="${muted}" font-size="24" font-family="Arial, sans-serif">${escapeXml(`${countryName} · ${gameT(`position.${player.position}`)} · #${player.preferredNumber}`)}</text><text x="78" y="325" fill="${gold}" font-size="80" font-family="Arial, sans-serif" font-weight="900">${peakOvr}</text><text x="250" y="300" fill="${muted}" font-size="18" font-family="Arial, sans-serif" font-weight="700">${escapeXml(gameT('summary.potential'))}</text><text x="250" y="337" fill="${accent}" font-size="38" font-family="Arial, sans-serif" font-weight="900">${player.potential}</text>${attrRows}<line x1="78" y1="650" x2="642" y2="650" stroke="${border}"/><text x="78" y="704" fill="${muted}" font-size="18" font-family="Arial, sans-serif">${escapeXml(statsLine)}</text><text x="78" y="744" fill="${muted}" font-size="18" font-family="Arial, sans-serif">${escapeXml(trophyLine)}</text><text x="78" y="790" fill="${accent}" font-size="15" font-family="Arial, sans-serif" font-weight="700" letter-spacing="2">${escapeXml(gameT('summary.trajectory'))}</text>${timelineRows}<line x1="78" y1="1040" x2="642" y2="1040" stroke="${border}"/><text x="78" y="1110" fill="${gold}" font-size="72" font-family="Arial, sans-serif" font-weight="900">${rating.grade}</text><text x="205" y="1085" fill="${fg}" font-size="28" font-family="Arial, sans-serif" font-weight="900">${escapeXml(ratingLabel)}</text><text x="205" y="1120" fill="${muted}" font-size="21" font-family="Arial, sans-serif">${escapeXml(gameT('summary.points', { points: rating.score }))}</text></svg>`
  }

  const createPng = () => svgToPng(buildCardSvg(), 720, 1160)

  const downloadCard = async () => {
    const png = await createPng()
    if (png) {
      downloadBlob(png, `${fileBase}-career-card.png`)
      trackGameEvent('result_card_downloaded', {
        format: 'png',
        grade: rating.grade,
        position: player.position,
      })
      return
    }
    downloadBlob(
      new Blob([buildCardSvg()], { type: 'image/svg+xml;charset=utf-8' }),
      `${fileBase}-career-card.svg`,
    )
    trackGameEvent('result_card_downloaded', {
      format: 'svg_fallback',
      grade: rating.grade,
      position: player.position,
    })
  }

  const share = async () => {
    const shareTitle = gameT('summary.shareTitle', { name: playerName })
    if (navigator.share) {
      const png = await createPng()
      if (png) {
        const file = new File([png], `${fileBase}-career-card.png`, { type: 'image/png' })
        if (!navigator.canShare || navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ title: shareTitle, text, files: [file] })
            trackGameEvent('result_shared', {
              method: 'native_file',
              grade: rating.grade,
              position: player.position,
            })
            return
          } catch {
            // The native share sheet may be dismissed by the user.
          }
        }
      }
      try {
        await navigator.share({ title: shareTitle, text })
        trackGameEvent('result_shared', {
          method: 'native_text',
          grade: rating.grade,
          position: player.position,
        })
        return
      } catch {
        // Fall back to the clipboard.
      }
    }
    await copy()
    trackGameEvent('result_shared', {
      method: 'clipboard',
      grade: rating.grade,
      position: player.position,
    })
  }

  const left = (
    <Surface tone="gold" className="game-gold-glow relative overflow-hidden p-5 sm:p-6">
      <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-[color:color-mix(in_oklch,var(--copero-gold)_14%,transparent)] blur-3xl" />
      <div className="relative flex items-start justify-between gap-5">
        <div className="min-w-0">
          <SectionEyebrow className="text-[color:var(--copero-gold)]">{gameT('summary.cardTitle')}</SectionEyebrow>
          <SectionTitle as="h2" className="mt-2">{gameT('summary.endTitle')}</SectionTitle>
          <p className="mt-2 text-sm leading-relaxed text-[color:var(--copero-muted)]">
            {state.currentEvent?.type === 'retire'
              ? resolveGameText(gameT, state.currentEvent.body)
              : gameT('retire.title')}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-[family-name:var(--copero-font-display)] text-6xl font-black leading-none text-[color:var(--copero-gold)]">
            {rating.grade}
          </div>
          <GameBadge tone="gold" className="mt-2">{gameT('summary.points', { points: rating.score })}</GameBadge>
        </div>
      </div>

      <div className="relative mt-4 flex flex-wrap gap-2">
        <GameBadge tone="accent">{ratingLabel}</GameBadge>
        <GameBadge mono>{gameT('summary.maxOvr')} {peakOvr}</GameBadge>
        <GameBadge mono>{gameT('summary.potential')} {player.potential}</GameBadge>
        <GameBadge>{gameT(stageLabel(state.careerStage ?? 'local'))}</GameBadge>
      </div>

      <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ATTRIBUTE_ORDER.map((key) => (
          <Metric key={key} label={ATTRIBUTE_LABELS[key].short} value={valueText(key, player.attributes[key])} />
        ))}
      </div>

      <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label={gameT('summary.matches')} value={state.totals.appearances} tone="accent" />
        <Metric label={gameT('summary.goals')} value={state.totals.goals} />
        <Metric label={gameT('summary.assists')} value={state.totals.assists} />
        <Metric
          label={gameT(defensivePosition ? 'summary.cleanSheets' : 'summary.trophies')}
          value={defensivePosition ? state.totals.cleanSheets : trophies}
          tone="gold"
        />
      </div>

      {timeline.length > 0 && (
        <div className="relative mt-6 border-t border-[color:var(--copero-border)] pt-5">
          <SectionEyebrow>{gameT('summary.trajectory')}</SectionEyebrow>
          <div className="mt-3 space-y-2">
            {timeline.map((spell, index) => {
              const team = getTeam(spell.teamId)
              return (
                <div key={spell.key} className="relative flex gap-3 rounded-[var(--copero-radius)] border border-[color:var(--copero-border)] bg-[color:color-mix(in_oklch,var(--copero-bg)_58%,transparent)] p-3">
                  <div className="relative flex w-7 shrink-0 justify-center">
                    <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-[color:var(--copero-accent)] shadow-[0_0_12px_color-mix(in_oklch,var(--copero-accent)_38%,transparent)]" />
                    {index < timeline.length - 1 && (
                      <span className="absolute left-1/2 top-5 h-[calc(100%+10px)] w-px -translate-x-1/2 bg-[color:var(--copero-border)]" />
                    )}
                  </div>
                  <span className="game-icon-tile h-10 w-10 bg-white p-1.5">
                    {team?.logo_url ? (
                      <img src={team.logo_url} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-xs font-black text-black">{spell.teamName.slice(0, 2)}</span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="truncate font-bold text-[color:var(--copero-fg)]">
                        {spell.teamName}{spell.loan ? ` · ${gameT('season.loan')}` : ''}
                      </div>
                      <div className="font-[family-name:var(--copero-font-mono)] text-[10px] uppercase tracking-wide text-[color:var(--copero-muted)]">
                        {gameT('summary.years', { start: spell.startAge, end: spell.endAge })} ·{' '}
                        {gameT('summary.seasons', { count: spell.seasons })}
                      </div>
                    </div>
                    <div className="mt-1 text-[11px] text-[color:var(--copero-muted)]">
                      {gameT('summary.matches')} {spell.appearances} · {gameT('summary.goals')} {spell.goals} ·{' '}
                      {gameT('summary.assists')} {spell.assists} · {gameT('summary.maxOvr')} {spell.peakOverall}
                      {spell.trophies > 0 ? ` · ${gameT('summary.titleCount', { count: spell.trophies })}` : ''}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {allTrophies.length > 0 && (
        <div className="relative mt-5 border-t border-[color:var(--copero-border)] pt-5">
          <SectionEyebrow className="text-[color:var(--copero-gold)]">{gameT('summary.trophies')}</SectionEyebrow>
          <div className="mt-3 flex flex-wrap gap-2">
            {allTrophies.slice(0, 24).map((trophy, index) => (
              <TrophyIcon
                key={`${trophy.id}-${index}`}
                src={trophy.assetPath}
                name={trophy.name}
                className="h-10 w-10"
              />
            ))}
          </div>
        </div>
      )}

      {(state.milestones?.length ?? 0) > 0 && (
        <div className="relative mt-5 border-t border-[color:var(--copero-border)] pt-5">
          <SectionEyebrow>{gameT('summary.milestones')}</SectionEyebrow>
          <div className="mt-3 flex flex-wrap gap-2">
            {state.milestones.map((milestone) => (
              <GameBadge key={milestone} tone="neutral">
                {gameT(MILESTONE_KEYS[milestone] ?? milestone)}
              </GameBadge>
            ))}
          </div>
        </div>
      )}

      <div className="relative mt-6 flex flex-wrap gap-2 border-t border-[color:var(--copero-border)] pt-5">
        <GameButton type="button" variant="gold" onClick={downloadCard}>
          {gameT('summary.download')}
        </GameButton>
        <GameButton type="button" onClick={share}>
          {gameT('summary.share')}
        </GameButton>
        <GameButton type="button" variant="secondary" onClick={onReplay}>
          {gameT('summary.newCareer')}
        </GameButton>
      </div>
    </Surface>
  )

  return <PlayerShell state={state} leftExtra={left} />
}
