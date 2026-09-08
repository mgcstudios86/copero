import { getCountry, getTeam } from '../data/catalog'
import { stageLabel } from '../engine/careerPath'
import { roleLabel } from '../engine/contract'
import { traitMeta } from '../engine/objectives'
import type { GameState } from '../engine/types'
import { useI18n } from '../i18n/config'
import {
  countryDisplayName,
  formatMoneyForLocale,
  objectiveLabel,
  type GameTranslate,
} from '../i18n/game'

export function CareerHud({ state }: { state: GameState }) {
  const { locale, t } = useI18n()
  const gameT: GameTranslate = (key, params) => t('game', key, params)
  const player = state.player
  if (!player) return null
  const team = state.currentTeamId ? getTeam(state.currentTeamId) : undefined
  const country = getCountry(player.nationalityFifa)
  const objective = state.seasonObjective
  const objectiveText = objectiveLabel(gameT, objective)

  return (
    <header className="mb-6 rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur">
      <div className="flex flex-wrap items-center gap-4">
        {country?.flag_url && <img src={country.flag_url} alt="" className="h-8 w-12 rounded object-cover" />}
        {team?.logo_url && <img src={team.logo_url} alt="" className="h-10 w-10 object-contain" />}
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl text-white">
            {player.lastName || gameT('common.playerFallback')}{' '}
            <span className="text-gold">#{player.preferredNumber}</span>
          </p>
          <p className="text-sm text-white/70">
            {gameT(`position.${player.position}`)} · {countryDisplayName(locale, country)} ·{' '}
            {team?.name ?? gameT('hud.club')}
            {state.contract ? ` · ${gameT(roleLabel(state.contract.role))}` : ''}
          </p>
          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-white/40">
            {gameT(stageLabel(state.careerStage ?? 'local'))}
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label={gameT('hud.age')} value={String(player.age)} />
        <Stat label={gameT('hud.ovr')} value={String(player.overall)} />
        <Stat
          label={gameT('hud.wage')}
          value={state.contract ? formatMoneyForLocale(locale, state.contract.annualWage) : '—'}
        />
        <Stat label={gameT('hud.wealth')} value={formatMoneyForLocale(locale, player.wealth)} />
        <Stat label={gameT('hud.value')} value={formatMoneyForLocale(locale, player.marketValue)} />
      </div>
      {objective && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-white/45">{gameT('hud.objective')}</p>
          <p className="text-sm font-medium text-white">
            {objective.completed
              ? `✓ ${objectiveText}`
              : objective.failed
                ? `✗ ${objectiveText}`
                : gameT('objective.pending', { label: objectiveText })}
            {!objective.completed && !objective.failed && objective.target > 1
              ? ` · ${objective.progress}/${objective.target}`
              : ''}
          </p>
        </div>
      )}
      {(state.traits?.length ?? 0) > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {state.traits.map((trait) => {
            const meta = traitMeta(trait)
            return (
              <span
                key={trait}
                className="rounded-full border border-sky-400/30 bg-sky-500/15 px-2.5 py-1 text-xs text-sky-100"
              >
                {meta ? gameT(meta.labelKey) : trait}
              </span>
            )
          })}
        </div>
      )}
      {state.modifiers.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {state.modifiers.map((modifier) => (
            <span
              key={modifier}
              className="rounded-full bg-pitch-light/40 px-2.5 py-1 text-xs text-gold"
            >
              {gameT(`mod.${modifier}`)}
            </span>
          ))}
        </div>
      )}
    </header>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-white/50">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  )
}
