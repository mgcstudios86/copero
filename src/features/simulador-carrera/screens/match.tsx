/**
 * MGC-1650 — WF4 pantalla /match.
 */
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/design';
import { Button } from '@/design/components/Button';
import { useMatchStore } from '@/shared/store/matchStore';
import { useCareerStore } from '@/shared/store/careerStore';
import { useLocale } from '@/i18n/locale-context';

/** MGC-1729 (HIGH-2) — 44dp de área tocable en los CTA críticos. */
const HIT_SLOP_44 = { top: 22, left: 22, right: 22, bottom: 22 } as const;

export default function MatchScreen() {
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  const router = useRouter();
  const t = useLocale().t;
  const outcome = useMatchStore((s) => s.outcome);
  const nextProfile = useMatchStore((s) => s.nextProfile);
  const previousProfile = useMatchStore((s) => s.previousProfile);
  const committed = useMatchStore((s) => s.committed);
  const reset = useMatchStore((s) => s.reset);
  const startMatch = useCareerStore((s) => s.startMatch);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!outcome) {
      // MGC-1729 (MEDIUM-2): `startMatch` hace imports dinámicos; si uno
      // falla la pantalla quedaba colgada en «Cargando partido» sin salida.
      void startMatch().catch(() => setLoadFailed(true));
    }
  }, [outcome, startMatch]);

  useEffect(() => {
    return () => {
      if (!committed) {
        reset();
      }
    };
  }, [committed, reset]);

  if (loadFailed && !outcome) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.bg }]}
        edges={['bottom']}
      >
        <View
          style={[
            styles.center,
            { backgroundColor: colors.bg, padding: spacing[4], gap: spacing[3] },
          ]}
          testID="match-load-error"
        >
          <Text
            style={{
              color: colors.textMuted,
              fontSize: fontSize.sm,
              textAlign: 'center',
            }}
          >
            {t('match.loadError')}
          </Text>
          <Button
            label={t('match.ctaLoadErrorBack')}
            onPress={() => router.replace('/simulador-carrera/season-hub')}
            variant="primary"
            size="md"
            testID="btn-match-load-error-back"
            accessibilityLabel={t('match.ctaLoadErrorBack')}
            hitSlop={HIT_SLOP_44}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!outcome || !nextProfile || !previousProfile) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.bg }]}
        edges={['bottom']}
      >
        <View style={[styles.center, { backgroundColor: colors.bg }]} testID="match-loading">
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
            {t('match.loading')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const teamGoals = outcome.goals;
  const rivalGoals = Math.max(0, Math.floor(outcome.score / 35));
  const minutes = 90;
  const passPct = Math.round(60 + outcome.score / 4);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.bg }]}
      edges={['bottom']}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { gap: spacing[4], padding: spacing[4] }]}
        testID="match-screen"
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
            {t('match.weekLabel')} {previousProfile.week}/38
          </Text>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize.lg,
              fontWeight: fontWeight.bold,
            }}
            accessibilityRole="header"
          >
            {t('match.title')}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
            {t('match.subtitle')}
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
          testID="match-scoreboard"
        >
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 10,
              letterSpacing: 2,
              fontWeight: fontWeight.bold,
            }}
          >
            {t('match.finalLabel')}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[6] }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
                {previousProfile.club?.name ?? 'Libre'}
              </Text>
              <Text
                style={{
                  color: colors.textStrong,
                  fontSize: 48,
                  fontWeight: fontWeight.bold,
                }}
                testID="match-score-home"
              >
                {teamGoals}
              </Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>
              —
            </Text>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
                {t('match.rival')}
              </Text>
              <Text
                style={{
                  color: colors.textStrong,
                  fontSize: 48,
                  fontWeight: fontWeight.bold,
                }}
                testID="match-score-away"
              >
                {rivalGoals}
              </Text>
            </View>
          </View>
          <Text
            style={{
              color: outcome.cleanSheet ? colors.primary : colors.textMuted,
              fontSize: fontSize.xs,
            }}
            testID="match-clean-sheet"
          >
            {outcome.cleanSheet ? t('match.cleanSheet') : t('match.resultClosed')}
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
          testID="match-events"
        >
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 10,
              letterSpacing: 2,
              fontWeight: fontWeight.bold,
            }}
          >
            {t('match.eventsTitle')}
          </Text>
          {outcome.goals === 0 ? (
            <Text style={{ color: colors.text, fontSize: fontSize.sm }}>
              {t('match.noEvents')}
            </Text>
          ) : (
            Array.from({ length: outcome.goals }).map((_, i) => {
              const minute = Math.min(89, 15 + Math.floor((i * 70) / Math.max(1, outcome.goals)));
              return (
                <View
                  key={`goal-${i}`}
                  style={{ flexDirection: 'row', gap: spacing[3], alignItems: 'center' }}
                >
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.bold,
                      minWidth: 32,
                    }}
                  >
                    {minute}'
                  </Text>
                  <Text style={{ color: colors.text, fontSize: fontSize.sm, flex: 1 }}>
                    {t('match.goalEvent')}
                  </Text>
                </View>
              );
            })
          )}
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
          testID="match-your-game"
        >
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 10,
              letterSpacing: 2,
              fontWeight: fontWeight.bold,
            }}
          >
            {t('match.yourGameTitle')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
            <StatTile label={t('match.statGoals')} value={String(outcome.goals)} testID="match-stat-goals" colors={colors} spacing={spacing} fontSize={fontSize} fontWeight={fontWeight} radii={radii} />
            <StatTile label={t('match.statAst')} value={String(Math.max(0, Math.floor(outcome.score / 50)))} testID="match-stat-ast" colors={colors} spacing={spacing} fontSize={fontSize} fontWeight={fontWeight} radii={radii} />
            <StatTile label={t('match.statPassPct')} value={`${passPct}%`} testID="match-stat-pass" colors={colors} spacing={spacing} fontSize={fontSize} fontWeight={fontWeight} radii={radii} />
            <StatTile label={t('match.statMinutes')} value={`${minutes}'`} testID="match-stat-minutes" colors={colors} spacing={spacing} fontSize={fontSize} fontWeight={fontWeight} radii={radii} />
          </View>
        </View>

        <View style={{ gap: spacing[2] }}>
          <Button
            label={t('match.ctaFinalize')}
            onPress={() => router.push('/simulador-carrera/post-match')}
            variant="primary"
            size="lg"
            fullWidth
            testID="btn-match-finalize"
            accessibilityLabel={t('match.ctaFinalize')}
            accessibilityHint={t('match.ctaFinalizeHint')}
            hitSlop={HIT_SLOP_44}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type StatTileProps = {
  label: string;
  value: string;
  testID: string;
  colors: ReturnType<typeof useTheme>['colors'];
  spacing: ReturnType<typeof useTheme>['spacing'];
  fontSize: ReturnType<typeof useTheme>['fontSize'];
  fontWeight: ReturnType<typeof useTheme>['fontWeight'];
  radii: ReturnType<typeof useTheme>['radii'];
};

function StatTile({ label, value, testID, colors, spacing, fontSize, fontWeight, radii }: StatTileProps) {
  return (
    <View
      style={{
        flexBasis: '48%',
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[3],
        borderRadius: radii.md,
        backgroundColor: colors.surface2,
      }}
      testID={testID}
    >
      <Text style={{ color: colors.textMuted, fontSize: 10, letterSpacing: 1 }}>
        {label.toUpperCase()}
      </Text>
      <Text
        style={{
          color: colors.textStrong,
          fontSize: fontSize.lg,
          fontWeight: fontWeight.bold,
          marginTop: spacing[1],
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});