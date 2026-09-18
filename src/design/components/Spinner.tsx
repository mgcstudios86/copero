import React from 'react';
import { ActivityIndicator, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../useTheme';

export type SpinnerSize = 'sm' | 'md' | 'lg';

/**
 * Mapea `SpinnerSize` (API pública) a los valores válidos de
 * `ActivityIndicator.size` (`'small' | 'large' | number | undefined`).
 * `md` se traduce a `undefined` para usar el tamaño por defecto
 * del indicador nativo, que coincide visualmente con 32dp en iOS y Android.
 */
function toActivityIndicatorSize(size: SpinnerSize): 'small' | 'large' | undefined {
  if (size === 'sm') return 'small';
  if (size === 'lg') return 'large';
  return undefined;
}

type SpinnerProps = {
  /**
   * Tamaño visual del spinner.
   * - `sm`: 16dp — para reemplazar textos inline ("Cargando...")
   * - `md`: 32dp — para loaders de cards/secciones
   * - `lg`: 48dp — para loaders de pantalla completa
   */
  size?: SpinnerSize;
  /** Color del spinner. Default: `colors.primary`. */
  color?: string;
  /** testID para QA hooks. */
  testID?: string;
  /** Etiqueta accesible opcional para screen readers. */
  accessibilityLabel?: string;
  /** Centrar en el contenedor padre. Default: true. */
  centered?: boolean;
  /** Padding opcional del contenedor. */
  style?: ViewStyle;
};

/**
 * MGC-42.C — Spinner reutilizable del design system.
 *
 * Antes cada pantalla (match, draft, post-match, social-events, fin-carrera,
 * dashboard) renderizaba un `<Text>Cargando…</Text>` o `<View />` vacío
 * como estado de loading. La auditoría UX MGC-44 marcó la falta de feedback
 * visual como must-fix. Spinner centraliza el control de tamaño/color
 * sobre `ActivityIndicator` para que las pantallas tengan feedback
 * consistente y QA pueda anclar `getByTestId` por pantalla.
 */
export function Spinner({
  size = 'md',
  color,
  testID,
  accessibilityLabel = 'Cargando',
  centered = true,
  style,
}: SpinnerProps) {
  const { colors } = useTheme();
  const tint = color ?? colors.primary;

  const containerStyle: ViewStyle = centered
    ? { alignItems: 'center', justifyContent: 'center' }
    : {};

  return (
    <View
      testID={testID}
      style={[styles.root, containerStyle, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
    >
      <ActivityIndicator size={toActivityIndicatorSize(size)} color={tint} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingVertical: 8,
  },
});