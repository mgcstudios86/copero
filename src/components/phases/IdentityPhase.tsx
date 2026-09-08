import { useMemo, useState } from 'react'
import { allCountries } from '../../data/catalog'
import { flagUrl } from '../../data/flags'
import type { Position, PreferredFoot } from '../../engine/types'
import { useI18n } from '../../i18n/config'
import { countryDisplayName, type GameTranslate } from '../../i18n/game'
import { KitPreview } from '../ui/KitPreview'
import { PitchPositionPicker } from '../ui/PitchPositionPicker'
import { GameBadge, GameButton, SectionEyebrow, SectionTitle, StatusPanel, Surface } from '../ui/Primitives'

const INITIAL_COUNTRIES = 24
const PRIORITY_FIFA = ['ARG', 'BRA', 'MEX', 'URU', 'COL', 'CHI', 'ESP', 'ENG', 'ITA', 'FRA', 'GER', 'POR', 'USA', 'NED', 'BEL']
const DEFAULT_NATIONALITY =
  PRIORITY_FIFA.find((code) => allCountries.some((country) => country.fifa_code === code)) ??
  allCountries[0]?.fifa_code ??
  null
const DEFAULT_POSITION: Position = 'ST'
const fieldClass =
  'w-full rounded-[var(--copero-radius)] border border-[color:var(--copero-border)] bg-[color:color-mix(in_oklch,var(--copero-bg)_70%,transparent)] px-3 py-2.5 text-[color:var(--copero-fg)] outline-none transition focus:border-[color:var(--copero-accent)]'

export function IdentityPhase({
  onSubmit,
  onBack,
}: {
  onSubmit: (input: {
    lastName: string
    preferredNumber: number
    preferredFoot: PreferredFoot
    position: Position
    nationalityFifa: string
    heritageNationalityFifa: string | null
  }) => void
  onBack?: () => void
}) {
  const { locale, t } = useI18n()
  const gameT: GameTranslate = (key, params) => t('game', key, params)
  const [search, setSearch] = useState('')
  const [nationalityFifa, setNationalityFifa] = useState<string | null>(DEFAULT_NATIONALITY)
  const [heritageNationalityFifa, setHeritageNationalityFifa] = useState<string | null>(null)
  const [heritageSearch, setHeritageSearch] = useState('')
  const [showHeritage, setShowHeritage] = useState(false)
  const [position, setPosition] = useState<Position | null>(DEFAULT_POSITION)
  const [lastName, setLastName] = useState('')
  const [preferredNumber, setPreferredNumber] = useState(10)
  const [preferredFoot, setPreferredFoot] = useState<PreferredFoot>('right')
  const [showAll, setShowAll] = useState(false)

  const canConfirm = Boolean(nationalityFifa && position)
  const selectedCountry = useMemo(
    () => allCountries.find((country) => country.fifa_code === nationalityFifa) ?? null,
    [nationalityFifa],
  )

  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? allCountries.filter(
          (country) =>
            countryDisplayName(locale, country).toLowerCase().includes(q) ||
            country.name_es.toLowerCase().includes(q) ||
            country.name_en.toLowerCase().includes(q) ||
            country.fifa_code.toLowerCase().includes(q),
        )
      : allCountries

    if (q) return filtered.slice(0, 80)

    const priority = PRIORITY_FIFA.map((code) => filtered.find((country) => country.fifa_code === code)).filter(
      Boolean,
    ) as typeof allCountries
    const rest = filtered.filter((country) => !PRIORITY_FIFA.includes(country.fifa_code))
    const ordered = [...priority, ...rest]
    if (showAll) return ordered.slice(0, 80)
    return ordered.slice(0, Math.max(INITIAL_COUNTRIES, priority.length))
  }, [locale, search, showAll])

  const heritageList = useMemo(() => {
    const q = heritageSearch.trim().toLowerCase()
    const filtered = allCountries.filter((country) => country.fifa_code !== nationalityFifa)
    if (!q) return filtered.slice(0, 40)
    return filtered
      .filter(
        (country) =>
          countryDisplayName(locale, country).toLowerCase().includes(q) ||
          country.name_es.toLowerCase().includes(q) ||
          country.name_en.toLowerCase().includes(q) ||
          country.fifa_code.toLowerCase().includes(q),
      )
      .slice(0, 40)
  }, [heritageSearch, locale, nationalityFifa])

  const heritageCountry = useMemo(
    () => allCountries.find((country) => country.fifa_code === heritageNationalityFifa) ?? null,
    [heritageNationalityFifa],
  )

  return (
    <section className="game-grid-shell">
      <Surface tone="strong" className="p-5 sm:p-7">
        <SectionEyebrow>{gameT('identity.section')}</SectionEyebrow>
        <SectionTitle as="h1" className="mt-2">{gameT('identity.title')}</SectionTitle>
        <p className="mb-7 mt-3 max-w-3xl text-sm leading-relaxed text-[color:var(--copero-muted)]">{gameT('identity.helper')}</p>

        <div className="grid gap-6 lg:grid-cols-3">
          <Surface className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <SectionEyebrow>{gameT('identity.section')}</SectionEyebrow>
              {selectedCountry && <GameBadge tone="accent">{countryDisplayName(locale, selectedCountry)}</GameBadge>}
            </div>
            <KitPreview
              lastName={lastName}
              number={preferredNumber}
              primary={selectedCountry?.kit_primary_color ?? selectedCountry?.primary_color}
              secondary={selectedCountry?.kit_secondary_color}
              tertiary={selectedCountry?.kit_tertiary_color}
            />
            <div className="grid grid-cols-[1fr_76px] gap-2">
              <label className="space-y-1 text-sm">
                <span className="text-[color:var(--copero-muted)]">{gameT('identity.lastName')}</span>
                <input
                  className={`${fieldClass} uppercase`}
                  value={lastName}
                  placeholder={gameT('identity.lastNamePlaceholder')}
                  onChange={(event) => setLastName(event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-[color:var(--copero-muted)]">{gameT('identity.number')}</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  className={fieldClass}
                  value={preferredNumber}
                  onChange={(event) => setPreferredNumber(Number(event.target.value) || 10)}
                />
              </label>
            </div>
            <div className="mt-4">
              <p className="mb-2 text-sm text-[color:var(--copero-muted)]">{gameT('identity.foot')}</p>
              <div className="flex gap-2">
                {(['left', 'right'] as const).map((foot) => (
                  <GameButton
                    key={foot}
                    type="button"
                    variant={preferredFoot === foot ? 'primary' : 'secondary'}
                    className="flex-1"
                    onClick={() => setPreferredFoot(foot)}
                  >
                    {gameT(foot === 'left' ? 'identity.left' : 'identity.right')}
                  </GameButton>
                ))}
              </div>
            </div>

            <StatusPanel tone="neutral" className="mt-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-[color:var(--copero-fg)]">{gameT('identity.heritage')}</div>
                  <div className="text-[11px] text-[color:var(--copero-muted)]">{gameT('identity.heritageHint')}</div>
                </div>
                <GameButton
                  type="button"
                  variant={heritageNationalityFifa || showHeritage ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setShowHeritage((current) => !current)}
                >
                  {gameT(showHeritage ? 'identity.close' : heritageNationalityFifa ? 'identity.change' : 'identity.optional')}
                </GameButton>
              </div>
              {heritageCountry && !showHeritage && (
                <div className="mt-3 flex items-center gap-2 text-sm text-[color:var(--copero-fg)]">
                  <img src={flagUrl(heritageCountry.iso_alpha2)} alt="" className="h-4 w-6 rounded-sm" />
                  {countryDisplayName(locale, heritageCountry)}
                  <GameButton type="button" variant="ghost" size="sm" className="ml-auto" onClick={() => setHeritageNationalityFifa(null)}>
                    {gameT('identity.remove')}
                  </GameButton>
                </div>
              )}
              {showHeritage && (
                <div className="mt-3 space-y-2">
                  <input
                    className={fieldClass}
                    placeholder={gameT('identity.search')}
                    value={heritageSearch}
                    onChange={(event) => setHeritageSearch(event.target.value)}
                  />
                  <div className="max-h-36 space-y-1 overflow-y-auto">
                    {heritageList.map((country) => (
                      <button
                        key={country.fifa_code}
                        type="button"
                        onClick={() => {
                          setHeritageNationalityFifa(country.fifa_code)
                          setShowHeritage(false)
                          setHeritageSearch('')
                        }}
                        className="flex w-full items-center gap-2 rounded-[var(--copero-radius)] px-2 py-2 text-left text-sm text-[color:var(--copero-muted)] transition hover:bg-[color:color-mix(in_oklch,var(--copero-fg)_6%,transparent)] hover:text-[color:var(--copero-fg)]"
                      >
                        <img src={flagUrl(country.iso_alpha2)} alt="" className="h-4 w-4 rounded-full" />
                        <span className="truncate">{countryDisplayName(locale, country)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </StatusPanel>
          </Surface>

          <Surface className="flex flex-col p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <SectionEyebrow>{gameT('identity.nationality')}</SectionEyebrow>
              {selectedCountry && <GameBadge tone="accent">✓ {countryDisplayName(locale, selectedCountry)}</GameBadge>}
            </div>
            <div className="relative mb-3">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--copero-muted)]">⌕</span>
              <input
                className={`${fieldClass} pl-9`}
                placeholder={gameT('identity.search')}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="max-h-[380px] flex-1 space-y-1 overflow-y-auto rounded-[var(--copero-radius)] border border-[color:var(--copero-border)] bg-[color:color-mix(in_oklch,var(--copero-bg)_54%,transparent)] p-2">
              {list.map((country) => {
                const selected = nationalityFifa === country.fifa_code
                return (
                  <button
                    key={country.fifa_code}
                    type="button"
                    onClick={() => {
                      setNationalityFifa(country.fifa_code)
                      if (heritageNationalityFifa === country.fifa_code) setHeritageNationalityFifa(null)
                    }}
                    className={`flex w-full items-center gap-3 rounded-[var(--copero-radius)] px-3 py-2 text-left text-sm transition ${
                      selected
                        ? 'bg-[color:color-mix(in_oklch,var(--copero-accent)_12%,transparent)] text-[color:var(--copero-fg)] ring-1 ring-[color:color-mix(in_oklch,var(--copero-accent)_38%,transparent)]'
                        : 'text-[color:var(--copero-muted)] hover:bg-[color:color-mix(in_oklch,var(--copero-fg)_5%,transparent)] hover:text-[color:var(--copero-fg)]'
                    }`}
                  >
                    <img src={flagUrl(country.iso_alpha2)} alt="" className="h-5 w-5 rounded-full object-cover" />
                    <span className="flex-1 truncate">{countryDisplayName(locale, country)}</span>
                    {selected && <span className="text-[color:var(--copero-accent)]">✓</span>}
                  </button>
                )
              })}
              {!search && !showAll && (
                <GameButton type="button" variant="ghost" size="sm" className="w-full" onClick={() => setShowAll(true)}>
                  {gameT('identity.more')}
                </GameButton>
              )}
            </div>
          </Surface>

          <Surface className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <SectionEyebrow>{gameT('identity.position')}</SectionEyebrow>
              {position && <GameBadge tone="accent">✓ {gameT(`position.${position}`)}</GameBadge>}
            </div>
            <PitchPositionPicker value={position} onChange={setPosition} />
            <p className="mt-3 text-center text-sm text-[color:var(--copero-muted)]">{gameT('identity.pitchHint')}</p>
          </Surface>
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--copero-border)] pt-5">
          {onBack ? (
            <GameButton type="button" variant="secondary" onClick={onBack}>
              {gameT('identity.back')}
            </GameButton>
          ) : (
            <span />
          )}
          <div className="flex flex-col items-end gap-2">
            {!canConfirm && <p className="text-xs font-semibold text-[color:var(--copero-gold)]">{gameT('identity.required')}</p>}
            <GameButton
              type="button"
              size="lg"
              disabled={!canConfirm}
              onClick={() => {
                if (!nationalityFifa || !position) return
                onSubmit({
                  lastName,
                  preferredNumber,
                  preferredFoot,
                  position,
                  nationalityFifa,
                  heritageNationalityFifa:
                    heritageNationalityFifa && heritageNationalityFifa !== nationalityFifa
                      ? heritageNationalityFifa
                      : null,
                })
              }}
            >
              {gameT('identity.confirm')}
            </GameButton>
          </div>
        </div>
      </Surface>
    </section>
  )
}
