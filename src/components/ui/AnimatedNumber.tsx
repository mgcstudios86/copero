import { useEffect, useRef, useState } from 'react'

type Props = {
  value: number
  durationMs?: number
  className?: string
  format?: (n: number) => string
  bumpClassName?: string
}

export function AnimatedNumber({
  value,
  durationMs = 480,
  className = '',
  format = (n) => String(Math.round(n)),
  bumpClassName = 'ovr-bump',
}: Props) {
  const [display, setDisplay] = useState(value)
  const [bump, setBump] = useState(false)
  const fromRef = useRef(value)
  const rafRef = useRef(0)

  useEffect(() => {
    const from = fromRef.current
    if (from === value) {
      setDisplay(value)
      return
    }
    setBump(true)
    const start = performance.now()
    const delta = value - from
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(from + delta * eased)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else {
        fromRef.current = value
        setDisplay(value)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    const bumpTimer = window.setTimeout(() => setBump(false), 450)
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.clearTimeout(bumpTimer)
    }
  }, [value, durationMs])

  return (
    <span className={`${className} ${bump ? bumpClassName : ''}`.trim()}>
      {format(display)}
    </span>
  )
}
