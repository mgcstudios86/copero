import { AnimatedNumber } from './AnimatedNumber'

type Props = {
  overall: number
  size?: 'sm' | 'md' | 'lg'
  animate?: boolean
}

function tierClass(ovr: number): string {
  if (ovr >= 90) {
    return 'border-[color:color-mix(in_oklch,var(--copero-gold)_62%,white)] bg-[radial-gradient(circle_at_30%_18%,color-mix(in_oklch,var(--copero-gold)_82%,white),var(--copero-gold)_38%,#171005)] text-[#171005] game-gold-glow'
  }
  if (ovr >= 80) {
    return 'border-[color:color-mix(in_oklch,var(--copero-gold)_40%,var(--copero-border))] bg-[color:color-mix(in_oklch,var(--copero-gold)_18%,var(--copero-surface))] text-[color:var(--copero-gold)]'
  }
  if (ovr >= 70) {
    return 'border-[color:color-mix(in_oklch,var(--copero-fg)_22%,var(--copero-border))] bg-[color:color-mix(in_oklch,var(--copero-fg)_10%,var(--copero-surface))] text-[color:var(--copero-fg)]'
  }
  return 'border-[color:var(--copero-border)] bg-[color:color-mix(in_oklch,var(--copero-surface)_82%,black)] text-[color:var(--copero-muted)]'
}

export function OvrBadge({ overall, size = 'md', animate = true }: Props) {
  const sizeCls =
    size === 'lg'
      ? 'h-14 w-14 text-2xl'
      : size === 'sm'
        ? 'h-8 w-8 text-sm'
        : 'h-11 w-11 text-lg'

  return (
    <div
      className={`flex ${sizeCls} items-center justify-center rounded-[var(--copero-radius)] border font-[family-name:var(--copero-font-display)] font-black ${tierClass(overall)}`}
      title={`OVR ${overall}`}
    >
      {animate ? <AnimatedNumber value={overall} /> : Math.round(overall)}
    </div>
  )
}
