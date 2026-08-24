import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle, Platform } from 'react-native';
import { useTheme } from '../useTheme';

/**
 * Header — MGC-555 PR3.
 *
 * Header reusable para usar dentro o encima de cualquier pantalla. Implementa
 * el patrón de la sección 6 del spec visual copero.com.ar (`design/copero-ar-visual-spec.md`):
 * wordmark "Copero" a la izquierda (Poppins Bold) + slot derecho para acciones
 * (login, idioma, etc.). Fondo `colors.surface`, borde inferior hairline para
 * separar visualmente del contenido.
 *
 * NO reemplaza el header built-in de expo-router (eso se hace por `screenOptions`
 * en `_layout.tsx`). Este componente es reutilizable en superficies custom
 * (landing web, hero de marketing, drawer, etc.).
 *
 * Contraste: wordmark usa `colors.textStrong` (blanco en copero, ink en light) —
 * verificado ≥ 4.5:1 sobre `colors.surface` por token (MGC-373, WCAG AA).
 *
 * A11y:
 * - `accessibilityRole="header"` para landmark semántico en web (TalkBack lo
 *   trata como banner / header según plataforma).
 * - `accessibilityLabel` por defecto "Copero" + opcional `subtitle` lo concatena.
 * - El slot derecho se renderiza como `<View>` no interactivo; los Pressables
 *   que el caller coloque adentro ya tienen su propio role.
 */
export type HeaderProps = {
  /** Texto del wordmark. Default "Copero" para mantener la identidad. */
  title?: string;
  /** Subtítulo opcional concatenado al accessibilityLabel. */
  subtitle?: string;
  /** Slot derecho (login button, badge, etc.). */
  right?: React.ReactNode;
  /** Slot izquierdo opcional (back button, hamburger). */
  left?: React.ReactNode;
  /** testID para tests E2E (Playwright / Detox). */
  testID?: string;
  /** Si true, fija el border-bottom hairline. Default true. */
  bordered?: boolean;
};

export function Header({
  title = 'Copero',
  subtitle,
  right,
  left,
  testID = 'copero-header',
  bordered = true,
}: HeaderProps) {
  const { colors, spacing, fontFamily, fontSize, fontWeight, lineHeight, borderWidth } =
    useTheme();
  const styles = HeaderStyles;

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    minHeight: 56,
    backgroundColor: colors.surface,
    borderBottomWidth: bordered ? borderWidth.hairline : 0,
    borderBottomColor: colors.border,
    ...(Platform.OS === 'web'
      ? {
          // Reset de user-agent <header>: el `<header>` de HTML5 trae estilos
          // default que pelean con el flex row (display:block). Forzamos flex
          // para mantener el layout consistente con native.
          display: 'flex' as const,
        }
      : null),
  };

  const a11yLabel = subtitle ? `${title}, ${subtitle}` : title;

  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={a11yLabel}
      testID={testID}
      style={containerStyle}
    >
      <View style={styles.side}>
        {left}
      </View>
      <View style={styles.center}>
        <Text
          style={{
            color: colors.textStrong,
            fontFamily: fontFamily.display,
            fontWeight: fontWeight.bold,
            fontSize: fontSize.lg,
            lineHeight: fontSize.lg * lineHeight.tight,
            letterSpacing: 0.2,
          }}
          numberOfLines={1}
          // MGC-373: wordmark no debe subrayarse aunque el user-agent style
          // de un eventual <a> contenedor lo pida.
          {...(Platform.OS === 'web' ? { style: { textDecorationLine: 'none' as const } } : null)}
        >
          {title}
        </Text>
      </View>
      <View style={[styles.side, styles.sideRight]}>{right}</View>
    </View>
  );
}

export const HeaderStyles = StyleSheet.create({
  side: { flexDirection: 'row', alignItems: 'center', minWidth: 64 },
  sideRight: { justifyContent: 'flex-end' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

/**
 * BackButton — slot izquierdo estándar para `Header.left`.
 * Patrón C1 (`components.md` TopBar): Pressable 44×44 con texto flecha.
 * Mantenido como named export para que callers compongan sin reinventar.
 */
export function HeaderBackButton({
  onPress,
  label = 'Volver',
  testID = 'copero-header-back',
}: {
  onPress: () => void;
  label?: string;
  testID?: string;
}) {
  const { colors, spacing, fontSize, fontWeight, tapTarget } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={spacing[2]}
      testID={testID}
      style={({ pressed }) => ({
        minWidth: tapTarget,
        minHeight: tapTarget,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 9999,
        opacity: pressed ? 0.6 : 1,
        ...(Platform.OS === 'web'
          ? ({ cursor: 'pointer', textDecorationLine: 'none', color: colors.text } as const)
          : null),
      })}
    >
      <Text
        style={{
          color: colors.text,
          fontSize: fontSize.xl,
          lineHeight: fontSize.xl,
          fontWeight: fontWeight.semibold,
          ...(Platform.OS === 'web' ? { textDecorationLine: 'none' as const } : null),
        }}
      >
        ‹
      </Text>
    </Pressable>
  );
}
