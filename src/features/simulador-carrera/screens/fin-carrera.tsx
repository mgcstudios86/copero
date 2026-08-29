import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { useCareerStore } from '@/shared/store/careerStore';
import { cardToEntries } from '@/features/career/legends';
import { buildLegado, buildRetirementSummary } from '@/features/career/retirement';
import { RETIREMENT_AGE } from '@/features/career/season';

/**
 * MGC-209 [6/6] — FIN DE CARRERA.
 *
 * Replica `copero-web/web/src/screens/FinCarrera.tsx`: resumen con
 * edad de retiro, OVR final, partidos, goles+asist, atributos al
 * retiro, vitrina de títulos y legado. Datos derivados del motor
 * (`engine.ts#runCareerToRetirement` → log + profile final).
 */
export default function FinCarreraScreen() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();

  const profile = useCareerStore((s) => s.profile);
  const card = useCareerStore((s) => s.card);
  const log = useCareerStore((s) => s.log);
  const reset = useCareerStore((s) => s.reset);

  const summary = useMemo(() => {
    if (!log) return null;
    return buildRetirementSummary(profile, log);
  }, [profile, log]);

  const legado = useMemo(() => {
    if (!log) return '';
    return buildLegado(profile, log);
  }, [profile, log]);

  if (!summary || !card) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
        <View style={[styles.container, { padding: spacing[5] }]}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>
            Tu carrera todavía no terminó. Volvé a la temporada para jugarla completa.
          </Text>
          <View style={{ marginTop: spacing[4] }}>
            <Button
              label="Volver a la temporada"
              onPress={() => router.replace('/simulador-carrera/temporada')}
              variant="primary"
              fullWidth
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const entries = cardToEntries(card);
  const totalGA = summary.totalGoals + summary.totalAssists;
  const initialOvr = card.ovrInicial;
  const finalOvr = Math.max(40, summary.finalOvr);

  const onRestart = () => {
    reset();
    router.replace('/simulador-carrera/identity');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.container, { gap: spacing[5], padding: spacing[4] }]}
        testID="fin-carrera-screen"
      >
        {/* Header */}
        <View style={{ gap: spacing[2], alignItems: 'center' }}>
          <View
            style={{
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[2],
              borderRadius: radii.pill,
              backgroundColor: '#FBBF24',
            }}
          >
            <Text style={{ color: '#0A120E', fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 2 }}>
              CARRERA COMPLETA
            </Text>
          </View>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize['3xl'],
              fontWeight: fontWeight.bold,
              textAlign: 'center',
            }}
            accessibilityRole="header"
          >
            FIN DE CARRERA
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.base, textAlign: 'center' }}>
            Cierre de la carrera. Resumen de tus mejores temporadas, vitrina y legado.
          </Text>
        </View>

        {/* Stats grid */}
        <View
          style={{
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: spacing[4],
          }}
        >
          <View style={{ flexDirection: 'row', gap: spacing[3], flexWrap: 'wrap' }}>
            <Stat label="EDAD DE RETIRO" value={`${summary.retirementAge}`} />
            <Stat label="OVR FINAL" value={`${finalOvr}`} valueColor={colors.primary} />
            <Stat label="PARTIDOS" value={`${summary.totalApps}`} />
            <Stat label="GOLES + ASIST." value={`${totalGA}`} />
          </View>
        </View>

        {/* Attributes at retirement */}
        <View
          style={{
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: spacing[4],
            gap: spacing[3],
          }}
        >
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 10,
              fontWeight: fontWeight.bold,
              letterSpacing: 2,
            }}
          >
            ATRIBUTOS AL RETIRO
          </Text>
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}
            accessibilityLabel="Atributos al retiro"
          >
            {entries.map((e) => (
              <View
                key={`retire-${e.key}`}
                style={{
                  flexBasis: '23%',
                  flexGrow: 1,
                  paddingVertical: spacing[3],
                  borderRadius: radii.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface2,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 10,
                    fontWeight: fontWeight.bold,
                    letterSpacing: 1,
                  }}
                >
                  {e.key}
                </Text>
                <Text
                  style={{
                    color: colors.textStrong,
                    fontSize: fontSize.lg,
                    fontWeight: fontWeight.bold,
                  }}
                >
                  {e.value}
                  {(e.key === 'SKL' || e.key === 'WF') ? '★' : ''}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Vitrina */}
        <View
          style={{
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: spacing[4],
            gap: spacing[3],
          }}
        >
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 10,
              fontWeight: fontWeight.bold,
              letterSpacing: 2,
            }}
          >
            VITRINA
          </Text>
          {summary.vitrina.length === 0 ? (
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
              Sin títulos en tu carrera.
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] }}>
              {summary.vitrina.map((t) => (
                <View
                  key={t}
                  style={{
                    flexBasis: '47%',
                    flexGrow: 1,
                    paddingVertical: spacing[4],
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface2,
                    alignItems: 'center',
                    gap: spacing[1],
                  }}
                >
                  <Text style={{ fontSize: 24 }}>🏆</Text>
                  <Text
                    style={{
                      color: colors.textStrong,
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.bold,
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                      textAlign: 'center',
                    }}
                  >
                    {t}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Legado */}
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
              color: colors.textMuted,
              fontSize: 10,
              fontWeight: fontWeight.bold,
              letterSpacing: 2,
            }}
          >
            LEGADO
          </Text>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize.xl,
              fontWeight: fontWeight.bold,
              textTransform: 'uppercase',
            }}
          >
            OVR {initialOvr} → {finalOvr}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
            Cresciste de rookie a referente. {legado}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
            Te retiraste a los {RETIREMENT_AGE} años.
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing[3], marginTop: spacing[2] }}>
            <View style={{ flex: 1 }}>
              <Button
                label="Empezar nueva carrera"
                onPress={onRestart}
                variant="primary"
                fullWidth
                testID="btn-fin-carrera-restart"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Volver a la temporada"
                onPress={() => router.replace('/simulador-carrera/temporada')}
                variant="secondary"
                fullWidth
                testID="btn-fin-carrera-temporada"
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        minWidth: '40%',
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface2,
        padding: spacing[4],
        gap: spacing[1],
      }}
    >
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 10,
          fontWeight: fontWeight.bold,
          letterSpacing: 2,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: valueColor ?? colors.textStrong,
          fontSize: fontSize.xl,
          fontWeight: fontWeight.bold,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {},
});
