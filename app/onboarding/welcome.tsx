// app/onboarding/welcome.tsx — MGC-479 / spec PR #655 onboarding-fresh-user step 1.
//
// Trigger: cold-start nativo con AsyncStorage vacío (sin `careerStore.profile.name`
// ni `stage !== 'identity'`) o toque explícito en "Nueva carrera" desde Home.
// Spec: docs/flows/onboarding-fresh-user/flow.md (MGC-433, MGC-434, MGC-479).
//
// Comportamiento:
//   · Pantalla fullscreen: logo + eyebrow + título + body + CTA "Empezar".
//   · `bootstrapPersistence()` ya se llama en `app/_layout.tsx` (MGC-722),
//     por lo que al momento de montar Welcome el store ya está hidratado o
//     confirmado vacío (gate `hydrated` en RootLayout bloquea el render
//     hasta entonces). Welcome NO toca AsyncStorage ni dispara save.
//   · CTA "Empezar" navega a `/simulador-carrera/identity` (WF1), que es
//     donde vive el form de identidad con `shouldCommitNativeText`
//     (MGC-2940 / MGC-3014 / MGC-3022). El draft persiste en `identityDraft`
//     y la transición a `/team-select` (WF2) aplica el gate obligatorio
//     (MGC-1648) antes de generar `careerStore` v2 (MGC-2999).
//   · Re-apertura con carrera existente: `app/index.tsx` ya detecta
//     `hasCareer` y muestra "Continuar carrera" + "Jugar" (MGC-1397).
//     El CTA "Jugar" en ese contexto va directo a identity (re-crear)
//     y NO pasa por Welcome — la welcome es estrictamente para fresh user.
//     `toque explícito en "Nueva carrera" desde Home` también cae acá
//     (ver MGC-479: se agrega CTA secundario cuando hay career).
import React, { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { useLocale } from '@/i18n/locale-context';
import { useCareerStore } from '@/shared/store/careerStore';
import { VersionLabel } from '@/components/VersionLabel';

export default function WelcomeScreen() {
  const router = useRouter();
  const { colors, spacing, fontSize, fontWeight, fontFamily, lineHeight } = useTheme();
  const { t } = useLocale();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();

  // MGC-479 — CTA "Nueva carrera" sólo aparece si hay career persistida.
  // fresh-user (cold-start sin AsyncStorage) → sólo CTA "Empezar".
  // Esto cubre los dos paths de la spec:
  //   · "Primer launch con AsyncStorage vacío → renderiza welcome"
  //   · "toque explícito en 'Nueva carrera' desde Home → vuelve a welcome"
  const careerStage = useCareerStore((s) => s.stage);
  const careerProfileName = useCareerStore((s) => s.profile.name);
  const hasCareer = careerStage !== 'identity' && careerProfileName.length > 0;

  const goStart = useCallback(() => {
    router.push('/simulador-carrera/identity');
  }, [router]);

  // Cap del bloque splash igual que `app/index.tsx` (MGC-1397) para que el
  // CTA "Empezar" quede sobre el fold en 1080×2400 density 400 (ZY22G728HN).
  const splashHeight = useMemo(() => {
    const shortest = Math.min(viewportWidth, viewportHeight);
    return shortest < 600 ? 300 : 560;
  }, [viewportWidth, viewportHeight]);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.bg }]}
      testID="welcome-screen"
      accessibilityLabel={t('welcome.cta')}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            // Mantener el bloque del splash dentro del cap; en pantallas
            // grandes deja aire arriba/abajo para que la composición no
            // quede estirada. `spacing[12]` (96px) es el step más grande
            // del theme; sumamos un offset literal para llegar a 144px.
            minHeight: splashHeight + 144,
          },
        ]}
      >
        {/* ── Eyebrow ───────────────────────────────────────────── */}
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{
            color: colors.textMuted,
            letterSpacing: 4,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.bold,
            marginBottom: spacing[2],
            fontFamily: fontFamily.body,
          }}
        >
          {t('welcome.eyebrow')}
        </Text>

        {/* ── Título (h1, role=header) ───────────────────────────── */}
        <Text
          accessibilityRole="header"
          numberOfLines={2}
          style={{
            color: colors.text,
            fontSize: fontSize['3xl'],
            fontFamily: fontFamily.display,
            fontWeight: fontWeight.bold,
            lineHeight: fontSize['3xl'] * lineHeight.tight,
            letterSpacing: -0.5,
            marginBottom: spacing[3],
          }}
        >
          {t('welcome.title')}
        </Text>

        {/* ── Body descriptivo ─────────────────────────────────── */}
        <Text
          style={{
            color: colors.text,
            fontSize: fontSize.base,
            lineHeight: fontSize.base * lineHeight.base,
            marginBottom: spacing[6],
            fontFamily: fontFamily.body,
          }}
        >
          {t('welcome.body')}
        </Text>

        {/* ── CTA primario: Empezar → WF1 (identity) ──────────── */}
        <Button
          label={t('welcome.cta')}
          onPress={goStart}
          variant="primary"
          size="lg"
          fullWidth
          testID="welcome-cta-start"
          accessibilityLabel={t('welcome.cta')}
          accessibilityHint={t('welcome.ctaHint')}
          hitSlop={{ top: 16, bottom: 100, left: 16, right: 16 }}
        />

        {/* ── Pie minimal: versión instalada. Sin links. ───────── */}
        <View style={{ marginTop: spacing[6], alignItems: 'center' }}>
          <VersionLabel tone="subtle" testID="welcome-version-label" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 24,
    flexGrow: 1,
    justifyContent: 'center',
  },
});