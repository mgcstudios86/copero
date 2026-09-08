/** Mulberry32 deterministic RNG */
export function seedToState(seed: string): number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return h >>> 0
}

export function nextRng(state: number): { state: number; value: number } {
  let t = (state + 0x6d2b79f5) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return { state: t >>> 0, value }
}

export function randomInt(state: number, min: number, max: number) {
  const r = nextRng(state)
  const value = min + Math.floor(r.value * (max - min + 1))
  return { state: r.state, value }
}

export function pickWeighted<T>(state: number, items: { item: T; weight: number }[]) {
  const total = items.reduce((s, x) => s + Math.max(0, x.weight), 0)
  if (total <= 0) {
    const r = nextRng(state)
    return { state: r.state, item: items[items.length - 1]?.item }
  }
  const r = nextRng(state)
  let acc = 0
  const target = r.value * total
  for (const entry of items) {
    acc += Math.max(0, entry.weight)
    if (target <= acc) return { state: r.state, item: entry.item }
  }
  return { state: r.state, item: items[items.length - 1].item }
}

export function pickOne<T>(state: number, items: T[]) {
  if (items.length === 0) throw new Error('pickOne: empty')
  const r = randomInt(state, 0, items.length - 1)
  return { state: r.state, item: items[r.value] }
}

export function createSeed(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
