/**
 * MGC-1650 — WF5 pantalla /post-match.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/design';
import { Button } from '@/design/components/Button';
import { useMatchStore } from '@/shared/store/matchStore';
import { useCareerStore } from '@/shared/store/careerStore';
import { useLocale } from '@/i18n/locale-context';
import { clampCareerStat } from '@/features/career/match';

const HIT_SLOP_44 = { top: 22, left: 22, right: 22, bottom: 22 } as const;

type Translator = (key: string, vars?: Record<string, string | number>) => string;

export default function PostMatchScreen() {
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  const router = useRouter();
  const t = useLocale().t;
  const outcome = useMatchStore((s) => s.outcome);
  const preview = useMatchStore((s) => s.preview);
  const previousProfile = useMatchStore((s) => s.previousProfile);
  const nextProfile = useMatchStore((s) => s.nextProfile);
  const committed = useMatchStore((s) => s.committed);
  const reset = useMatchStore((s) => s.reset);
  const discardMatch = useCareerStore((s) => s.discardMatch);
  const commitMatch = useCareerStore((s) => s.commitMatch);
  // MGC-1903 / MGC-2085 — F4 social events. El motor (`commitMatch`
  // desde PR #476) popula `socialEventPending` en el mismo tick que el
  // `await` resuelve, por lo que NO leemos el hook (stale) sino el
  // snapshot FRESCO via `useCareerStore.getState()` después del await.

  useEffect(() => {
    if (!outcome || !preview || !previousProfile || !nextProfile) {
      router.replace('/simulador-carrera/dashboard');
    }
  }, [outcome, preview, previousProfile, nextProfile, router]);

  useEffect(() => {
    return () => {
      if (!committed) {
        reset();
      }
    };
  }, [committed, reset]);

  const onBackToHub = () => {
    discardMatch();
    router.replace('/simulador-carrera/dashboard');
  };

  const [committing, setCommitting] = useState(false);
  const onNextWeek = async () => {
    if (committing) return;
    setCommitting(true);
    try {
      await commitMatch();
      // MGC-2085 — leer el snapshot FRESCO del store post-commit. El
      // hook `socialEventPending` capturado en el render quedó stale
      // porque `commitMatch` (PR #476) escribe `socialEventPending` en
      // el mismo tick que el `await` resuelve; sin el `getState()`
      // post-await, `onNextWeek` decide con el valor pre-commit y
      // enruta al dashboard aún cuando el motor roló un evento.
      const freshSocialEventPending = useCareerStore.getState()
        .socialEventPending;
      if (freshSocialEventPending) {
        router.replace('/simulador-carrera/social-events');
      } else {
        router.replace('/simulador-carrera/dashboard');
      }
    } finally {
      setCommitting(false);
    }
  };

  const ratingPct = useMemo(() => {
    if (!preview) return 0;
    return Math.max(0, Math.min(100, (preview.rating / 10) * 100));
  }, [preview]);

  if (!outcome || !preview || !previousProfile || !nextProfile) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.bg }]}
        edges={['bottom']}
      >
        <View style={styles.center} testID="post-match-redirect" />
      </SafeAreaView>
    );
  }

  const prevCareer = previousProfile.career;
  const nextCareer = nextProfile.career;

  const moralDelta = clampCareerStat(nextCareer.moral) - clampCareerStat(prevCareer.moral);
  const fisicoDelta = clampCareerStat(nextCareer.fisico) - clampCareerStat(prevCareer.fisico);
  const confianzaDelta = clampCareerStat(nextCareer.confianza) - clampCareerStat(prevCareer.confianza);

  const nextWeek = Math.min(38, previousProfile.week + 1);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.bg }]}
      edges={['bottom']}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { gap: spacing[4], padding: spacing[4] }]}
        testID="post-match-screen"
      >
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
              letterSpacing: 2,
              fontWeight: fontWeight.bold,
            }}
          >
            {t('postMatch.sectionLabel')}
          </Text>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize.lg,
              fontWeight: fontWeight.bold,
            }}
            accessibilityRole="header"
          >
            {t('postMatch.title')}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
            {t('postMatch.subtitle')}
          </Text>
        </View>

        <View
          style={{
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: spacing[5],
            gap: spacing[3],
            alignItems: 'center',
          }}
          testID="post-match-rating"
        >
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 10,
              letterSpacing: 2,
              fontWeight: fontWeight.bold,
            }}
          >
            {t('postMatch.ratingLabel')}
          </Text>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: 64,
              fontWeight: fontWeight.bold,
            }}
            testID="post-match-rating-value"
            accessibilityLabel={t('postMatch.ratingA11y', {
              rating: preview.rating.toFixed(1),
            })}
          >
            {preview.rating.toFixed(1)}
          </Text>
          <View
            style={{
              height: 8,
              width: '100%',
              borderRadius: 4,
              backgroundColor: colors.surface2,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${ratingPct}%`,
                backgroundColor: ratingColor(preview.rating, colors),
              }}
              testID="post-match-rating-bar"
            />
          </View>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
            {ratingLabelKey(preview.rating, t)}
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
          testID="post-match-deltas"
        >
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 10,
              letterSpacing: 2,
              fontWeight: fontWeight.bold,
            }}
          >
            {t('postMatch.changesTitle')}
          </Text>
          <DeltaRow label={t('postMatch.statMoral')} delta={moralDelta} testID="post-match-delta-moral" colors={colors} spacing={spacing} fontSize={fontSize} fontWeight={fontWeight} radii={radii} />
          <DeltaRow label={t('postMatch.statFisico')} delta={fisicoDelta} testID="post-match-delta-fisico" colors={colors} spacing={spacing} fontSize={fontSize} fontWeight={fontWeight} radii={radii} />
          <DeltaRow label={t('postMatch.statConfianza')} delta={confianzaDelta} testID="post-match-delta-confianza" colors={colors} spacing={spacing} fontSize={fontSize} fontWeight={fontWeight} radii={radii} />
          <DeltaRow label={t('postMatch.statGoals')} delta={outcome.goals} testID="post-match-delta-goals" colors={colors} spacing={spacing} fontSize={fontSize} fontWeight={fontWeight} radii={radii} />
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
          testID="post-match-meta"
        >
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 10,
              letterSpacing: 2,
              fontWeight: fontWeight.bold,
            }}
          >
            {t('postMatch.reputationTitle')}
          </Text>
          <Text style={{ color: colors.text, fontSize: fontSize.sm }}>
            {t('postMatch.prensa', { value: reputationLabel(nextCareer.reputation.prensa, t) })}
          </Text>
          <Text style={{ color: colors.text, fontSize: fontSize.sm }}>
            {t('postMatch.hinchada', { value: reputationLabel(nextCareer.reputation.hinchada, t) })}
          </Text>
          <Text style={{ color: colors.text, fontSize: fontSize.sm }}>
            {t('postMatch.vestuario', { value: reputationLabel(nextCareer.reputation.vestuario, t) })}
          </Text>
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.border,
              paddingTop: spacing[2],
              marginTop: spacing[2],
            }}
          >
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 10,
                letterSpacing: 2,
                fontWeight: fontWeight.bold,
                marginBottom: spacing[1],
              }}
            >
              {t('postMatch.nextTitle')}
            </Text>
            <Text
              style={{ color: colors.text, fontSize: fontSize.sm }}
              testID="post-match-next-week"
            >
              {t('postMatch.nextWeek', { week: nextWeek })}
            </Text>
          </View>
        </View>

        <View style={{ gap: spacing[2] }}>
          <Button
            label={t('postMatch.ctaNextWeek')}
            onPress={onNextWeek}
            disabled={committing}
            variant="primary"
            size="lg"
            fullWidth
            testID="btn-post-match-next-week"
            accessibilityHint={t('postMatch.ctaNextWeekHint')}
            hitSlop={HIT_SLOP_44}
          />
          <Button
            label={t('postMatch.ctaBackToHub')}
            onPress={onBackToHub}
            variant="ghost"
            size="md"
            fullWidth
            testID="btn-post-match-back-hub"
            accessibilityHint={t('postMatch.ctaBackToHubHint')}
            hitSlop={HIT_SLOP_44}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type DeltaRowProps = {
  label: string;
  delta: number;
  testID: string;
  colors: ReturnType<typeof useTheme>['colors'];
  spacing: ReturnType<typeof useTheme>['spacing'];
  fontSize: ReturnType<typeof useTheme>['fontSize'];
  fontWeight: ReturnType<typeof useTheme>['fontWeight'];
  radii: ReturnType<typeof useTheme>['radii'];
};

function DeltaRow({ label, delta, testID, colors, spacing, fontSize, fontWeight, radii }: DeltaRowProps) {
  const sign = delta > 0 ? '+' : delta < 0 ? '' : '±';
  const deltaColor = delta > 0 ? colors.primary : delta < 0 ? colors.danger : colors.textMuted;
  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing[2],
        paddingVertical: spacing[2],
        borderRadius: radii.md,
        backgroundColor: colors.surface2,
      }}
    >
      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
        {label}
      </Text>
      <Text
        style={{
          color: deltaColor,
          fontSize: fontSize.md,
          fontWeight: fontWeight.bold,
        }}
      >
        {sign}
        {delta}
      </Text>
    </View>
  );
}

function ratingColor(rating: number, colors: ReturnType<typeof useTheme>['colors']): string {
  if (rating >= 8.5) return colors.primary;
  if (rating >= 7.0) return colors.primarySoft;
  if (rating >= 5.0) return colors.textMuted;
  return colors.danger;
}

function ratingLabelKey(rating: number, t: Translator): string {
  if (rating >= 8.5) return t('postMatch.ratingOutstanding');
  if (rating >= 7.0) return t('postMatch.ratingSolid');
  if (rating >= 5.0) return t('postMatch.ratingRegular');
  if (rating >= 3.0) return t('postMatch.ratingPoor');
  return t('postMatch.ratingBad');
}

function reputationLabel(value: string, t: Translator): string {
  const map: Record<string, string> = {
    ensalzada: 'postMatch.repPrensaEnsalzada',
    neutral: 'postMatch.repPrensaNeutral',
    critica: 'postMatch.repPrensaCritica',
    hostil: 'postMatch.repPrensaHostil',
    idolo: 'postMatch.repHinchadaIdolo',
    aceptado: 'postMatch.repHinchadaAceptado',
    discutido: 'postMatch.repHinchadaDiscutido',
    odiado: 'postMatch.repHinchadaOdiado',
    capitan_moral: 'postMatch.repVestuarioCapitan',
    integrado: 'postMatch.repVestuarioIntegrado',
    aislado: 'postMatch.repVestuarioAislado',
  };
  return map[value] ? t(map[value]) : value;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {},
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});