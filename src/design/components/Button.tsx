import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  AccessibilityProps,
  Platform,
  PressableStateCallbackType,
  Insets,
} from 'react-native';
import { useTheme } from '../useTheme';
import { useReducedMotion } from '../useReducedMotion';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
  accessibilityHint?: string;
  /**
   * hitSlop opcional para extender el área tocable del Pressable más allá
   * de los bounds visuales. Útil para CTAs críticos en pantallas donde el
   * thumb-reach puede descentrar el tap por 1-2 cm (MGC-425: btn-career del
   * splash en ZY22G728HN 1080x2400).
   */
  hitSlop?: Insets | number;
} & Omit<AccessibilityProps, 'accessibilityRole' | 'accessibilityState'>;

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  testID,
  iconLeft,
  iconRight,
  fullWidth,
  accessibilityHint,
  ...rest
}: ButtonProps) {
  const { colors, radii, spacing, fontSize, lineHeight, fontWeight, tapTarget } = useTheme();
  const reducedMotion = useReducedMotion();

  const palette = useMemo(() => {
    switch (variant) {
      case 'primary':
        return {
          bg: colors.primary,
          bgPressed: colors.primaryHover,
          fg: colors.textOnPrimary,
          border: colors.primary,
        };
      case 'secondary':
        return {
          bg: colors.surface,
          bgPressed: colors.surface2,
          fg: colors.text,
          border: colors.borderStrong,
        };
      case 'ghost':
        return { bg: 'transparent', bgPressed: colors.surface2, fg: colors.text, border: 'transparent' };
      case 'danger':
        return { bg: colors.danger, bgPressed: colors.dangerSoft, fg: colors.textOnAccent, border: colors.danger };
    }
  }, [variant, colors]);

  const dims = useMemo(() => {
    switch (size) {
      case 'sm':
        return { px: spacing[3], py: spacing[2], fs: fontSize.sm, minH: 36 };
      case 'md':
        return { px: spacing[4], py: spacing[3], fs: fontSize.base, minH: tapTarget };
      case 'lg':
        return { px: spacing[5], py: spacing[4], fs: fontSize.md, minH: 52 };
    }
  }, [size, spacing, fontSize, tapTarget]);

  const containerStyle: ViewStyle = {
    backgroundColor: palette.bg,
    borderColor: palette.border,
    borderWidth: variant === 'ghost' ? 0 : 1,
    borderRadius: radii.md,
    paddingVertical: dims.py,
    paddingHorizontal: dims.px,
    minHeight: Math.max(dims.minH, tapTarget),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    alignSelf: fullWidth ? 'stretch' : 'flex-start',
    opacity: disabled ? 0.5 : 1,
    // Web (MGC-373): Pressable se convierte en `<a>` cuando expo-router detecta
    // router.push en onPress. El browser aplica estilos default a `<a>`
    // (color: -webkit-link, text-decoration: underline, background: transparent)
    // que sobrescriben los colores del design system y rompen WCAG AA 4.5:1
    // sobre el bg del theme. Forzamos cursor, sin underline, y colores
    // explícitos para que el `<a>` mantenga el aspect ratio del Button.
    ...(Platform.OS === 'web'
      ? {
          cursor: 'pointer' as const,
          textDecorationLine: 'none',
          color: palette.fg,
        }
      : null),
  };

  const pressedStyle = (state: PressableStateCallbackType): ViewStyle =>
    state.pressed && !reducedMotion
      ? {
          backgroundColor: palette.bgPressed,
          transform: [{ scale: 0.97 }],
        }
      : state.pressed
      ? { backgroundColor: palette.bgPressed }
      : {};

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={rest.accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      android_ripple={
        Platform.OS === 'android' && !disabled && !loading
          ? { color: palette.bgPressed, borderless: false }
          : undefined
      }
      style={(state) => [containerStyle, pressedStyle(state)]}
      {...rest}
    >
      {iconLeft ? <View accessibilityElementsHidden importantForAccessibility="no">{iconLeft}</View> : null}
      <Text
        style={{
          color: palette.fg,
          fontSize: dims.fs,
          lineHeight: dims.fs * lineHeight.snug,
          fontWeight: fontWeight.semibold,
          // MGC-373: el `<a>` web hereda text-decoration: underline del
          // user-agent stylesheet y eso también degrada la legibilidad.
          // Forzamos none acá para que el botón luzca plano como en native.
          ...(Platform.OS === 'web' ? { textDecorationLine: 'none' as const } : null),
        }}
        numberOfLines={1}
      >
        {loading ? '…' : label}
      </Text>
      {iconRight ? <View accessibilityElementsHidden importantForAccessibility="no">{iconRight}</View> : null}
    </Pressable>
  );
}

export const ButtonStyles = StyleSheet.create({});
