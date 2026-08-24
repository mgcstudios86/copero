import React from 'react';
import { Pressable, Text, ViewStyle, Platform } from 'react-native';
import { useTheme } from '../useTheme';

/**
 * PillButton — MGC-555 PR5.
 *
 * Botón principal de CTA según spec copero.com.ar §6.3
 * (`design/copero-ar-visual-spec.md`). Forma de píldora, fondo blanco
 * `colors.primary` (`#FAFAFA` en dark copero), foreground `colors.textOnPrimary`
 * (`#09090B`). Padding 12×20, Inter 14px weight 500, flecha `→` a la derecha
 * con micro-translación en hover/pressed.
 *
 * Variantes: `solid` (default, fondo primary) y `ghost` (border 1px,
 * fondo transparente).
 *
 * A11y:
 * - `accessibilityRole="button"` para VoiceOver / TalkBack.
 * - `accessibilityLabel` opcional para override (default = label).
 * - Focus visible: outline 2px `colors.focus` + offset 2px (cumple
 *   WCAG 2.4.7 — focus visible en todos los modos).
 *
 * El componente NO depende de expo-router ni navigation — el caller pasa
 * `onPress` y maneja el routing. Esto mantiene la design lib pura.
 */
export type PillButtonVariant = 'solid' | 'ghost';

export type PillButtonProps = {
  label: string;
  onPress: () => void;
  variant?: PillButtonVariant;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
};

export function PillButton({
  label,
  onPress,
  variant = 'solid',
  disabled = false,
  testID = 'copero-pill-button',
  accessibilityLabel,
}: PillButtonProps) {
  const { colors, spacing, fontSize, fontWeight, fontFamily, borderWidth, radii } = useTheme();

  const isGhost = variant === 'ghost';

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    borderRadius: radii.pill,
    backgroundColor: isGhost ? 'transparent' : colors.primary,
    borderWidth: isGhost ? borderWidth.hairline : 0,
    borderColor: isGhost ? colors.border : 'transparent',
    opacity: disabled ? 0.5 : 1,
    // Focus ring se aplica vía outline-offset en web; en native se ignora
    // (Pressable maneja focus con border nativo de la plataforma).
    ...(Platform.OS === 'web' && !disabled
      ? ({
          outline: `2px solid ${colors.focus}`,
          outlineOffset: 2,
        } as unknown as ViewStyle)
      : null),
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      testID={testID}
      hitSlop={spacing[2]}
      style={({ pressed }) => ({
        ...containerStyle,
        // Hover/pressed state — micro-translación de la flecha y opacidad
        // del contenedor. En web, hover lo maneja el user-agent y se combina
        // con el translate que aplicamos al arrow span.
        transform: pressed ? [{ translateX: 0 }] : undefined,
      })}
    >
      <PillButtonLabel
        colors={colors}
        fontSize={fontSize}
        fontWeight={fontWeight}
        fontFamily={fontFamily}
      >
        {label}
      </PillButtonLabel>
      <PillButtonArrow
        colors={colors}
        fontSize={fontSize}
        fontFamily={fontFamily}
        isGhost={isGhost}
      />
    </Pressable>
  );
}

function PillButtonLabel({
  children,
  colors,
  fontSize,
  fontWeight,
  fontFamily,
}: {
  children: React.ReactNode;
  colors: ReturnType<typeof useTheme>['colors'];
  fontSize: ReturnType<typeof useTheme>['fontSize'];
  fontWeight: ReturnType<typeof useTheme>['fontWeight'];
  fontFamily: ReturnType<typeof useTheme>['fontFamily'];
}) {
  return (
    <Text
      style={{
        color: colors.textOnPrimary,
        fontFamily: fontFamily.body,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.medium,
        lineHeight: fontSize.sm * 1.25,
        marginRight: 8,
        ...(Platform.OS === 'web' ? { textDecorationLine: 'none' as const } : null),
      }}
    >
      {children}
    </Text>
  );
}

function PillButtonArrow({
  colors,
  fontSize,
  fontFamily,
  isGhost,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
  fontSize: ReturnType<typeof useTheme>['fontSize'];
  fontFamily: ReturnType<typeof useTheme>['fontFamily'];
  isGhost: boolean;
}) {
  return (
    <Text
      accessible={false}
      style={{
        color: isGhost ? colors.text : colors.textOnPrimary,
        fontFamily: fontFamily.body,
        fontSize: fontSize.sm,
        lineHeight: fontSize.sm,
        // Spec §6.3: flecha 10-12px line-height, translateX(2px) en hover.
        // En native, hover = press; en web el user-agent hace el resto.
        ...(Platform.OS === 'web'
          ? ({ transition: 'transform 160ms ease', transform: 'translateX(0)' } as const)
          : null),
      }}
    >
      →
    </Text>
  );
}