/**
 * /settings/language — MGC-491 (flow i18n es/en-pt).
 *
 * Pantalla 2 del flow i18n: cambio de idioma en Configuración.
 * Spec: `docs/screens/i18n-es-en-pt/source/02-selector-settings.html`.
 *
 * Comportamiento:
 * - Lista de 3 locales (es/en/pt-BR) con item activo destacado.
 * - Card "Formato de fecha y números" (read-only, derivado del locale).
 * - Toggle "Auto-detectar al abrir" (persiste UI).
 * - Chip "Activo" confirmando persistencia.
 *
 * A11y:
 * - Header con `accessibilityRole="header"`.
 * - Items `accessibilityRole="radio"` con state.
 * - Toggle `accessibilityRole="switch"`.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTheme } from '@/design';
import {
  LanguagePicker,
  type LanguagePickerLocale,
} from '@/design/components/LanguagePicker';
import { useLocale } from '@/i18n/locale-context';
import { type Locale } from '@/i18n/copy';

type FormatSpec = {
  dateFormat: string;
  decimal: string;
  currency: string;
};

const FORMAT_BY_LOCALE: Record<LanguagePickerLocale, FormatSpec> = {
  es: { dateFormat: 'DD/MM/YYYY', decimal: ', (coma)', currency: 'EUR (€)' },
  en: { dateFormat: 'MM/DD/YYYY', decimal: '. (punto)', currency: 'USD ($)' },
  'pt-BR': { dateFormat: 'DD/MM/YYYY', decimal: ', (coma)', currency: 'BRL (R$)' },
};

export default function SettingsLanguageScreen() {
  const { colors, spacing, fontSize, fontWeight, fontFamily, radii, borderWidth } =
    useTheme();
  const { locale, setLocale, t } = useLocale();
  const router = useRouter();

  const initial: LanguagePickerLocale =
    locale === 'en' || locale === 'pt-BR'
      ? (locale as LanguagePickerLocale)
      : 'es';
  const [selected, setSelected] = useState<LanguagePickerLocale>(initial);
  const [autoDetect, setAutoDetect] = useState(true);

  const handleApply = useCallback(() => {
    setLocale(selected as Locale);
  }, [selected, setLocale]);

  const handleSelect = useCallback(
    (next: LanguagePickerLocale) => {
      setSelected(next);
      setLocale(next as Locale);
    },
    [setLocale],
  );

  const format = useMemo(() => FORMAT_BY_LOCALE[selected], [selected]);

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.bg }]}
      edges={['top', 'bottom']}
    >
      <Stack.Screen options={{ presentation: 'modal', headerShown: false }} />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
          borderBottomWidth: borderWidth.hairline,
          borderBottomColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('settings.close') || 'Volver'}
          onPress={() => router.back()}
          testID="settings-language-back"
          hitSlop={spacing[2]}
          style={({ pressed }) => ({
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[2],
            borderRadius: radii.md,
            backgroundColor: pressed ? colors.surface2 : 'transparent',
          })}
        >
          <Text style={{ color: colors.text, fontSize: fontSize.lg }}>←</Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          style={{
            color: colors.textStrong,
            fontFamily: fontFamily.display,
            fontSize: fontSize.md,
            fontWeight: fontWeight.bold,
          }}
        >
          {t('settings.title') || 'Configuración'}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: spacing[5],
          gap: spacing[5],
          paddingBottom: spacing[8],
        }}
        testID="settings-language-screen"
      >
        <Text
          accessibilityRole="header"
          style={{
            color: colors.textStrong,
            fontFamily: fontFamily.display,
            fontSize: fontSize.xl,
            fontWeight: fontWeight.bold,
          }}
        >
          {t('settings.language') || 'Idioma y región'}
        </Text>

        <View style={cardStyle(colors, spacing, radii, borderWidth)}>
          <Text style={cardTitleStyle(colors, fontFamily, fontSize, fontWeight)}>
            {t('settings.language') || 'Idioma de la interfaz'}
          </Text>
          <LanguagePicker
            active={selected}
            onSelect={handleSelect}
            showRecommendedChip={false}
            showArrow={false}
            testID="settings-language-picker"
          />
        </View>

        <View style={cardStyle(colors, spacing, radii, borderWidth)}>
          <Text style={cardTitleStyle(colors, fontFamily, fontSize, fontWeight)}>
            Formato de fecha y números
          </Text>
          <Row
            label="Formato de fecha"
            value={format.dateFormat}
            testID="settings-language-format-date"
          />
          <Row
            label="Separador decimal"
            value={format.decimal}
            testID="settings-language-format-decimal"
          />
          <Row
            label="Moneda"
            value={format.currency}
            testID="settings-language-format-currency"
          />
        </View>

        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: autoDetect }}
          accessibilityLabel="Auto-detectar al abrir"
          onPress={() => setAutoDetect((v) => !v)}
          testID="settings-language-autodetect"
          style={({ pressed }) => [
            cardStyle(colors, spacing, radii, borderWidth),
            styles.cardRow,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={{ fontSize: 24 }} accessibilityElementsHidden>
            🔄
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={cardTitleStyle(colors, fontFamily, fontSize, fontWeight)}>
              Auto-detectar al abrir
            </Text>
            <Text
              style={{
                color: colors.textMuted,
                fontFamily: fontFamily.body,
                fontSize: fontSize.sm,
              }}
            >
              Lee el idioma del sistema operativo
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

        <View
          style={[
            cardStyle(colors, spacing, radii, borderWidth),
            styles.cardRow,
          ]}
          testID="settings-language-persistence"
        >
          <Text style={{ fontSize: 24 }} accessibilityElementsHidden>
            💾
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={cardTitleStyle(colors, fontFamily, fontSize, fontWeight)}>
              Persistencia entre sesiones
            </Text>
            <Text
              style={{
                color: colors.textMuted,
                fontFamily: fontFamily.body,
                fontSize: fontSize.sm,
              }}
            >
              Tu elección se guarda automáticamente
            </Text>
          </View>
          <View
            style={{
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[1],
              borderRadius: radii.pill,
              backgroundColor: colors.successSoft,
            }}
            testID="settings-language-persistence-chip"
          >
            <Text
              style={{
                color: colors.success,
                fontFamily: fontFamily.body,
                fontSize: fontSize.xs,
                fontWeight: fontWeight.bold,
              }}
            >
              Activo
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          onPress={handleApply}
          testID="settings-language-close"
          style={({ pressed }) => ({
            paddingVertical: spacing[4],
            borderRadius: radii.md,
            backgroundColor: pressed ? colors.primaryHover : colors.primary,
            alignItems: 'center',
          })}
        >
          <Text
            style={{
              color: colors.textOnPrimary,
              fontFamily: fontFamily.body,
              fontSize: fontSize.md,
              fontWeight: fontWeight.bold,
            }}
          >
            {t('settings.close') || 'Cerrar'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, testID }: { label: string; value: string; testID?: string }) {
  const { colors, spacing, fontSize, fontWeight, fontFamily } = useTheme();
  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing[2],
      }}
    >
      <Text
        style={{
          color: colors.text,
          fontFamily: fontFamily.body,
          fontSize: fontSize.sm,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: colors.textMuted,
          fontFamily: fontFamily.mono,
          fontSize: fontSize.sm,
          fontWeight: fontWeight.regular,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function cardStyle(
  colors: ReturnType<typeof useTheme>['colors'],
  spacing: ReturnType<typeof useTheme>['spacing'],
  radii: ReturnType<typeof useTheme>['radii'],
  borderWidth: ReturnType<typeof useTheme>['borderWidth'],
) {
  return {
    padding: spacing[4],
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    gap: spacing[3],
  };
}

function cardTitleStyle(
  colors: ReturnType<typeof useTheme>['colors'],
  fontFamily: ReturnType<typeof useTheme>['fontFamily'],
  fontSize: ReturnType<typeof useTheme>['fontSize'],
  fontWeight: ReturnType<typeof useTheme>['fontWeight'],
) {
  return {
    color: colors.textStrong,
    fontFamily: fontFamily.display,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  };
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
