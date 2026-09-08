import { useState } from 'react'
import {
  clearAllSaves,
  fastForwardSeasons,
  forceRetire,
  injectPlayerStats,
  isDebugActive,
  setDebugMode,
} from '../../engine/debug'
import { saveState } from '../../engine/state'
import type { GameState } from '../../engine/types'

/**
 * Panel de debug para QA. Solo se renderiza si el modo debug esta activo
 * (localStorage.copero.debug o query param ?debug=1).
 *
 * Capacidades:
 *  - Avanzar N temporadas (default 5) sin pasar por la UI
 *  - Inyectar OVR, edad, wealth
 *  - Forzar game over (4 razones)
 *  - Limpiar todos los saves
 *  - Desactivar modo debug
 */
export function DebugPanel({
  state,
  onChange,
}: {
  state: GameState
  onChange: (next: GameState) => void
}) {
  const [open, setOpen] = useState(true)
  const [seasonStep, setSeasonStep] = useState(5)

  if (!isDebugActive()) return null

  const apply = (next: GameState) => {
    saveState(next)
    onChange(next)
  }

  const fastForward = () => {
    apply(fastForwardSeasons(state, seasonStep))
  }

  const boostOvr = () => {
    apply(injectPlayerStats(state, { overall: 88, potential: 92, peakOverall: 88 }))
  }

  const ageUp = (years: number) => {
    if (!state.player) return
    apply(injectPlayerStats(state, { age: state.player.age + years }))
  }

  const forceEnd = (reason: 'age' | 'no_offers' | 'medical' | 'ruined') => {
    apply(forceRetire(state, reason))
  }

  const resetSaves = () => {
    clearAllSaves()
    window.location.reload()
  }

  const disableDebug = () => {
    setDebugMode(null)
    window.location.reload()
  }

  return (
    <div
      data-testid="debug-panel"
      className="fixed bottom-4 right-4 z-50 w-[320px] max-w-[95vw] rounded-2xl border border-amber-500/50 bg-zinc-950/95 p-3 text-xs text-zinc-100 shadow-2xl backdrop-blur"
      style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-black uppercase tracking-wide text-amber-400">🛠 QA Debug</span>
        <button
          type="button"
          className="rounded px-2 py-1 text-[10px] uppercase hover:bg-zinc-800"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'ocultar' : 'mostrar'}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="text-[10px] text-zinc-400">
            fase: <span className="text-amber-300">{state.phase}</span> · step{' '}
            <span className="text-amber-300">{state.step}</span> · temporadas{' '}
            <span className="text-amber-300">{state.seasons.length}</span>
            {state.player && (
              <>
                {' · '}
                edad <span className="text-amber-300">{state.player.age}</span>
                {' · '}
                ovr <span className="text-amber-300">{state.player.overall}</span>
              </>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] uppercase text-zinc-400">Avanzar N temporadas</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={30}
                value={seasonStep}
                onChange={(e) => setSeasonStep(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                className="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
              />
              <button
                type="button"
                className="flex-1 rounded bg-amber-600 px-2 py-1 text-[11px] font-bold uppercase hover:bg-amber-500"
                onClick={fastForward}
                disabled={!state.player || !state.contract}
              >
                ▶ Fast-forward
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              className="rounded bg-emerald-700 px-2 py-1 text-[11px] font-bold uppercase hover:bg-emerald-600"
              onClick={boostOvr}
              disabled={!state.player}
            >
              ↑ OVR 88
            </button>
            <button
              type="button"
              className="rounded bg-emerald-700 px-2 py-1 text-[11px] font-bold uppercase hover:bg-emerald-600"
              onClick={() => ageUp(5)}
              disabled={!state.player}
            >
              +5 años
            </button>
          </div>

          <div className="space-y-1">
            <span className="block text-[10px] uppercase text-zinc-400">Forzar game over</span>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                className="rounded bg-rose-700 px-2 py-1 text-[10px] font-bold uppercase hover:bg-rose-600"
                onClick={() => forceEnd('age')}
              >
                age
              </button>
              <button
                type="button"
                className="rounded bg-rose-700 px-2 py-1 text-[10px] font-bold uppercase hover:bg-rose-600"
                onClick={() => forceEnd('medical')}
              >
                medical
              </button>
              <button
                type="button"
                className="rounded bg-rose-700 px-2 py-1 text-[10px] font-bold uppercase hover:bg-rose-600"
                onClick={() => forceEnd('no_offers')}
              >
                no_offers
              </button>
              <button
                type="button"
                className="rounded bg-rose-700 px-2 py-1 text-[10px] font-bold uppercase hover:bg-rose-600"
                onClick={() => forceEnd('ruined')}
              >
                ruined
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1 border-t border-zinc-800 pt-2">
            <button
              type="button"
              className="rounded bg-zinc-800 px-2 py-1 text-[10px] uppercase hover:bg-zinc-700"
              onClick={resetSaves}
            >
              🗑 Limpiar saves
            </button>
            <button
              type="button"
              className="rounded bg-zinc-800 px-2 py-1 text-[10px] uppercase hover:bg-zinc-700"
              onClick={disableDebug}
            >
              ✕ Salir debug
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
