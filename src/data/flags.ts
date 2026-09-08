export function flagUrl(isoAlpha2: string): string {
  return `/media/flags/4x3/${isoAlpha2.toLowerCase()}.svg`
}
