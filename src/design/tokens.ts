/**
 * Design tokens — Copero nativo (MGC-297, integración de MGC-292).
 * Fuente: `discovery/design/tokens.json` del design system entregado por designer.
 * Adaptado a React Native: colores hex, spacing/font-size numéricos (base 16),
 * radius en px, motion en ms.
 *
 * Identidad propia — no usa assets ni tipografías del original copero.com.ar.
 * Tipografías open source: Space Grotesk (display) · DM Sans (body) · JetBrains Mono (mono).
 */

export type ColorScale = {
  bg: string;
  surface: string;
  surface2: string;
  overlay: string;
  text: string;
  textStrong: string;
  textMuted: string;
  textOnPrimary: string;
  textOnAccent: string;
  border: string;
  borderStrong: string;
  primary: string;
  primaryHover: string;
  primarySoft: string;
  accent: string;
  accentHover: string;
  accentSoft: string;
  focus: string;
  focusSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
};

export const palette = {
  light: {
    bg: '#FAF7F2',
    surface: '#FFFFFF',
    surface2: '#F0EAE0',
    overlay: 'rgba(22,32,26,0.55)',
    text: '#16201A',
    textStrong: '#0A120E',
    textMuted: '#4A5750',
    textOnPrimary: '#FFFFFF',
    textOnAccent: '#FFFFFF',
    border: '#D8CFC0',
    borderStrong: '#A89E8C',
    primary: '#1F6F4A',
    primaryHover: '#18573B',
    primarySoft: '#D9ECE2',
    accent: '#C73E2A',
    accentHover: '#A52F1F',
    accentSoft: '#F8DFDB',
    focus: '#2563EB',
    focusSoft: '#BFD4FF',
    success: '#1F6F4A',
    successSoft: '#D9ECE2',
    warning: '#B45309',
    warningSoft: '#FCEAC5',
    danger: '#B91C1C',
    dangerSoft: '#FBD9D9',
    info: '#1E40AF',
    infoSoft: '#D6E1FB',
  } as ColorScale,
  dark: {
    bg: '#0E1411',
    surface: '#16201A',
    surface2: '#1F2A24',
    overlay: 'rgba(0,0,0,0.65)',
    text: '#F0EAE0',
    textStrong: '#FFFFFF',
    textMuted: '#B8C2BC',
    textOnPrimary: '#0E1411',
    textOnAccent: '#FFFFFF',
    border: '#2E3A33',
    borderStrong: '#506259',
    primary: '#4FBE82',
    primaryHover: '#6DD09A',
    primarySoft: '#1B3A2B',
    accent: '#E96A56',
    accentHover: '#F08A78',
    accentSoft: '#4A2118',
    focus: '#93C5FD',
    focusSoft: '#1E3A8A',
    success: '#4FBE82',
    successSoft: '#1B3A2B',
    warning: '#FBBF24',
    warningSoft: '#4A3712',
    danger: '#F87171',
    dangerSoft: '#4A1A1A',
    info: '#93C5FD',
    infoSoft: '#1E3A8A',
  } as ColorScale,
} as const;

export type ThemeMode = 'light' | 'dark';

export const colors = (mode: ThemeMode): ColorScale => palette[mode];

export const radii = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  pill: 9999,
} as const;

export const spacing = {
  '0': 0,
  '1': 4,
  '2': 8,
  '3': 12,
  '4': 16,
  '5': 24,
  '6': 32,
  '7': 40,
  '8': 48,
  '10': 64,
  '12': 96,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  md: 18,
  lg: 20,
  xl: 24,
  '2xl': 30,
  '3xl': 36,
  '4xl': 48,
  display: 64,
} as const;

export const lineHeight = {
  tight: 1.1,
  snug: 1.25,
  base: 1.5,
  loose: 1.7,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const fontFamily = {
  display: 'SpaceGrotesk',
  body: 'DMSans',
  mono: 'JetBrainsMono',
} as const;

export const motion = {
  duration: {
    fast: 120,
    base: 200,
    slow: 320,
  },
  easing: {
    // cubic-bezier no soportado directo en RN Animated; usamos strings estándar
    // y dejamos los tokens disponibles para Reanimated / LayoutAnimation.
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    emph: 'cubic-bezier(0.32, 0.72, 0, 1)',
    decel: 'cubic-bezier(0, 0, 0.2, 1)',
  },
} as const;

export const tapTarget = 44;

export const borderWidth = {
  hairline: 1,
  chip: 1.5,
  thick: 2,
} as const;

export const elevation = {
  none: 0,
  sm: 1,
  md: 4,
  lg: 12,
} as const;
