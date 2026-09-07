/**
 * /settings — MGC-1506.
 *
 * Pantalla modal de Ajustes. Se accede desde el link ⚙️ del SiteHeader
 * (icon-only). Permite al usuario ver la versión instalada, cambiar el
 * idioma, consultar "Cómo jugar", enviar feedback, y (solo en builds
 * dev) resetear la carrera persistida.
 *
 * Implementación: archivo file-based top-level para que Expo Router
 * lo registre automáticamente en `app/_layout.tsx` (que monta la
 * `<Stack>` raíz y la presenta como modal gracias a `presentation: 'modal'`).
 *
 * Estructura: SafeAreaView > ScrollView > grupos (Versión · Idioma ·
 * Acciones · Dev). Cada fila es un Pressable con role=button + label
 * localizado. El reset de carrera está gateado por `__DEV__` (MGC-1506
 * AC: "Reset carrera solo visible en `__DEV__`"); en builds `eas build`
 * internos el flag `process.env.EXPO_PUBLIC_DEV_RESET_CARRERA === '1'`
 * lo muestra también (MGC-565).
 *
 * A11y:
 * - Cada fila tiene `accessibilityRole="button"` + label localizado.
 * - "Cómo jugar" usa Link href="/#how-to-play" (anchor) que en nativo
 *   navega al home (expo-router trata anchors como href normal).
 */
import React, { useCallback } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
// eslint-disable-next-line import/no-named-as-default
import Constants from 'expo-constants';
import { useTheme } from '@/design';
import { LanguageSwitcher } from '@/design/components/LanguageSwitcher';
import { useLocale } from '@/i18n/locale-context';
import {
  ResetCareerButton,
  shouldRenderResetButton,
} from '@/features/simulador-carrera/components/ResetCareerButton';

const FEEDBACK_EMAIL = 'feedback@copero.mgcstudios.app';

export default function SettingsScreen() {
  const { colors, spacing, fontSize, fontWeight, fontFamily, radii, borderWidth } =
    useTheme();
  const { t, locale } = useLocale();
  const router = useRouter();

  const cfg = Constants.expoConfig;
  const versionName = cfg?.version ?? Constants.nativeAppVersion ?? '0.0.1';
  const versionCode = cfg?.android?.versionCode ?? Constants.nativeBuildVersion ?? 15;
  const buildSha =
    (cfg?.extra as { buildSha?: string | null } | undefined)?.buildSha ?? 'dev';
  const shortSha = typeof buildSha === 'string' ? buildSha.slice(0, 7) : 'dev';

  const onFeedback = useCallback(async () => {
    const subject = encodeURIComponent(`${t('settings.feedbackSubject')} (${versionName})`);
    const body = encodeURIComponent(
      `Versión: ${versionName} (${versionCode})\nBuild: ${shortSha}\nLocale: ${locale}\n\n`,
    );
    const url = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert(t('settings.feedback'), FEEDBACK_EMAIL);
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('settings.feedback'), FEEDBACK_EMAIL);
    }
  }, [versionName, versionCode, shortSha, locale, t]);

  const showReset = __DEV__ || shouldRenderResetButton();

  const containerStyle = {
    flex: 1,
    backgroundColor: colors.bg,
  };
  const headerStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: borderWidth.hairline,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  };
  const groupTitleStyle = {
    color: colors.textMuted,
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    marginTop: spacing[6],
    marginBottom: spacing[2],
    paddingHorizontal: spacing[5],
  };
  const rowStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    backgroundColor: colors.surface,
    borderBottomWidth: borderWidth.hairline,
    borderBottomColor: colors.border,
  };
  const labelStyle = {
    color: colors.text,
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  };
  const valueStyle = {
    color: colors.textMuted,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.regular,
  };
  const linkTextStyle = {
    ...labelStyle,
    color: colors.primary,
  };

  return (
    <SafeAreaView style={containerStyle} edges={['top', 'bottom']}>
      <View testID="settings-screen" accessibilityLabel={t('settings.title')}>
        <View style={headerStyle}>
          <Text
            style={{
              color: colors.textStrong,
              fontFamily: fontFamily.display,
              fontSize: fontSize.lg,
              fontWeight: fontWeight.bold,
            }}
          >
            {t('settings.title')}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settings.close')}
            testID="settings-close"
            hitSlop={spacing[2]}
            onPress={() => router.back()}
            style={({ pressed }) => ({
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[2],
              borderRadius: radii.md,
              backgroundColor: pressed ? colors.surface2 : 'transparent',
            })}
          >
            <Text style={{ color: colors.text, fontSize: fontSize.md }}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingBottom: spacing[8],
          }}
        >
          <Text style={groupTitleStyle}>{t('settings.version')}</Text>
          <View style={rowStyle} testID="settings-version-row">
            <Text style={labelStyle}>{t('settings.version')}</Text>
            <Text style={valueStyle} testID="settings-version-value">
              v{versionName} ({versionCode})
            </Text>
          </View>
          <View style={rowStyle} testID="settings-build-row">
            <Text style={labelStyle}>{t('settings.build')}</Text>
            <Text style={valueStyle} testID="settings-build-value">
              {shortSha}
            </Text>
          </View>

          <Text style={groupTitleStyle}>{t('settings.language')}</Text>
          <View
            style={{
              ...rowStyle,
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: spacing[3],
            }}
            testID="settings-language-row"
          >
            <Text style={labelStyle}>{t('settings.language')}</Text>
            <LanguageSwitcher />
          </View>

          <Text style={groupTitleStyle}>{t('settings.title')}</Text>
          <Link
            href="/#how-to-play"
            asChild
            accessibilityRole="link"
            accessibilityLabel={t('settings.howToPlay')}
            testID="settings-howtoplay-link"
          >
            <Pressable style={({ pressed: _pressed }) => rowStyle}>
              <Text style={linkTextStyle}>{t('settings.howToPlay')}</Text>
              <Text style={{ ...valueStyle, color: colors.textMuted }}>›</Text>
            </Pressable>
          </Link>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settings.feedback')}
            testID="settings-feedback-button"
            onPress={onFeedback}
            style={({ pressed: _pressed }) => rowStyle}
          >
            <Text style={linkTextStyle}>{t('settings.feedback')}</Text>
            <Text style={{ ...valueStyle, color: colors.textMuted }}>✉</Text>
          </Pressable>

          {showReset && (
            <>
              <Text style={groupTitleStyle}>Dev</Text>
              <View
                style={{
                  paddingHorizontal: spacing[5],
                  paddingVertical: spacing[4],
                }}
              >
                <ResetCareerButton />
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
