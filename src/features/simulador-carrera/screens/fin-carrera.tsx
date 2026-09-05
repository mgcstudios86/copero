import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { useCareerStore } from '@/shared/store/careerStore';
import { cardToEntries } from '@/features/career/legends';
import { buildLegado, buildRetirementSummary } from '@/features/career/retirement';
import { RETIREMENT_AGE } from '@/features/career/season';
import { useLocale } from '@/i18n/locale-context';

/**
 * MGC-209 [6/6] + MGC-1736 (WF6) — FIN DE CARRERA.
 *
 * Replica `copero-web/web/src/screens/FinCarrera.tsx`: resumen con
 * edad de retiro, OVR final, partidos, goles+asist, atributos al
 * retiro, vitrina de títulos y legado. Datos derivados del motor
 * (`engine.ts#runCareerToRetirement` → log + profile final).
 *
 * Cleanup post-retiro (MGC-1736 AC de no-mutación):
 *  - `onRestart` es `async`: AWAITA `resetAll()` (drena flush + reset
 *    memoria + await clearCareerSave) ANTES de navegar a `/identity`,
 *    para que el usuario vea la pantalla de alta con AsyncStorage vacío
 *    y un store sin datos de la carrera anterior.
 *  - Guard de doble tap: el borrado no es idempotente-libre; si el
 *    usuario toca "Nueva carrera" dos veces, la segunda noop-ea.
 *  - Cleanup de unmount: si el usuario hace Back físico mientras el
 *    await de resetAll está corriendo, no seteamos estado ni navegamos.
 *  - Mientras corre el reset, el CTA muestra estado "loading" para
 *    bloquear interacción accidental.
 *  - Botón "Nueva carrera" es destructivo → lo declara con
 *    `accessibilityHint` i18n.
 */
export default function FinCarreraScreen() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  const { t } = useLocale();

  const profile = useCareerStore((s) => s.profile);
  const card = useCareerStore((s) => s.card);
  const log = useCareerStore((s) => s.log);
  const resetAll = useCareerStore((s) => s.resetAll);
  const resumeFromRetirement = useCareerStore((s) => s.resumeFromRetirement);

  // MGC-1802 P0-5 — handler del CTA 'Volver a la temporada'. Cambia el
  // stage de 'retirement' → 'season' ANTES de navegar, porque la pantalla
  // /temporada tiene un useEffect que redirige a /fin-carrera si el stage
  // sigue siendo 'retirement' (loop infinito de redirects). Sin este
  // cambio el botón 'Volver' no transiciona (QA MGC-1739).
  const onBackToSeason = useCallback(async () => {
    await resumeFromRetirement();
    router.replace('/simulador-carrera/temporada');
  }, [resumeFromRetirement, router]);

  // MGC-1736 — el borrado es async; si la pantalla se desmonta antes
  // de que resuelva (back físico), no navegamos ni seteamos estado.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // MGC-1736 — guard de doble tap + estado "loading" durante el await.
  const [restarting, setRestarting] = useState(false);

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
            {t('retire.notFinished')}
          </Text>
          <View style={{ marginTop: spacing[4] }}>
            <Button
              label={t('retire.backSeason')}
              onPress={onBackToSeason}
              variant="primary"
              fullWidth
              hitSlop={44}
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

  const onRestart = async () => {
    // MGC-1736 AC no-mutación — guard doble tap: si ya está corriendo
    // un reset, descartamos la segunda pulsación para no encolar dos
    // clearCareerSave() consecutivos.
    if (restarting) return;
    setRestarting(true);
    await resetAll();
    // Si la pantalla se desmontó durante el await (back físico),
    // no navegamos ni reseteamos estado: el store ya quedó limpio
    // porque resetAll() corrió hasta el final.
    if (!mounted.current) return;
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
              {t('retire.eyebrow')}
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
            {t('retire.title')}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.base, textAlign: 'center' }}>
            {t('retire.subtitle')}
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
            <Stat label={t('retire.statRetirementAge')} value={`${summary.retirementAge}`} />
            <Stat label={t('retire.statFinalOvr')} value={`${finalOvr}`} valueColor={colors.primary} />
            <Stat label={t('retire.statApps')} value={`${summary.totalApps}`} />
            <Stat label={t('retire.statGoalsAssists')} value={`${totalGA}`} />
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
            {t('retire.attributesTitle')}
          </Text>
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}
            accessibilityLabel={t('retire.attributesA11y')}
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
            {t('retire.trophyTitle')}
          </Text>
          {summary.vitrina.length === 0 ? (
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
              {t('retire.trophyEmpty')}
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
            {t('retire.legadoTitle')}
          </Text>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize.xl,
              fontWeight: fontWeight.bold,
              textTransform: 'uppercase',
            }}
          >
            {t('retire.ovrDelta', { initial: initialOvr, final: finalOvr })}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
            {t('retire.legadoLead')} {legado}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
            {t('retire.retiredAt', { age: RETIREMENT_AGE })}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing[3], marginTop: spacing[2] }}>
            <View style={{ flex: 1 }}>
              <Button
                label={t('retire.restart')}
                onPress={onRestart}
                variant="primary"
                fullWidth
                accessibilityHint={t('retire.restartA11y')}
                testID="btn-fin-carrera-restart"
                hitSlop={44}
                disabled={restarting}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={t('retire.backSeason')}
                onPress={onBackToSeason}
                variant="secondary"
                fullWidth
                accessibilityHint={t('retire.backSeasonA11y')}
                testID="btn-fin-carrera-temporada"
                hitSlop={44}
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
