/**
 * MGC-1903 — F4 social events UI (MGC-1738 / MGC-1762).
 *
 * Pantalla fullscreen que consume `state.socialEventPending` que el motor
 * ya roló durante `resolveMatchweek` (motor F4 — ver
 * `src/features/career/social-events.ts`). Muestra:
 *
 *   1. Los 4 outcomes posibles (timba / asado / tour / quedarse) con
 *      `social_<id>_title` / `social_<id>_body`. El outcome sorteado va
 *      destacado como "Te tocó" con borde primario.
 *   2. El resumen de modificadores que el motor ya merged
 *      (`mergeModifiers(postMatch, social)`) en `nextWeekModifiers`.
 *   3. Botón "Continuar" que dispara `clearPostMatch` para drenar el
 *      pending (AC3 del issue) y navega al dashboard.
 *
 * No re-rolea el evento: el motor ya consumió el RNG snapshot y dejó el
 * cursor avanzado en `state.rng` (MGC-1676). Esta pantalla es
 * estrictamente consumer; cualquier `runSocialEvent` extra desde acá
 * rompería la replay determinista del motor F4.
 *
 * Acceptance criteria (MGC-1903):
 *   AC1 — APK muestra los 4 outcomes visibles.
 *   AC2 — El outcome sorteado persiste los modificadores ya merged en
 *         `state.nextWeekModifiers` (sin re-aplicar).
 *   AC3 — `socialEventPending` queda `null` tras pulsar "Continuar".
 *   AC4 — No regresión: la pantalla no toca `position-tree` /
 *         `decision-tree`.
 *   AC5 — Walk QA visual F4 PASS.
 */
import React, { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { useSocialCopy } from '@/design/copy/social-events-i18n';
import { useCareerStore } from '@/shared/store/careerStore';
import {
  type SocialEvent,
  type SocialEventId,
} from '@/features/career/social-events';
import type { NextWeekModifiers } from '@/features/career/events';
import { NO_MODIFIERS } from '@/features/career/events';

/* ── Tipos locales ───────────────────────────────────────────────── */

const ALL_OUTCOMES: readonly SocialEventId[] = [
  'timba',
  'asado',
  'tour',
  'quedarse',
] as const;

type SocialCardProps = {
  id: SocialEventId;
  title: string;
  body: string;
  highlighted: boolean;
  testID: string;
  highlightLabel: string;
  highlightA11y: string;
};

/* ── Componente principal ─────────────────────────────────────────── */

export default function SocialEventsScreen() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();

  const socialEventPending = useCareerStore((s) => s.socialEventPending);
  // MGC-2011 — `nextWeekModifiers` es opcional en el save state (F2.x
  // legacy sin el campo). Default a `NO_MODIFIERS` para que `ModifiersCard`
  // reciba siempre un valor definido (TS2322 fix) y matches legacy sin
  // modificadores previos no rompan el render.
  const nextWeekModifiers = useCareerStore(
    (s) => s.nextWeekModifiers ?? NO_MODIFIERS,
  );
  const clearPostMatch = useCareerStore((s) => s.clearPostMatch);

  const onContinue = useCallback(async () => {
    await clearPostMatch();
    router.replace('/simulador-carrera/dashboard');
  }, [clearPostMatch, router]);

  const rolledOutcome = socialEventPending?.id ?? null;

  // MGC-2006 — copy localizado. `useSocialCopy` resuelve contra el
  // CopyMatrix del `locale` activo (es / en / zh-CN) con fallback a es-AR.
  const t = useSocialCopy();

  const titleByOutcome = useMemo<Record<SocialEventId, string>>(
    () => ({
      timba: t(`social_timba_title`),
      asado: t(`social_asado_title`),
      tour: t(`social_tour_title`),
      quedarse: t(`social_quedarse_title`),
    }),
    [t],
  );

  const bodyByOutcome = useMemo<Record<SocialEventId, string>>(
    () => ({
      timba: t(`social_timba_body`),
      asado: t(`social_asado_body`),
      tour: t(`social_tour_body`),
      quedarse: t(`social_quedarse_body`),
    }),
    [t],
  );

  // Si el estado se vació por un clear desde otra pantalla (force-stop +
  // vuelta al hub, p.e.) redirigimos al dashboard. Esta ruta no debería
  // ser alcanzable desde navegación normal: post-match.tsx sólo navega
  // acá si `socialEventPending` está poblado.
  if (!socialEventPending || !rolledOutcome) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.bg }]}
        edges={['bottom']}
      >
        <View style={styles.center} testID="social-events-redirect" />
      </SafeAreaView>
    );
  }

  const highlightLabel = t('social_events_rolled_label');
  const highlightA11y = (event: SocialEvent): string =>
    t('social_events_rolled_a11y', {
      name: titleByOutcome[event.id],
      body: bodyByOutcome[event.id],
    });

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.bg }]}
      edges={['bottom']}
      testID="social-events-screen"
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.container,
          {
            gap: spacing[4],
            padding: spacing[4],
          },
        ]}
        testID="social-events-scroll"
      >
        {/* Hero / chrome */}
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
            {t('social_events_eyebrow')}
          </Text>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize.lg,
              fontWeight: fontWeight.bold,
            }}
            accessibilityRole="header"
          >
            {t('social_events_title')}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
            {t('social_events_subtitle')}
          </Text>
        </View>

        {/* Outcome sorteado (highlighted) */}
        <OutcomeCard
          id={rolledOutcome}
          title={titleByOutcome[rolledOutcome]}
          body={bodyByOutcome[rolledOutcome]}
          highlighted
          testID={`social-events-card-${rolledOutcome}`}
          highlightLabel={highlightLabel}
          highlightA11y={highlightA11y(socialEventPending)}
        />

        {/* Listado completo de outcomes */}
        <View
          style={{
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: spacing[4],
            gap: spacing[3],
          }}
          testID="social-events-all-outcomes"
        >
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 10,
              letterSpacing: 2,
              fontWeight: fontWeight.bold,
            }}
          >
            {t('social_events_mods_title')}
          </Text>
          {ALL_OUTCOMES.map((id) => (
            <OutcomeCard
              key={id}
              id={id}
              title={titleByOutcome[id]}
              body={bodyByOutcome[id]}
              highlighted={id === rolledOutcome}
              testID={`social-events-list-${id}`}
              highlightLabel={highlightLabel}
              highlightA11y={
                id === rolledOutcome ? highlightA11y(socialEventPending) : ''
              }
            />
          ))}
        </View>

        {/* Modificadores */}
        <ModifiersCard
          modifiers={nextWeekModifiers ?? NO_MODIFIERS}
          luckGatePassed={socialEventPending.luckGatePassed}
          t={t}
        />
      </ScrollView>

      {/* Footer sticky */}
      <View
        testID="social-events-cta-footer"
        collapsable={false}
        style={{
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        }}
      >
        <Button
          label={t('social_events_cta_continue')}
          onPress={onContinue}
          variant="primary"
          size="lg"
          fullWidth
          testID="btn-social-events-continue"
          accessibilityHint={t('social_events_cta_continue_hint')}
          hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
        />
      </View>
    </SafeAreaView>
  );
}

/* ── Subcomponentes ──────────────────────────────────────────────── */

function OutcomeCard({
  id,
  title,
  body,
  highlighted,
  testID,
  highlightLabel,
  highlightA11y,
}: SocialCardProps) {
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();

  const borderColor = highlighted ? colors.primary : colors.border;
  const backgroundColor = highlighted ? colors.primarySoft : colors.surface;

  return (
    <View
      testID={testID}
      accessibilityLabel={highlighted && highlightA11y ? highlightA11y : undefined}
      style={{
        borderRadius: radii.md,
        borderWidth: highlighted ? 2 : 1,
        borderColor,
        backgroundColor,
        padding: spacing[3],
        gap: spacing[2],
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing[2],
        }}
      >
        <Text
          style={{
            color: highlighted ? colors.primary : colors.textStrong,
            fontSize: fontSize.md,
            fontWeight: fontWeight.bold,
            flexShrink: 1,
          }}
          numberOfLines={2}
        >
          {title}
        </Text>
        {highlighted ? (
          <View
            testID={`${testID}-badge`}
            style={{
              paddingHorizontal: spacing[2],
              paddingVertical: spacing[1],
              borderRadius: radii.pill,
              backgroundColor: colors.primary,
            }}
          >
            <Text
              style={{
                color: colors.textOnPrimary,
                fontSize: 10,
                fontWeight: fontWeight.bold,
                letterSpacing: 1,
              }}
            >
              {highlightLabel}
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        style={{
          color: highlighted ? colors.text : colors.textMuted,
          fontSize: fontSize.xs,
        }}
        numberOfLines={3}
      >
        {body}
      </Text>
      {/* Mantengo el id accesible en el DOM virtual para tests pero sin
          pintarlo (es metadata, no copy). */}
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={[styles.hidden, { color: 'transparent' }]}
      >
        {id}
      </Text>
    </View>
  );
}

function ModifiersCard({
  modifiers,
  luckGatePassed,
  t,
}: {
  modifiers: NextWeekModifiers;
  luckGatePassed: boolean;
  t: (id: string, values?: Record<string, string | number>) => string;
}) {
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();

  const isEmpty =
    modifiers.luckBonus === 0 &&
    modifiers.injuryRiskMul === 1 &&
    modifiers.trainingBoost === 1 &&
    modifiers.moralDelta === 0 &&
    modifiers.fatigueDelta === 0 &&
    modifiers.confianzaDelta === 0;

  if (isEmpty) {
    return (
      <View
        testID="social-events-mods-empty"
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
          {t('social_events_mods_title')}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
          {t('social_events_mods_empty')}
        </Text>
      </View>
    );
  }

  return (
    <View
      testID="social-events-mods"
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
        {t('social_events_mods_title')}
      </Text>
      {modifiers.luckBonus > 0 ? (
        <ModRow
          testID="social-events-mod-luck"
          label={t('social_outcome_mods_luck', {
            pct: Math.round(modifiers.luckBonus * 100),
          })}
        />
      ) : (
        <ModRow
          testID="social-events-mod-luck"
          label={
            luckGatePassed
              ? t('social_outcome_mods_luck', { pct: 0 })
              : t('social_events_mods_odds_luck_blocked')
          }
        />
      )}
      {modifiers.injuryRiskMul !== 1 ? (
        <ModRow
          testID="social-events-mod-injury"
          label={t('social_outcome_mods_injury', {
            val: modifiers.injuryRiskMul.toFixed(2),
          })}
        />
      ) : null}
      {modifiers.trainingBoost !== 1 ? (
        <ModRow
          testID="social-events-mod-training"
          label={t('social_outcome_mods_training', {
            val: modifiers.trainingBoost.toFixed(2),
          })}
        />
      ) : null}
      {modifiers.fatigueDelta !== 0 ? (
        <ModRow
          testID="social-events-mod-fatigue"
          label={t('social_outcome_mods_fatigue', {
            delta: formatDelta(modifiers.fatigueDelta),
          })}
        />
      ) : null}
      {modifiers.moralDelta !== 0 ? (
        <ModRow
          testID="social-events-mod-moral"
          label={t('social_outcome_mods_moral', {
            delta: formatDelta(modifiers.moralDelta),
          })}
        />
      ) : null}
      {modifiers.confianzaDelta !== 0 ? (
        <ModRow
          testID="social-events-mod-confianza"
          label={t('social_outcome_mods_confianza', {
            delta: formatDelta(modifiers.confianzaDelta),
          })}
        />
      ) : null}
    </View>
  );
}

function ModRow({ label, testID }: { label: string; testID: string }) {
  const { colors, radii, spacing, fontSize } = useTheme();
  return (
    <View
      testID={testID}
      style={{
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
        borderRadius: radii.md,
        backgroundColor: colors.surface2,
      }}
    >
      <Text style={{ color: colors.text, fontSize: fontSize.sm }}>{label}</Text>
    </View>
  );
}

function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1, flexShrink: 1 },
  container: {},
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});