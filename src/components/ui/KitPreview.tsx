function luminance(hex: string): number {
  const h = hex.replace('#', '')
  if (h.length !== 6) return 0
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function normalizeHex(c?: string | null, fallback = '#9ca3af'): string {
  if (!c) return fallback
  const t = c.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t
  if (/^[0-9a-fA-F]{6}$/.test(t)) return `#${t}`
  return fallback
}

function nearWhite(hex: string): boolean {
  return luminance(hex) > 0.85
}

function nearSame(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

export function KitPreview({
  lastName,
  number,
  primary,
  secondary,
  tertiary,
}: {
  lastName: string
  number: number
  primary?: string | null
  secondary?: string | null
  tertiary?: string | null
}) {
  const hasCountry = Boolean(primary || secondary)
  const p = normalizeHex(primary, hasCountry ? '#6b7280' : '#d1d5db')
  const s = normalizeHex(secondary, hasCountry ? '#ffffff' : '#f3f4f6')
  const t = normalizeHex(tertiary, '#111111')
  const solid = nearSame(p, s) || (nearWhite(s) && nearWhite(p))
  const ink = luminance(solid ? p : s) > 0.55 ? '#111111' : '#ffffff'
  const display = (lastName.trim() || '—').toUpperCase().slice(0, 12)
  const patternId = `kit-${p.replace('#', '')}-${s.replace('#', '')}`

  return (
    <div className="relative mx-auto aspect-[3/4] w-full max-w-[240px] transition-all duration-300">
      <svg viewBox="0 0 200 260" className="h-full w-full drop-shadow-xl">
        <defs>
          <pattern id={patternId} width="16" height="16" patternUnits="userSpaceOnUse">
            <rect width="8" height="16" fill={p} />
            <rect x="8" width="8" height="16" fill={s} />
          </pattern>
          <clipPath id="kitBodyClip">
            <path d="M40 40 L60 28 L140 28 L160 40 L168 70 L155 85 L155 230 Q100 245 45 230 L45 85 L32 70 Z" />
          </clipPath>
        </defs>
        <path
          d="M40 40 L60 28 L140 28 L160 40 L168 70 L155 85 L155 230 Q100 245 45 230 L45 85 L32 70 Z"
          fill={solid || !hasCountry ? p : `url(#${patternId})`}
          stroke="#111"
          strokeWidth="3"
        />
        {solid && hasCountry && (
          <rect
            x="70"
            y="100"
            width="60"
            height="90"
            fill={t}
            opacity={0.35}
            clipPath="url(#kitBodyClip)"
          />
        )}
        {!hasCountry && (
          <rect
            x="70"
            y="100"
            width="60"
            height="90"
            fill="rgba(255,255,255,0.45)"
            clipPath="url(#kitBodyClip)"
          />
        )}
        <path d="M60 28 L70 55 L100 48 L130 55 L140 28" fill={t} opacity="0.95" />
        <path d="M45 85 L32 70 L28 95 L45 110 Z" fill={t} />
        <path d="M155 85 L168 70 L172 95 L155 110 Z" fill={t} />
        <text
          x="100"
          y="130"
          textAnchor="middle"
          fill={ink}
          style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1 }}
        >
          {display}
        </text>
        <text
          x="100"
          y="175"
          textAnchor="middle"
          fill={ink}
          style={{ fontSize: 48, fontWeight: 900 }}
        >
          {number}
        </text>
      </svg>
    </div>
  )
}
