import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../useTheme';
import { LOCALE_LABEL, Locale, SUPPORTED_LOCALES } from '../../i18n/copy';
import { useLocale } from '../../i18n/locale-context';

/**
 * LanguageSwitcher — MGC-653.
 *
 * Selector horizontal segmentado `ES | EN | 中文`. Mismo comportamiento en
 * web + nativo (Pressable), accesible (TalkBack / VoiceOver leen el botón
 * con `accessibilityLabel` + estado `selected`). El componente es presentational;
 * la mutación del locale la hace `useLocale().setLocale`.
 *
 * A11y:
 * - `accessibilityRole="tablist"` para el contenedor; cada opción es
 *   `accessibilityRole="tab"` con `accessibilityState.selected`.
 * - `accessibilityLabel` localizado ("Cambiar idioma" / "Change language" /
 *   "切换语言").
 * - Hit target ≥ 32×32 (token `tapTarget`); padding lateral generoso para
 *   touch + click.
 */

export type LanguageSwitcherProps = {
  testID?: string;
};

export function LanguageSwitcher({ testID = 'copero-language-switcher' }: LanguageSwitcherProps) {
  const { colors, spacing, fontSize, fontWeight, fontFamily, radii, borderWidth, tapTarget } =
    useTheme();
  const { locale, setLocale, t } = useLocale();

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.pill,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    paddingHorizontal: spacing[1],
    paddingVertical: 2,
    backgroundColor: colors.surface,
    ...(Platform.OS === 'web'
      ? ({ display: 'flex' } as const)
      : null),
  };

  const optionStyle = (selected: boolean): ViewStyle => ({
    minWidth: 36,
    minHeight: Math.max(tapTarget, 32),
    paddingHorizontal: spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: selected ? colors.primary : 'transparent',
    ...(Platform.OS === 'web'
      ? ({ cursor: 'pointer', userSelect: 'none' } as const)
      : null),
  });

  const optionText = {
    color: colors.text,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.xs,
    letterSpacing: 0.4,
    ...(Platform.OS === 'web' ? { textDecorationLine: 'none' as const } : null),
  };

  const selectedText = {
    ...optionText,
    color: colors.textOnPrimary,
  };

  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      accessibilityLabel={t('nav.languageLabel')}
      style={containerStyle}
    >
      {SUPPORTED_LOCALES.map((option: Locale) => {
        const selected = option === locale;
        return (
          <Pressable
            key={option}
            testID={`${testID}-${option}`}
            accessibilityRole="tab"
            accessibilityLabel={LOCALE_LABEL[option]}
            accessibilityState={{ selected }}
            hitSlop={6}
            onPress={() => setLocale(option)}
            style={({ pressed }) => [
              optionStyle(selected),
              pressed && !selected ? { backgroundColor: colors.primarySoft } : null,
            ]}
          >
            <Text style={selected ? selectedText : optionText}>{LOCALE_LABEL[option]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const LanguageSwitcherStyles = StyleSheet.create({});
