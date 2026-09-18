import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { useCareerStore } from '@/shared/store/careerStore';
import {
  applySeasonRollover,
  shouldRollover,
} from '@/features/career/season-rollover';

// MGC-487 — Pantalla de cierre de temporada (Step 6 de la spec).
// Recibe `champion` opcional vía route params (set por playoff.tsx
// al cerrar la final). Aplica el rollover puro (`applySeasonRollover`)
// y persiste vía el `careerStore` (que ya tiene `flushPendingSave`).
// Por ahora, la UI queda como placeholder F2; la integración real con
// `careerStore.applySeasonRollover` se hace en MGC-487.1 (siguiente PR).

export default function SeasonSummaryScreen() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  const profile = useCareerStore((s) => s.profile);

  const canRollover =
    profile !== null && shouldRollover({
      season: profile.season,
      week: profile.week,
      age: profile.age,
    });

  const rolloverPreview = canRollover
    ? applySeasonRollover({
        season: profile!.season,
        week: profile!.week,
        age: profile!.age,
      })
    : null;

  const onConfirm = useCallback(() => {
    // F2 placeholder: navega al hub de la temporada siguiente.
    router.replace('/simulador-carrera/season-hub');
  }, [router]);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.bg }]}
      edges={['bottom']}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { padding: spacing[4], gap: spacing[4] },
        ]}
        testID="season-summary-scroll"
      >
        <View style={{ gap: spacing[1] }}>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 12,
              fontWeight: fontWeight.bold,
              letterSpacing: 2,
            }}
            accessibilityRole="header"
          >
            MGC-487 · CIERRE DE TEMPORADA
          </Text>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize['2xl'],
              fontWeight: fontWeight.bold,
            }}
          >
            Temporada {profile?.season ?? '?'} cerrada
          </Text>
        </View>

        <View
          style={{
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: spacing[4],
            gap: spacing[2],
          }}
        >
          <Text
            style={{
              color: colors.text,
              fontSize: fontSize.md,
            }}
          >
            Semana cerrada: {profile?.week ?? 38}
          </Text>
          {rolloverPreview ? (
            <>
              <Text
                style={{
                  color: colors.text,
                  fontSize: fontSize.md,
                }}
              >
                Siguiente temporada: {rolloverPreview.season} · semana 1
              </Text>
              <Text
                style={{
                  color: colors.text,
                  fontSize: fontSize.md,
                }}
              >
                Edad al rollover: {rolloverPreview.age}
              </Text>
            </>
          ) : (
            <Text style={{ color: colors.textMuted }}>
              Aún no es rollover (week &lt; 38).
            </Text>
          )}
        </View>

        <Button
          label="Ir a la nueva temporada"
          onPress={onConfirm}
          testID="season-summary-confirm"
          disabled={!canRollover}
          fullWidth
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {},
});
