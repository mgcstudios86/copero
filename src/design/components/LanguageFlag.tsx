/**
 * LanguageFlag — MGC-491 (flow i18n es/en/pt).
 *
 * Bandera como gradiente CSS puro (sin assets). 24×16 por default, escala
 * vía prop `size`. Cada locale mapea a un `linear-gradient` que aproxima
 * los colores oficiales.
 *
 * - ES 🇦🇷: `linear-gradient(to bottom, #74ACDF 33%, #FFFFFF 33% 66%, #74ACDF 66%)`
 * - EN 🇬🇧: `linear-gradient(135deg, #012169 25%, #FFFFFF 25% 50%, #C8102E 50% 75%, #FFFFFF 75%)`
 * - PT 🇵🇹: `linear-gradient(to right, #046A38 40%, #FFE15A 40% 60%, #DA291C 60%)`
 *
 * A11y:
 * - `accessibilityRole="image"` + `accessibilityLabel` localizado.
 *
 * Notas de implementación:
 * - Web: el array de stops se traduce a un `linear-gradient(...)` en el
 *   style inline. RN-Web lo aplica vía `backgroundImage`.
 * - Nativo: capas apiladas con flex direction row/column. Para EN usamos
 *   una aproximación de bandas superpuestas (la fidelidad exacta del
 *   Union Jack requeriría un asset — el handoff acepta aproximación).
 */
import React from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { type Locale } from '@/i18n/copy';

export type LanguageFlagLocale = Extract<Locale, 'es' | 'en' | 'pt-BR'>;

export type LanguageFlagProps = {
  locale: LanguageFlagLocale;
  size?: number;
  accessibilityLabel?: string;
  testID?: string;
  style?: ViewStyle;
};

type FlagPalette = {
  colors: string[];
  stops: number[];
  direction: 'vertical' | 'horizontal';
  diagonal?: boolean;
};

const FLAG_PALETTE: Record<LanguageFlagLocale, FlagPalette> = {
  es: {
    direction: 'vertical',
    colors: ['#74ACDF', '#FFFFFF', '#74ACDF'],
    stops: [0, 33, 66],
  },
  'pt-BR': {
    direction: 'horizontal',
    colors: ['#046A38', '#FFE15A', '#DA291C'],
    stops: [0, 40, 60],
  },
  en: {
    direction: 'vertical',
    colors: ['#012169', '#FFFFFF', '#C8102E', '#FFFFFF'],
    stops: [0, 25, 50, 75],
    diagonal: true,
  },
};

function webGradient(palette: FlagPalette): string {
  const stops = palette.colors
    .map((c, i) => `${c} ${palette.stops[i]}%`)
    .join(', ');
  if (palette.diagonal) return `linear-gradient(135deg, ${stops})`;
  if (palette.direction === 'vertical') return `linear-gradient(to bottom, ${stops})`;
  return `linear-gradient(to right, ${stops})`;
}

export function LanguageFlag({
  locale,
  size = 16,
  accessibilityLabel,
  testID,
  style,
}: LanguageFlagProps) {
  const palette = FLAG_PALETTE[locale];
  const width = Math.round(size * 1.5);
  const height = Math.round(size);

  const containerBase: ViewStyle = {
    width,
    height,
    borderRadius: 2,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.15)',
  };

  if (Platform.OS === 'web') {
    const webStyle = {
      ...containerBase,
      backgroundImage: webGradient(palette),
    } as unknown as ViewStyle;
    return (
      <View
        style={[webStyle, style]}
        accessibilityRole="image"
        accessibilityLabel={
          accessibilityLabel ?? defaultAccessibilityLabel(locale)
        }
        testID={testID}
      />
    );
  }

  return (
    <View
      style={[
        containerBase,
        {
          flexDirection: palette.direction === 'vertical' ? 'column' : 'row',
        },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel={
        accessibilityLabel ?? defaultAccessibilityLabel(locale)
      }
      testID={testID}
    >
      {renderNativeBands(palette, width, height)}
    </View>
  );
}

function renderNativeBands(
  palette: FlagPalette,
  width: number,
  height: number,
): React.ReactNode {
  const bands: React.ReactNode[] = [];
  for (let i = 0; i < palette.colors.length; i++) {
    const nextStop = palette.stops[i + 1] ?? 100;
    const span = nextStop - palette.stops[i];
    const isVertical = palette.direction === 'vertical';
    const sizeStyle = isVertical
      ? { height: (span / 100) * height, width: '100%' as const }
      : { width: (span / 100) * width, height: '100%' as const };
    bands.push(
      <View
        key={`band-${i}`}
        style={{
          ...sizeStyle,
          backgroundColor: palette.colors[i],
        }}
      />,
    );
  }
  if (palette.diagonal) {
    bands.push(
      <View
        key="diag-red"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '140%',
          height: 2,
          backgroundColor: '#C8102E',
          transform: [{ rotate: '45deg' }, { translateY: height / 2 - 1 }],
        }}
      />,
      <View
        key="diag-white"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '140%',
          height: 1,
          backgroundColor: '#FFFFFF',
          transform: [{ rotate: '45deg' }, { translateY: height / 2 - 2 }],
        }}
      />,
    );
  }
  return bands;
}

function defaultAccessibilityLabel(locale: LanguageFlagLocale): string {
  switch (locale) {
    case 'es':
      return 'Bandera de Español';
    case 'en':
      return 'Flag of English';
    case 'pt-BR':
      return 'Bandeira de Português';
  }
}
