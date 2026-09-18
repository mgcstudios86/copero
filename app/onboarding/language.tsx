/**
 * /onboarding/language — MGC-491 (flow i18n es/en/pt).
 *
 * Pantalla 1 del flow i18n: selector de idioma en primer launch.
 * Spec: `docs/screens/i18n-es-en-pt/source/01-selector-onboarding.html`.
 *
 * Comportamiento:
 * 1. Lee el locale persistido (si existe) y lo marca como activo.
 * 2. CTA "Continuar en {idioma}" persiste locale + marca `onboarded=1`
 *    + navega a `/` (home).
 *
 * Acceso:
 * - Root layout (`app/_layout.tsx`) redirige acá si `!onboarded`.
 * - Tras completar, vuelve a `/` y no se vuelve a mostrar.
 *
 * A11y:
 * - H1 con `accessibilityRole="header"`.
 * - Toggle auto-detección con `accessibilityRole="switch"`.
 * - CTA primario con `accessibilityHint` localizado.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/design';
import {
  LanguagePicker,
  type LanguagePickerLocale,
} from '@/design/components/LanguagePicker';
import { useLocale } from '@/i18n/locale-context';
import { markOnboarded } from '@/i18n/onboarding-flag';

type Props = {
  testID?: string;
};

export default function OnboardingLanguageScreen({
  testID = 'onboarding-language-screen',
}: Props) {
  const { colors, spacing, fontSize, fontWeight, fontFamily, radii, borderWidth } =
    useTheme();
  const { locale, setLocale, t } = useLocale();
  const router = useRouter();

  const [autoDetect, setAutoDetect] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const initialLocale: LanguagePickerLocale =
    locale === 'en' || locale === 'pt-BR'
      ? (locale as LanguagePickerLocale)
      : 'es';

  const [selected, setSelected] = useState<LanguagePickerLocale>(initialLocale);

  useEffect(() => {
    if (locale !== 'en' && locale !== 'pt-BR') {
      setSelected('es');
    }
  }, [locale]);

  const handleContinue = useCallback(async () => {
    setSubmitting(true);
    try {
      setLocale(selected);
      await markOnboarded();
      router.replace('/');
    } finally {
      setSubmitting(false);
    }
  }, [selected, setLocale, router]);

  const ctaLabel = (() => {
    switch (selected) {
      case 'es':
        return 'Continuar en Español';
      case 'en':
        return 'Continue in English';
      case 'pt-BR':
        return 'Continuar em Português';
    }
  })();

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.bg }]}
      edges={['top', 'bottom']}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing[5],
          paddingTop: spacing[8],
          paddingBottom: spacing[8],
          gap: spacing[6],
        }}
        testID={testID}
      >
        <View style={{ gap: spacing[3], alignItems: 'center' }}>
          <Text
            accessibilityRole="header"
            style={{
              color: colors.textMuted,
              fontFamily: fontFamily.body,
              fontSize: fontSize.xs,
              fontWeight: fontWeight.bold,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              textAlign: 'center',
            }}
          >
            Idioma · Language · Idioma
          </Text>
          <Text
            style={{
              color: colors.textStrong,
              fontFamily: fontFamily.display,
              fontSize: fontSize['2xl'],
              fontWeight: fontWeight.bold,
              textAlign: 'center',
            }}
          >
            {t('onboarding.languageTitle') || 'Elegí tu idioma'}
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              fontFamily: fontFamily.body,
              fontSize: fontSize.sm,
              textAlign: 'center',
            }}
          >
            {t('onboarding.languageSubtitle') ||
              'Podés cambiarlo después desde Configuración.'}
          </Text>
        </View>

        <LanguagePicker
          active={selected}
          onSelect={setSelected}
          showRecommendedChip
          showArrow
          testID="onboarding-language-picker"
        />

        <View
          style={{
            padding: spacing[4],
            backgroundColor: colors.surface,
            borderRadius: radii.lg,
            borderWidth: borderWidth.hairline,
            borderColor: colors.border,
            gap: spacing[2],
          }}
          testID="onboarding-language-autodetect-card"
        >
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: autoDetect }}
            accessibilityLabel="Detectar ubicación automáticamente"
            onPress={() => setAutoDetect((v) => !v)}
            testID="onboarding-language-autodetect-toggle"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing[3],
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontSize: 24 }} accessibilityElementsHidden>
              📍
            </Text>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.textStrong,
                  fontFamily: fontFamily.body,
                  fontSize: fontSize.md,
                  fontWeight: fontWeight.semibold,
                }}
              >
                {t('onboarding.autoDetectTitle') || 'Detectamos tu ubicación'}
              </Text>
              <Text
                style={{
                  color: colors.textMuted,
                  fontFamily: fontFamily.body,
                  fontSize: fontSize.sm,
                }}
              >
                Buenos Aires, Argentina
              </Text>
            </View>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={{
                width: 44,
                height: 26,
                borderRadius: radii.pill,
                backgroundColor: autoDetect ? colors.primary : colors.surface2,
                padding: 2,
                justifyContent: 'center',
                alignItems: autoDetect ? 'flex-end' : 'flex-start',
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: colors.surface,
                }}
              />
            </View>
          </Pressable>
          <Text
            style={{
              color: colors.textMuted,
              fontFamily: fontFamily.body,
              fontSize: fontSize.xs,
            }}
          >
            {t('onboarding.autoDetectBody') ||
              'Auto-seleccionar idioma según región. Lo podés cambiar manualmente.'}
          </Text>
        </View>
      </ScrollView>

      <View
        style={{
          paddingHorizontal: spacing[5],
          paddingTop: spacing[3],
          paddingBottom: spacing[5],
          borderTopWidth: borderWidth.hairline,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          accessibilityHint="Confirma el idioma seleccionado y abre la pantalla principal."
          onPress={handleContinue}
          disabled={submitting}
          testID="onboarding-language-cta"
          style={({ pressed }) => ({
            paddingVertical: spacing[4],
            borderRadius: radii.md,
            backgroundColor: pressed ? colors.primaryHover : colors.primary,
            alignItems: 'center',
            opacity: submitting ? 0.7 : 1,
          })}
        >
          {submitting ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <Text
              style={{
                color: colors.textOnPrimary,
                fontFamily: fontFamily.body,
                fontSize: fontSize.md,
                fontWeight: fontWeight.bold,
              }}
            >
              {ctaLabel}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
