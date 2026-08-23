/**
 * Tokens visuales compartidos.
 * Mantenerlo plano: cualquier primitiva UI lee de acá.
 */
export const colors = {
  bg: '#0f172a',
  bgElev: '#1e293b',
  card: '#1e293b',
  border: '#334155',
  primary: '#22c55e',
  primaryFg: '#052e16',
  danger: '#ef4444',
  warning: '#f59e0b',
  muted: '#94a3b8',
  text: '#f1f5f9',
  textDim: '#cbd5e1',
} as const;

export const radii = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const fonts = {
  body: 'System',
  display: 'System',
} as const;
