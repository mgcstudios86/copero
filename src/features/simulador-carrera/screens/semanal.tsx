import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/design';
import { useCareerStore } from '@/shared/store/careerStore';
import {
  STAT_INIT,
  statsForPosition,
  type PositionStats,
  type StatKey,
} from '@/features/career/position-stats';
import { WEEKLY_BASE_OPTIONS, type WeeklyBaseOptionId } from '@/features/career/position-tree';

/**
 * MGC-1657 (F2.3) — Pantalla semanal V2.
 *
 * Reemplaza la decisión semanal V1 (`decide` con StrategyId) por el
 * catálogo data-only `WEEKLY_BASE_OPTIONS` (6 opciones). El reducer
 * `weeklyChoice` invoca `applyWeeklyChoice` que:
 *  1. Selecciona outcome del árbol posicional (`getPositionTree`).
 *  2. Aplica `applyStatDeltas` a `positionStats` (4 stats por línea).
 *  3. Evalúa `maybeRollInjury` post-choice.
 *  4. Persiste en AsyncStorage vía `flushPendingSave`.
 *
 * Esta pantalla solo se muestra cuando el stage es `season` o `club`
 * con club asignado. Las opciones se filtran según lesión activa.
 */
export default function SemanalScreen() {
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  const router = useRouter();
  const profile = useCareerStore((s) => s.profile);
  const weeklyChoice = useCareerStore((s) => s.weeklyChoice);
  const resolveMatchweek = useCareerStore((s) => s.resolveMatchweek);
  const startMatch = useCareerStore((s) => s.startMatch);

  const positionStats: PositionStats = profile.positionStats ?? STAT_INIT;

  // Solo los 4 stats que aplican a la posición del jugador.
  const relevantStats = useMemo<StatKey[]>(
    () => statsForPosition(profile.position),
    [profile.position],
  );

  const injured = profile.career.lesion.fechasOut > 0;

  const onPick = async (optionId: WeeklyBaseOptionId) => {
    await weeklyChoice(optionId);
    if (optionId === 'doble_turno') {
      // doble turno consume partido → resolvemos matchweek tras la choice.
      await resolveMatchweek();
      // MGC-1802 P0-6 — wire UI→match: cargamos el MatchOutcome en
      // matchStore (transient) y navegamos a /match. Antes la mutación
      // de apps/goals quedaba invisible porque ningún componente
      // navegaba al resultado del partido (QA MGC-1739: 'Jugar temporada'
      // simulaba 38 semanas silenciosamente).
      await startMatch();
      router.push('/simulador-carrera/match');
    }
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.bg }]}
      edges={['bottom']}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { gap: spacing[4], padding: spacing[4] },
        ]}
        testID="semanal-screen"
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
              letterSpacing: 2,
              fontWeight: fontWeight.bold,
            }}
          >
            SEMANA {profile.week}/38 · {profile.position}
          </Text>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize.lg,
              fontWeight: fontWeight.bold,
            }}
            accessibilityRole="header"
          >
            Decisión semanal V2
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
            6 opciones con árbol posicional · {injured ? 'Lesión activa: solo rehabilitación' : 'Elegí una opción'}
          </Text>
        </View>

        {/* Stats posicionales (los 4 de la posición) */}
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
            STATS POSICIONALES
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
            {relevantStats.map((k) => (
              <View
                key={k}
                style={{
                  flexBasis: '48%',
                  paddingHorizontal: spacing[2],
                  paddingVertical: spacing[2],
                  borderRadius: radii.md,
                  backgroundColor: colors.surface2,
                }}
              >
                <Text style={{ color: colors.textMuted, fontSize: 10 }}>{k}</Text>
                <Text
                  style={{
                    color: colors.textStrong,
                    fontSize: fontSize.md,
                    fontWeight: fontWeight.bold,
                  }}
                  testID={`stat-${k}`}
                >
                  {positionStats[k] ?? STAT_INIT[k]}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Opciones semanales */}
        {(Object.values(WEEKLY_BASE_OPTIONS) as (typeof WEEKLY_BASE_OPTIONS[WeeklyBaseOptionId])[]).map(
          (opt) => {
            const requiresInjury = !!opt.requiresInjury;
            const blocked = injured ? !requiresInjury : false;
            const visible = requiresInjury ? injured : !injured;
            if (!visible) return null;
            return (
              <View
                key={opt.id}
                style={{
                  borderRadius: radii.lg,
                  borderWidth: 1,
                  borderColor: blocked ? colors.border : colors.primary,
                  backgroundColor: blocked ? colors.surface2 : colors.primarySoft,
                  padding: spacing[4],
                  gap: spacing[2],
                  opacity: blocked ? 0.5 : 1,
                }}
              >
                <Text
                  style={{
                    color: colors.textStrong,
                    fontSize: fontSize.md,
                    fontWeight: fontWeight.bold,
                  }}
                >
                  {opt.id.replace(/_/g, ' ').toUpperCase()}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
                  prob: {Math.round(opt.prob * 100)}% · deltas posicionales:{' '}
                  {Object.keys(opt.successDeltas).join(', ') || 'ninguno'}
                </Text>
                <Text
                  style={{
                    color: blocked ? colors.textMuted : colors.primary,
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
                  }}
                  onPress={blocked ? undefined : () => onPick(opt.id)}
                  accessibilityRole={blocked ? 'text' : 'button'}
                  accessibilityLabel={`Elegir ${opt.id}`}
                  accessibilityState={{ disabled: blocked }}
                  testID={`btn-semanal-${opt.id}`}
                >
                  {blocked ? 'Bloqueado por lesión' : 'Elegir →'}
                </Text>
              </View>
            );
          },
        )}

        {injured ? (
          <View
            testID="semanal-injury-banner"
            style={{
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: colors.primary,
              backgroundColor: colors.primarySoft,
              padding: spacing[4],
              gap: spacing[1],
            }}
          >
            <Text
              style={{
                color: colors.primary,
                fontSize: fontSize.lg,
                fontWeight: fontWeight.bold,
              }}
            >
              LESIÓN ACTIVA
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
              {profile.career.lesion.kind} · {profile.career.lesion.fechasOut} semanas restantes.
              Solo rehabilitación.
            </Text>
          </View>
        ) : null}

        {/* Matchweek result */}
        {profile.career.matchweekStats &&
        (profile.career.matchweekStats.apps ?? 0) > 0 ? (
          <View
            testID="semanal-matchweek-stats"
            style={{
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              padding: spacing[4],
              gap: spacing[1],
            }}
          >
            <Text style={{ color: colors.textMuted, fontSize: 10, letterSpacing: 2 }}>
              ÚLTIMA MATCHWEEK
            </Text>
            <Text
              style={{
                color: colors.textStrong,
                fontSize: fontSize.md,
                fontWeight: fontWeight.bold,
              }}
            >
              {profile.career.matchweekStats.apps} P ·{' '}
              {profile.career.matchweekStats.goals} G ·{' '}
              {profile.career.matchweekStats.ast} A
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {},
});
