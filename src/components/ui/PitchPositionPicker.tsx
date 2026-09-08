import type { Position } from '../../engine/types'
import { PITCH_LAYOUT } from './positions'

export function PitchPositionPicker({
  value,
  onChange,
}: {
  value: Position | null
  onChange: (p: Position) => void
}) {
  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[var(--copero-radius-lg)] border border-[color:var(--copero-border)] bg-[color:var(--color-pitch)] shadow-[inset_0_0_80px_rgba(0,0,0,.25)]">
      <div className="absolute inset-3">
        <img
          src="/career-simulator/pitch.svg"
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-25"
        />
        <div
          className="pointer-events-none absolute inset-0 rounded-[var(--copero-radius)] border border-[color:var(--color-pitch-line)]"
          style={{
            backgroundImage:
              'linear-gradient(transparent 49.5%, rgba(255,255,255,.15) 49.5%, rgba(255,255,255,.15) 50.5%, transparent 50.5%), radial-gradient(circle at 50% 50%, transparent 11%, rgba(255,255,255,.12) 11.5%, transparent 12.5%)',
          }}
        />
        {PITCH_LAYOUT.map((slot) => {
          const selected = value === slot.id
          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => onChange(slot.id)}
              style={{ top: slot.top, left: slot.left }}
              className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border px-2 py-1 font-[family-name:var(--copero-font-mono)] text-[11px] font-black transition duration-150 ${
                selected
                  ? 'z-20 scale-110 border-[color:var(--copero-accent)] bg-[color:var(--copero-accent)] text-[color:var(--copero-bg)] shadow-[0_0_20px_color-mix(in_oklch,var(--copero-accent)_38%,transparent)]'
                  : 'border-white/20 bg-black/65 text-white hover:scale-105 hover:border-white/40 hover:bg-black/80'
              }`}
            >
              {slot.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
