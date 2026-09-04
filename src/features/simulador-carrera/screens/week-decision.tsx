import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { useLocale } from '@/i18n/locale-context';
import { useCareerStore } from '@/shared/store/careerStore';
import {
  WEEKLY_BASE_OPTIONS,
  type WeeklyBaseOptionId,
} from '@/features/career/position-tree';

/**
 * MGC-1649 [WF3/6] — WEEK DECISION (placeholder F1).
 *
 * 4 opciones fijas (doble turno · turno simple · descanso · entrenamiento
 * físico) que el jugador toca para cerrar la semana. F2 reemplaza este
 * placeholder por el árbol posicional completo (MGC-1629) — esta pantalla
 * queda sólo como referencia visual + smoke test del flow.
 *
 * Al tocar una opción se invoca `weeklyChoice(optionId)` que persiste vía
 * `flushPendingSave` y aplica `applyWeeklyChoice` (motor F2.3) sobre
 * `positionStats` + `career.fisico`. Cuando la opción es `doble_turno`
 * también se dispara `resolveMatchweek()` (mismo patrón que
 * `semanal.tsx`). Tras la choice, navegamos de vuelta al hub.
 *
 * Acceptance (MGC-1649):
 *  - Snapshot al cerrar: la persistencia de weeklyChoice cubre el
 *    snapshot de estado (careerStore.ts MGC-273 / MGC-284).
 *  - 4 opciones en es/en/zh-CN.
 *  - box-none footer (PR-394).
 *  - hitSlop 44dp en cada opción (PR-379).
 */
export default function WeekDecisionScreen() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  const { t } = useLocale();

  const profile = useCareerStore((s) => s.profile);
  const weeklyChoice = useCareerStore((s) => s.weeklyChoice);
  const resolveMatchweek = useCareerStore((s) => s.resolveMatchweek);

  /**
   * Las 4 opciones placeholder F1. Orden estable: doble_turno →
   * turno_simple → descanso → entrenamiento físico.
   */
  const options = useCallback(
    (): { id: WeeklyBaseOptionId; titleKey: string; descKey: string }[] => [
      {
        id: 'doble_turno',
        titleKey: 'weekDecision.optDoubleShift',
        descKey: 'weekDecision.optDoubleShiftDesc',
      },
      {
        id: 'turno_simple',
        titleKey: 'weekDecision.optSimpleShift',
        descKey: 'weekDecision.optSimpleShiftDesc',
      },
      {
        id: 'descanso',
        titleKey: 'weekDecision.optRest',
        descKey: 'weekDecision.optRestDesc',
      },
      {
        id: 'entrenamiento_fisico_especifico',
        titleKey: 'weekDecision.optTraining',
        descKey: 'weekDecision.optTrainingDesc',
      },
    ],
    [],
  )();

  const onPick = useCallback(
    async (optionId: WeeklyBaseOptionId) => {
      await weeklyChoice(optionId);
      if (optionId === 'doble_turno') {
        // Misma cadencia que `semanal.tsx`: doble turno consume partido,
        // resolvemos la matchweek antes de volver al hub para que
        // positionStats + matchweekStats queden actualizados.
        await resolveMatchweek();
      }
      router.replace('/simulador-carrera/season-hub');
    },
    [router, weeklyChoice, resolveMatchweek],
  );

  const onBack = useCallback(() => {
    router.back();
  }, [router]);

  const injured = profile.career.lesion.fechasOut > 0;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.bg }]}
      edges={['bottom']}
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
        testID="week-decision-scroll"
      >
        {/* Header */}
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
            accessibilityRole="header"
          >
            {t('weekDecision.eyebrow')}
          </Text>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize.lg,
              fontWeight: fontWeight.bold,
            }}
          >
            {t('seasonHub.week', { week: profile.week })}
          </Text>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize.md,
              fontWeight: fontWeight.bold,
            }}
          >
            {t('weekDecision.title')}
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: fontSize.xs,
            }}
          >
            {t('weekDecision.subtitle')}
          </Text>
        </View>

        {/* 4 opciones */}
        {options.map((opt) => {
          const meta = WEEKLY_BASE_OPTIONS[opt.id];
          const isInjuryGated = meta.requiresInjury && !injured;
          const isInjuryOnly = meta.requiresInjury === false && injured;
          // F1 placeholder: mostramos las 4 fijas. Sólo deshabilitamos
          // rehabilitación si no aplica (placeholder, no la listamos).
          return (
            <Pressable
              key={opt.id}
              onPress={() => onPick(opt.id)}
              disabled={isInjuryGated || isInjuryOnly}
              accessibilityRole="button"
              accessibilityLabel={t(opt.titleKey)}
              accessibilityHint={t(opt.descKey)}
              testID={`btn-week-option-${opt.id}`}
              hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
              style={({ pressed }) => ({
                borderRadius: radii.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: pressed ? colors.surface2 : colors.surface,
                padding: spacing[4],
                gap: spacing[2],
                opacity: isInjuryGated || isInjuryOnly ? 0.4 : 1,
              })}
            >
              <Text
                style={{
                  color: colors.textStrong,
                  fontSize: fontSize.md,
                  fontWeight: fontWeight.bold,
                }}
              >
                {t(opt.titleKey)}
              </Text>
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: fontSize.xs,
                }}
              >
                {t(opt.descKey)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Footer con back. hitSlop 44dp. */}
      <View
        testID="week-decision-cta-footer"
        collapsable={false}
        style={{
          height: 52 + spacing[2] * 2,
          flexBasis: 52 + spacing[2] * 2,
          flexGrow: 0,
          flexShrink: 0,
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[2],
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        }}
      >
        <Button
          label={t('weekDecision.backHint')}
          onPress={onBack}
          variant="secondary"
          size="lg"
          fullWidth
          testID="btn-week-decision-back"
          hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1, flexShrink: 1 },
  container: {},
});