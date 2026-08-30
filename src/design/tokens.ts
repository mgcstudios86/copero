/**
 * Design tokens — Copero nativo (MGC-297, integración de MGC-292).
 * Fuente: `discovery/design/tokens.json` del design system entregado por designer.
 * Adaptado a React Native: colores hex, spacing/font-size numéricos (base 16),
 * radius en px, motion en ms.
 *
 * Identidad propia — no usa assets ni tipografías del original copero.com.ar.
 *
 * MGC-555 PR1 — Migración parcial a copero.com.ar spec visual
 * (MGC-554). Se agrega `palette.copero` (dark zinc-950 + accent heredado
 * de `palette.dark`), se reemplaza `fontFamily` por Inter/Poppins y se
 * preserva la paleta light existente para no romper el contrato C1/C2.
 * Tipografías open source: Inter (body) · Poppins (headings) · JetBrains Mono (mono).
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
  accentDeep: string;
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
    accentDeep: '#7E1F11',  // coral-800 — superficie coral con texto blanco WCAG AA
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
    accentDeep: '#9F2D1E',  // coral oscuro dark — superficie con texto blanco WCAG AA
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

export type ThemeMode = 'light' | 'dark' | 'copero';

/**
 * `palette.copero` — dark-first alineado con `design/copero-ar-visual-spec.md`
 * §3.1 (roles semánticos del theme dark activo de copero.com.ar). Coexiste con
 * `palette.dark` (identidad propia verde forest) sin romper el contrato C1.
 */
const coperoPalette: ColorScale = {
  bg: '#09090B',           // zinc-950
  surface: '#101012',      // zinc-900 (cards)
  surface2: '#131316',     // popover / overlays
  overlay: 'rgba(0,0,0,0.85)',
  text: '#FAFAFA',         // foreground
  textStrong: '#FFFFFF',
  textMuted: '#A1A1AA',    // zinc-400
  textOnPrimary: '#09090B',
  textOnAccent: '#FFFFFF',
  border: '#1C1C20',
  borderStrong: '#27272A',
  // MGC-396 / MGC-397: verde brillante para CTAs / highlights / chips (match
  // con fotos de referencia MGC-11). Antes era pill blanco — eso explicaba
  // que las CTAs (incluido el botón Jugar del home) se vieran blancas y el
  // operador reportara "sigue distinta a la foto". `textOnPrimary=#09090B`
  // da contraste WCAG AA sobre `#22C55E` (4.5:1+). Ver
  // `mgc-396-refs/COMPARATIVA.md` §Tokens visuales y ticket MGC-397 AC #3.
  primary: '#22C55E',      // green-500 — CTA, chips, highlights, eyebrows
  primaryHover: '#4ADE80', // green-400 — pressed/hover
  primarySoft: '#052E1B',  // green-950 tint — fondo POTENCIAL box / highlight
  accent: '#A855F7',       // purple-500 (default archetype accent)
  accentHover: '#C084FC',
  accentDeep: '#7E22CE',   // purple-700 — superficies que sostienen texto blanco (WCAG AA)
  accentSoft: '#3B0764',
  focus: '#D4D4D8',        // zinc-300
  focusSoft: '#3F3F46',
  success: '#10B981',      // emerald-500
  successSoft: '#064E3B',
  warning: '#EAB308',      // yellow-500
  warningSoft: '#713F12',
  danger: '#EF4444',       // red-500
  dangerSoft: '#7F1D1D',
  info: '#06B6D4',         // cyan-500
  infoSoft: '#164E63',
};

export const colors = (mode: ThemeMode): ColorScale => {
  if (mode === 'copero') return coperoPalette;
  return palette[mode];
};

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

/**
 * Familias tipográficas — MGC-555 PR1.
 * Spec copero.com.ar §4: Inter (body / UI), Poppins (headings / números),
 * JetBrains Mono (code / datos). Se mantienen los `fontFamilyKey` previos
 * (`display`, `body`, `mono`) para no romper consumidores C1/C2; cambia
 * el valor de las dos primeras familias.
 *
 * En web, las fuentes se cargan vía `<link>` de Google Fonts en
 * `app/_layout.tsx` (preconnect + display=swap). En nativo, se cargan
 * con `expo-font` (`Font.loadAsync`) antes del primer render.
 */
export const fontFamily = {
  display: 'Poppins',
  body: 'Inter',
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

/**
 * Paleta por país — simulador-carrera (MGC-465).
 * Documentación canónica: `design/simulador-carrera/assets/tokens-pais.md`.
 * Contraste dorsal/jersey verificado AA WCAG 2.x (todos ≥ 4.5:1).
 * 12 países top + slot `unknown` para códigos fuera del set.
 */
export type CountryPalette = {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  dorsal: string;
  pattern: 'vertical-thin' | 'canarinho' | 'block' | 'azzurri' | 'three-lions' | 'celeste' | 'three-stripes';
  label: string;
};

export const countryPalette: Record<string, CountryPalette> = {
  AR: { name: 'Argentina',  primary: '#75AADB', secondary: '#FFFFFF', accent: '#1A3A5C', dorsal: '#0B1F36', pattern: 'vertical-thin', label: 'ALBICELESTE' },
  BR: { name: 'Brasil',     primary: '#FFDF00', secondary: '#009C3B', accent: '#002776', dorsal: '#0B2A52', pattern: 'canarinho',     label: 'CANARINHO' },
  ES: { name: 'España',     primary: '#AA151B', secondary: '#F1BF00', accent: '#FFFFFF', dorsal: '#FFFFFF', pattern: 'block',         label: 'LA ROJA' },
  FR: { name: 'Francia',    primary: '#002654', secondary: '#FFFFFF', accent: '#ED2939', dorsal: '#FFFFFF', pattern: 'block',         label: 'LES BLEUS' },
  IT: { name: 'Italia',     primary: '#0066B3', secondary: '#FFFFFF', accent: '#FFFFFF', dorsal: '#FFFFFF', pattern: 'azzurri',       label: 'GLI AZZURRI' },
  EN: { name: 'Inglaterra', primary: '#FFFFFF', secondary: '#CE1124', accent: '#1A1A1A', dorsal: '#7A0A18', pattern: 'three-lions',   label: 'THREE LIONS' },
  UY: { name: 'Uruguay',    primary: '#5EB5E2', secondary: '#FFFFFF', accent: '#1A1A4D', dorsal: '#0E0E3A', pattern: 'celeste',       label: 'CELESTE' },
  CL: { name: 'Chile',      primary: '#D52B1E', secondary: '#FFFFFF', accent: '#0033A0', dorsal: '#FFFFFF', pattern: 'block',         label: 'LA ROJA' },
  CO: { name: 'Colombia',   primary: '#FCD116', secondary: '#003893', accent: '#CE1126', dorsal: '#0A1F4A', pattern: 'block',         label: 'TRICOLOR' },
  MX: { name: 'México',     primary: '#006847', secondary: '#FFFFFF', accent: '#CE1126', dorsal: '#FFFFFF', pattern: 'block',         label: 'TRICOLOR' },
  DE: { name: 'Alemania',   primary: '#FFFFFF', secondary: '#1A1A1A', accent: '#DD0000', dorsal: '#0A0A0A', pattern: 'three-stripes', label: 'DIE MANNSCHAFT' },
  PT: { name: 'Portugal',   primary: '#DA291C', secondary: '#006633', accent: '#FFD200', dorsal: '#FFFFFF', pattern: 'block',         label: 'SELEÇÃO' },
  unknown: { name: 'Sin equipo', primary: '#3A4047', secondary: '#2A2F35', accent: '#F0EAE0', dorsal: '#F0EAE0', pattern: 'block', label: 'SIN EQUIPO' },
};

export function getCountryPalette(code: string): CountryPalette {
  return countryPalette[code] ?? countryPalette.unknown;
}
