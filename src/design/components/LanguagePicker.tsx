/**
 * LanguagePicker — MGC-491 (flow i18n es/en/pt).
 *
 * Lista vertical de 3 locales (ES/EN/PT-BR) con:
 * - `<LanguageFlag>` 24×16 (gradient CSS, sin assets)
 * - Nombre nativo + subtítulo de variante local ("Argentina · LATAM · España")
 * - Chip "Recomendado" para ES
 * - Highlight del item activo (`borderColor: colors.primary` + chip ✓)
 * - Botón `→` para items no activos en onboarding (acción explícita)
 *
 * El componente es presentational: la mutación la hace el caller vía
 * `onSelect(locale)`. El padre decide si persiste + navega.
 *
 * A11y:
 * - Contenedor: `accessibilityRole="radiogroup"`.
 * - Cada item: `accessibilityRole="radio"` con `accessibilityState.selected`.
 * - `accessibilityLabel` localizado.
 *
 * Locales soportados (subset de `SUPPORTED_LOCALES`): es (default, recomendado),
 * en, pt-BR. Los otros locales (zh-CN, de, it, ko) siguen funcionando vía
 * `LanguageSwitcher` (chip horizontal del SiteHeader) pero no entran al
 * selector de onboarding/settings — decisión documentada en
 * `docs/handoffs/i18n-es-en-pt.md`.
 */
import React, { useCallback } from 'react';
import { Platform, Pressable, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from '../useTheme';
import { LanguageFlag, type LanguageFlagLocale } from './LanguageFlag';

export type LanguagePickerLocale = LanguageFlagLocale;

export type LanguagePickerItem = {
  locale: LanguagePickerLocale;
  title: string;
  subtitle: string;
  recommended?: boolean;
};

export const LANGUAGE_PICKER_LOCALES: readonly LanguagePickerLocale[] = [
  'es',
  'en',
  'pt-BR',
] as const;

export type LanguagePickerProps = {
  items?: LanguagePickerItem[];
  active: LanguagePickerLocale;
  onSelect: (locale: LanguagePickerLocale) => void;
  showRecommendedChip?: boolean;
  showArrow?: boolean;
  testID?: string;
};

const DEFAULT_ITEMS: LanguagePickerItem[] = [
  {
    locale: 'es',
    title: 'Español',
    subtitle: 'Argentina · LATAM · España',
    recommended: true,
  },
  {
    locale: 'en',
    title: 'English',
    subtitle: 'United States · United Kingdom',
  },
  {
    locale: 'pt-BR',
    title: 'Português',
    subtitle: 'Brasil · Portugal',
  },
];

export function LanguagePicker({
  items = DEFAULT_ITEMS,
  active,
  onSelect,
  showRecommendedChip = true,
  showArrow = true,
  testID = 'language-picker',
}: LanguagePickerProps) {
  const { colors, spacing, fontSize, fontWeight, fontFamily, radii, borderWidth } =
    useTheme();

  const handleSelect = useCallback(
    (locale: LanguagePickerLocale) => () => onSelect(locale),
    [onSelect],
  );

  return (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      accessibilityLabel="Idioma"
      style={{ gap: spacing[3] }}
    >
      {items.map((item) => {
        const isActive = item.locale === active;
        const itemStyle: ViewStyle = {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[3],
          padding: spacing[4],
          backgroundColor: colors.surface,
          borderRadius: radii.lg,
          borderWidth: isActive ? borderWidth.chip : borderWidth.hairline,
          borderColor: isActive ? colors.primary : colors.border,
        };
        const titleStyle = {
          color: colors.textStrong,
          fontFamily: fontFamily.body,
          fontSize: fontSize.md,
          fontWeight: fontWeight.semibold,
        };
        const subtitleStyle = {
          color: colors.textMuted,
          fontFamily: fontFamily.body,
          fontSize: fontSize.sm,
          fontWeight: fontWeight.regular,
        };
        const chipStyle = {
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[1],
          borderRadius: radii.pill,
          backgroundColor: colors.primary,
        };
        const chipTextStyle = {
          color: colors.textOnPrimary,
          fontFamily: fontFamily.body,
          fontSize: fontSize.xs,
          fontWeight: fontWeight.bold,
        };

        return (
          <Pressable
            key={item.locale}
            onPress={handleSelect(item.locale)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${item.title}${item.recommended ? ' (Recomendado)' : ''}`}
            testID={`${testID}-item-${item.locale}`}
            style={({ pressed }) => {
              const base = itemStyle;
              const pressedStyle = pressed ? { opacity: 0.85 } : null;
              const webStyle =
                Platform.OS === 'web'
                  ? ({ cursor: 'pointer', userSelect: 'none' } as const)
                  : null;
              return [base, pressedStyle, webStyle];
            }}
          >
            <LanguageFlag locale={item.locale} size={20} />
            <View style={{ flex: 1 }}>
              <Text style={titleStyle}>{item.title}</Text>
              <Text style={subtitleStyle}>{item.subtitle}</Text>
            </View>
            {isActive ? (
              <View style={chipStyle} testID={`${testID}-active-${item.locale}`}>
                <Text style={chipTextStyle}>✓</Text>
              </View>
            ) : showRecommendedChip && item.recommended ? (
              <View
                style={chipStyle}
                testID={`${testID}-recommended-${item.locale}`}
              >
                <Text style={chipTextStyle}>Recomendado</Text>
              </View>
            ) : showArrow ? (
              <View
                accessibilityElementsHidden
                importantForAccessibility="no"
                style={{
                  minWidth: 32,
                  minHeight: 32,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                testID={`${testID}-arrow-${item.locale}`}
              >
                <Text style={{ color: colors.textMuted, fontSize: fontSize.lg }}>
                  →
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
