import type { Position } from '../../engine/types'

export const POSITION_LABELS: Record<Position, string> = {
  GK: 'GK',
  CB: 'CB',
  LB: 'LB',
  RB: 'RB',
  CDM: 'CDM',
  CM: 'CM',
  CAM: 'CAM',
  LM: 'LM',
  RM: 'RM',
  LW: 'LW',
  RW: 'RW',
  ST: 'ST',
}

/** Pitch layout: coords relative to inset pitch area (top = attack). */
export const PITCH_LAYOUT: { id: Position; label: string; top: string; left: string }[] = [
  { id: 'LW', label: 'LW', top: '14%', left: '22%' },
  { id: 'ST', label: 'ST', top: '12%', left: '50%' },
  { id: 'RW', label: 'RW', top: '14%', left: '78%' },
  { id: 'LM', label: 'LM', top: '32%', left: '22%' },
  { id: 'CAM', label: 'CAM', top: '32%', left: '50%' },
  { id: 'RM', label: 'RM', top: '32%', left: '78%' },
  { id: 'CM', label: 'CM', top: '48%', left: '50%' },
  { id: 'CDM', label: 'CDM', top: '60%', left: '50%' },
  { id: 'LB', label: 'LB', top: '74%', left: '22%' },
  { id: 'CB', label: 'CB', top: '74%', left: '50%' },
  { id: 'RB', label: 'RB', top: '74%', left: '78%' },
  { id: 'GK', label: 'GK', top: '88%', left: '50%' },
]

export function positionLabel(pos: Position): string {
  return POSITION_LABELS[pos] ?? pos
}

export function shortClubName(name: string): string {
  if (name.length <= 18) return name
  return name
    .replace(/^Club Atlético /i, '')
    .replace(/^Club Deportivo /i, '')
    .replace(/^Asociación Atlética /i, '')
    .slice(0, 18)
}
