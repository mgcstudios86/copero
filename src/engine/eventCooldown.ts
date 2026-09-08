import type { CareerEventDef, GameState } from './types'

export const STORAGE_PREFIX = 'simulador:career:play:v2:'
export const LAST_SAVE_KEY = 'simulador:career:last-save:v2'
const EVENT_HISTORY_PREFIX = 'simulador:career:event-history:v1:'

export type CareerEventHistoryEntry = {
  eventId: string
  seasonIndex: number
  age: number
}

const ONCE_PER_CAREER = new Set([
  'position_change',
  'scout_discovery',
  'iron_genetics',
  'miracle_doctor',
  'media_scandal',
  'career_ending_injury',
  'agent_scam',
  'doping_temptation',
  'ar_ascenso_opportunity',
  'eu_adaptation',
  'mena_exit_clause',
  'mls_adaptation',
])

const EVENT_COOLDOWN_OVERRIDES: Record<string, number> = {
  training_extra: 4,
  rival_offer: 4,
  club_crisis: 7,
  mysterious_substance: 8,
  final_hattrick: 8,
  mx_food_poisoning: 6,
  br_carnival_break: 6,
}

const EVENT_GROUPS: Record<string, string> = {
  mysterious_substance: 'high_risk',
  media_scandal: 'high_risk',
  career_ending_injury: 'high_risk',
  agent_scam: 'high_risk',
  doping_temptation: 'high_risk',
  mx_food_poisoning: 'high_risk',
  br_calendar_fatigue: 'high_risk',
  concacaf_heat: 'high_risk',
  rival_offer: 'transfer_pressure',
  club_crisis: 'transfer_pressure',
  br_rival_serie_a: 'transfer_pressure',
  mena_exit_clause: 'transfer_pressure',
  scout_discovery: 'spotlight',
  final_hattrick: 'spotlight',
  mx_clasico_pressure: 'spotlight',
  ar_media_pressure: 'spotlight',
  ar_clasico_week: 'spotlight',
}

const GROUP_COOLDOWNS: Record<string, number> = {
  high_risk: 3,
  transfer_pressure: 2,
  spotlight: 2,
}

function parseHistory(raw: string | null): CareerEventHistoryEntry[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is CareerEventHistoryEntry => {
      if (!entry || typeof entry !== 'object') return false
      const value = entry as Partial<CareerEventHistoryEntry>
      return (
        typeof value.eventId === 'string' &&
        typeof value.seasonIndex === 'number' &&
        typeof value.age === 'number'
      )
    })
  } catch {
    return []
  }
}

function readHistory(seed: string): CareerEventHistoryEntry[] {
  if (typeof localStorage === 'undefined') return []
  try {
    return parseHistory(localStorage.getItem(`${EVENT_HISTORY_PREFIX}${seed}`))
  } catch {
    return []
  }
}

function latestCareerSnapshot(): {
  seed: string
  currentSeason: number
  history: CareerEventHistoryEntry[]
} | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const seed = localStorage.getItem(LAST_SAVE_KEY)
    if (!seed) return null
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${seed}`)
    if (!raw) return null
    const stored = JSON.parse(raw) as Pick<GameState, 'seasons'>
    return {
      seed,
      currentSeason: stored.seasons?.length ?? 0,
      history: readHistory(seed),
    }
  } catch {
    return null
  }
}

function eventCooldownSeasons(event: CareerEventDef): number {
  return EVENT_COOLDOWN_OVERRIDES[event.id] ?? (event.regional ? 4 : 5)
}

function lastOccurrence(
  history: CareerEventHistoryEntry[],
  eventId: string,
): CareerEventHistoryEntry | undefined {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index]
    if (entry?.eventId === eventId) return entry
  }
  return undefined
}

function groupIsCoolingDown(
  history: CareerEventHistoryEntry[],
  eventId: string,
  currentSeason: number,
): boolean {
  const group = EVENT_GROUPS[eventId]
  if (!group) return false
  const cooldown = GROUP_COOLDOWNS[group] ?? 0
  if (cooldown <= 0) return false

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index]
    if (!entry) continue
    if (EVENT_GROUPS[entry.eventId] !== group) continue
    return currentSeason - entry.seasonIndex < cooldown
  }
  return false
}

export function filterCareerEventsByCooldown(events: CareerEventDef[]): CareerEventDef[] {
  const snapshot = latestCareerSnapshot()
  if (!snapshot || snapshot.history.length === 0) return events

  const { currentSeason, history } = snapshot
  const lastEventId = history[history.length - 1]?.eventId

  return events.filter((event) => {
    if (event.id === lastEventId) return false
    if (ONCE_PER_CAREER.has(event.id) && history.some((entry) => entry.eventId === event.id)) {
      return false
    }

    const previous = lastOccurrence(history, event.id)
    if (previous && currentSeason - previous.seasonIndex < eventCooldownSeasons(event)) {
      return false
    }

    return !groupIsCoolingDown(history, event.id, currentSeason)
  })
}

export function recordActiveCareerEvent(state: GameState): void {
  if (
    typeof localStorage === 'undefined' ||
    state.currentEvent?.type !== 'career_choice' ||
    !state.player
  ) {
    return
  }

  try {
    const history = readHistory(state.seed)
    const entry: CareerEventHistoryEntry = {
      eventId: state.currentEvent.eventId,
      seasonIndex: state.seasons.length,
      age: state.player.age,
    }
    const alreadyRecorded = history.some(
      (item) => item.eventId === entry.eventId && item.seasonIndex === entry.seasonIndex,
    )
    if (alreadyRecorded) return

    localStorage.setItem(
      `${EVENT_HISTORY_PREFIX}${state.seed}`,
      JSON.stringify([...history, entry].slice(-64)),
    )
  } catch {
    // Ignore storage failures; the game remains playable without cooldown persistence.
  }
}

export function clearCareerEventHistory(seed: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(`${EVENT_HISTORY_PREFIX}${seed}`)
  } catch {
    // ignore
  }
}
