/**
 * Modo debug para QA: acelerar temporadas, inyectar stats, forzar game over.
 *
 * Activación:
 *  - localStorage.setItem('copero.debug', '1')
 *  - URL con `?debug=1` o `?debug=fast`
 *
 * Modos:
 *  - '1'    → panel visible, todas las utilidades habilitadas
 *  - 'fast' → avance automático de temporadas con un solo click
 *  - 'qa'   → QA mode con helpers de validación
 *  - otros  → modo debug libre
 */
import type { GameState, Player } from './types'
import { simulateOneSeason, shouldRetire } from './season'

export const DEBUG_STORAGE_KEY = 'copero.debug'

export type DebugMode = '1' | 'fast' | 'qa' | string

export function isDebugActive(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (window.localStorage.getItem(DEBUG_STORAGE_KEY)) return true
  } catch {
    // ignore
  }
  if (typeof window.location !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    if (params.has('debug')) return true
  }
  return false
}

export function getDebugMode(): DebugMode | null {
  if (typeof window === 'undefined') return null
  try {
    const flag = window.localStorage.getItem(DEBUG_STORAGE_KEY)
    if (flag) return flag
  } catch {
    // ignore
  }
  if (typeof window.location !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    const d = params.get('debug')
    if (d) return d
  }
  return null
}

export function setDebugMode(mode: DebugMode | null): void {
  if (typeof window === 'undefined') return
  try {
    if (mode === null) window.localStorage.removeItem(DEBUG_STORAGE_KEY)
    else window.localStorage.setItem(DEBUG_STORAGE_KEY, String(mode))
  } catch {
    // ignore
  }
}

/** Avanza N temporadas de un golpe; util para QA que valida finales de carrera. */
export function fastForwardSeasons(state: GameState, seasons: number = 5): GameState {
  let next: GameState = { ...state }
  for (let i = 0; i < seasons; i += 1) {
    if (!next.player || !next.contract) break
    const sim = simulateOneSeason(next)
    next = sim.state
    const retire = shouldRetire(next)
    if (retire.retire) break
  }
  return next
}

/** Inyecta stats al jugador: util para QA verificar eventos condicionales. */
export function injectPlayerStats(
  state: GameState,
  patch: Partial<{
    overall: number
    potential: number
    peakOverall: number
    wealth: number
    age: number
    attributes: Partial<Player['attributes']>
  }>,
): GameState {
  if (!state.player) return state
  const player = { ...state.player }
  if (patch.overall != null) player.overall = patch.overall
  if (patch.potential != null) player.potential = patch.potential
  if (patch.peakOverall != null) player.peakOverall = patch.peakOverall
  if (patch.wealth != null) player.wealth = patch.wealth
  if (patch.age != null) player.age = patch.age
  if (patch.attributes) player.attributes = { ...player.attributes, ...patch.attributes }
  return { ...state, player }
}

/** Fuerza condicion de game over. */
export function forceRetire(state: GameState, reason: 'age' | 'no_offers' | 'medical' | 'ruined'): GameState {
  return {
    ...state,
    phase: 'summary',
    currentEvent: {
      type: 'retire',
      title: 'Debug · Retiro forzado',
      body: `QA inyecto game over (${reason}).`,
      reason,
    },
  }
}

/** Reset completo del save — limpia localStorage. */
export function clearAllSaves(): void {
  if (typeof window === 'undefined') return
  try {
    const keys: string[] = []
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (key && (key.startsWith('copero.') || key.startsWith('copero-'))) keys.push(key)
    }
    keys.forEach((key) => window.localStorage.removeItem(key))
  } catch {
    // ignore
  }
}
