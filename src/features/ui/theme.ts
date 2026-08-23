/**
 * Compat shim — re-exports tokens desde `@/design` (MGC-297) para callers
 * legados del compass (MGC-321 C1) que importaban desde `@/features/ui/theme`.
 * Conserva nombres planos (`colors`, `radii`, `spacing`) y mapea claves legacy
 * (`bgElev`, `muted`, `textDim`, `card`, `accent`, `primary`, `primaryFg`,
 * `danger`, `warning`) al `ColorScale` del design system.
 *
 * Para código nuevo, usar `useTheme()` o los tokens de `@/design` directamente.
 */
import { palette } from '@/design/tokens';
import type { ColorScale } from '@/design/tokens';

const baseDark = palette.dark;

export const colors: ColorScale & {
  bgElev: string;
  card: string;
  primaryFg: string;
  muted: string;
  textDim: string;
  accent: string;
} = {
  ...baseDark,
  bgElev: baseDark.surface2,
  card: baseDark.surface,
  primaryFg: baseDark.textOnPrimary,
  muted: baseDark.textMuted,
  textDim: baseDark.textMuted,
  accent: baseDark.accent,
};

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
