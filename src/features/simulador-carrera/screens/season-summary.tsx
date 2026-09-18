import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { useLocale } from '@/i18n/locale-context';
import { useCareerStore } from '@/shared/store/careerStore';
import { ACADEMY_CLUBS } from '@/features/career/clubs';
import {
  applySeasonRollover,
  buildStandings,
  shouldRollover,
} from '@/features/career/season-rollover';

/**
 * MGC-487 — Pantalla de cierre de temporada (Step 6 de la spec) +
 * MGC-703 — i18n `seasonEnd.*` namespace (reemplaza los placeholders
 * F2 hardcoded en español — QA MGC-689 FAIL crítico 2/6 mostraba
 * keys crudos como `copero.seasonEndTitle`, `COPERO.POINTS/RECORD`,
 * `copero.confirmResetTitle`).
 *
 * Recibe `champion` opcional vía route params (set por playoff.tsx
 * al cerrar la final). Aplica el rollover puro (`applySeasonRollover`)
 * y persiste vía el `careerStore` (que ya tiene `flushPendingSave`).
 *
 * i18n: todos los strings vienen de `t('seasonEnd.*)` para que el
 * LanguageSwitcher propague a esta pantalla igual que al resto de
 * las superficies. Los labels de stats (`pointsLabel`, `recordLabel`,
 * `goalsLabel`, `goalDiffLabel`) se renderizan en MAYÚSCULAS vía
 * `textTransform: 'uppercase'` para paridad visual con el badge
 * "MVP" del post-match (MGC-246) y los stats del fin-carrera
 * (MGC-1736).
 */
export default function SeasonSummaryScreen() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const { colors, radii, spacing, fontSize, fontWeight, borderWidth } = useTheme();
  const profile = useCareerStore((s) => s.profile);
  const seed = useCareerStore((s) => s.seed);

  const userClub = profile?.club?.name ?? ACADEMY_CLUBS[0]?.name ?? 'CDP';

  const standings = useMemo(
    () => buildStandings(seed ?? 1, ACADEMY_CLUBS.map((c) => c.name), 38),
    [seed],
  );

  const userRow = useMemo(
    () => standings.find((r) => r.club === userClub) ?? null,
    [standings, userClub],
  );

  const finalPosition = userRow?.position ?? 1;
  const totalTeams = standings.length;
  const points = userRow?.points ?? 0;
  const wins = userRow?.won ?? 0;
  const draws = userRow?.drawn ?? 0;
  const losses = userRow?.lost ?? 0;
  const goalsFor = userRow?.goalsFor ?? 0;
  const goalsAgainst = userRow?.goalsAgainst ?? 0;
  const goalDiff = goalsFor - goalsAgainst;
  const record = `${wins}-${draws}-${losses}`;
  const goals = `${goalsFor}-${goalsAgainst}`;

  const canRollover =
    profile !== null &&
    shouldRollover({
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

  // MGC-703 — modal de confirmación para "Nueva temporada" (antes
  // llamada "Nueva partida" en fin-carrera). Sigue el patrón de
  // fin-carrera.tsx (MGC-215 / MGC-1736): Modal nativo, tap fuera
  // cierra, accesibilidad role="alert".
  const [confirming, setConfirming] = useState(false);
  const openConfirm = useCallback(() => {
    if (!canRollover) return;
    setConfirming(true);
  }, [canRollover]);
  const cancelConfirm = useCallback(() => setConfirming(false), []);

  const onConfirm = useCallback(() => {
    // MGC-703 / MGC-629 iter4 — NO flipar `confirming=false` en este
    // handler. El `<Modal>` nativo de RN sobre Android monta un
    // `DialogFragment` que retiene la transición del stack hasta
    // dismissarse. Cualquier `setConfirming(false)` en el batch del
    // onPress (sync, microtask vía InteractionManager, o macrotask vía
    // setTimeout) dismissea el DialogFragment ANTES que el
    // router.replace commitee el stack swap → expo-router aborta la
    // navegación silenciosamente y el usuario queda en season-summary
    // con el modal cerrado (QA MGC-689 — reproduce anti-pattern
    // MGC-614/618). Patrón validado por iter1..iter4 de MGC-629:
    // el Modal se desmonta cuando season-summary unmounts como parte
    // de la transición. Ver memoria mgc-celebration-modal-backdrop-fix.
    router.replace('/simulador-carrera/season-hub');
  }, [router]);

  const seasonNum = profile?.season ?? 1;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.bg }]}
      edges={['bottom']}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { padding: spacing[4], gap: spacing[5], paddingBottom: spacing[10] },
        ]}
        testID="season-summary-scroll"
      >
        {/* Hero — trophy + título */}
        <View
          style={{ gap: spacing[3], alignItems: 'center', paddingVertical: spacing[4] }}
        >
          <Text
            style={{ fontSize: 72 }}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            🏆
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 12,
              fontWeight: fontWeight.bold,
              letterSpacing: 2,
            }}
            accessibilityRole="header"
          >
            {t('seasonEnd.eyebrow', { season: seasonNum, locale })}
          </Text>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize['2xl'],
              fontWeight: fontWeight.bold,
              textAlign: 'center',
            }}
            accessibilityRole="header"
            testID="season-end-title"
          >
            {t('seasonEnd.title')}
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: fontSize.base,
              textAlign: 'center',
            }}
            testID="season-end-subtitle"
          >
            {t('seasonEnd.subtitle')}
          </Text>
        </View>

        {/* Posición final */}
        <View
          style={{
            borderRadius: radii.lg,
            borderWidth: borderWidth?.hairline ?? 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: spacing[5],
            alignItems: 'center',
            gap: spacing[2],
          }}
          testID="season-end-position-card"
        >
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 12,
              fontWeight: fontWeight.bold,
              letterSpacing: 2,
            }}
          >
            {t('seasonEnd.finalPosition')}
          </Text>
          <Text
            style={{
              color: colors.primary,
              fontSize: fontSize['3xl'] ?? 48,
              fontWeight: fontWeight.bold,
            }}
            testID="season-end-position-value"
          >
            #{finalPosition}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
            {t('seasonEnd.ofTeams', { total: totalTeams })}
          </Text>
        </View>

        {/* Stats grid 2×2 */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] }}>
          <Stat
            label={t('seasonEnd.pointsLabel')}
            value={`${points}`}
            flexBasis="47%"
          />
          <Stat
            label={t('seasonEnd.recordLabel')}
            value={record}
            flexBasis="47%"
          />
          <Stat
            label={t('seasonEnd.goalsLabel')}
            value={goals}
            flexBasis="47%"
          />
          <Stat
            label={t('seasonEnd.goalDiffLabel')}
            value={`${goalDiff >= 0 ? '+' : ''}${goalDiff}`}
            flexBasis="47%"
          />
        </View>

        {/* Rollover preview */}
        {rolloverPreview && (
          <View
            style={{
              borderRadius: radii.md,
              borderWidth: borderWidth?.hairline ?? 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              padding: spacing[4],
              gap: spacing[1],
            }}
          >
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
              {t('seasonEnd.rolloverWeekLabel', { week: profile?.week ?? 38 })}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
              {t('seasonEnd.rolloverNextLabel', { season: rolloverPreview.season })}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
              {t('seasonEnd.rolloverAgeLabel', { age: rolloverPreview.age })}
            </Text>
          </View>
        )}

        {/* CTA — Nueva temporada */}
        <Button
          label={t('seasonEnd.newGame')}
          onPress={openConfirm}
          variant="primary"
          size="lg"
          fullWidth
          disabled={!canRollover}
          accessibilityHint={t('seasonEnd.newGameHint')}
          testID="season-summary-confirm"
          hitSlop={44}
        />
      </ScrollView>

      {/* MGC-703 — Modal confirmación "Nueva temporada" */}
      <Modal
        visible={confirming}
        transparent
        animationType="fade"
        onRequestClose={cancelConfirm}
        testID="season-summary-confirm-modal"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('seasonEnd.confirmResetDismiss')}
          onPress={cancelConfirm}
          style={{
            flex: 1,
            backgroundColor: 'rgba(8, 12, 20, 0.65)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: spacing[5],
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              width: '100%',
              maxWidth: 420,
              borderRadius: radii.lg,
              borderWidth: borderWidth?.hairline ?? 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              padding: spacing[5],
              gap: spacing[4],
            }}
          >
            <Text
              accessibilityRole="header"
              style={{
                color: colors.textStrong,
                fontSize: fontSize.lg,
                fontWeight: fontWeight.bold,
              }}
              testID="season-summary-confirm-title"
            >
              {t('seasonEnd.confirmResetTitle')}
            </Text>
            <Text
              style={{
                color: colors.textMuted,
                fontSize: fontSize.base,
                lineHeight: (fontSize.base ?? 16) * 1.4,
              }}
            >
              {t('seasonEnd.confirmResetBody', { season: seasonNum })}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing[3] }}>
              <View style={{ flex: 1 }}>
                <Button
                  label={t('seasonEnd.confirmResetCancel')}
                  onPress={cancelConfirm}
                  variant="secondary"
                  fullWidth
                  hitSlop={44}
                  testID="season-summary-confirm-cancel"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label={t('seasonEnd.confirmResetAction')}
                  onPress={onConfirm}
                  variant="primary"
                  fullWidth
                  hitSlop={44}
                  testID="season-summary-confirm-accept"
                />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({
  label,
  value,
  flexBasis,
}: {
  label: string;
  value: string;
  flexBasis: `${number}%`;
}) {
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  return (
    <View
      style={{
        flexBasis,
        flexGrow: 1,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        paddingVertical: spacing[4],
        paddingHorizontal: spacing[3],
        alignItems: 'center',
        gap: spacing[1],
      }}
    >
      <Text
        style={{
          color: colors.textStrong,
          fontSize: fontSize.xl,
          fontWeight: fontWeight.bold,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 11,
          fontWeight: fontWeight.bold,
          letterSpacing: 2,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {},
});
