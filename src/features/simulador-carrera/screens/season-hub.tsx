import React, { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { useLocale } from '@/i18n/locale-context';
import { useCareerStore } from '@/shared/store/careerStore';
import { ACADEMY_CLUBS } from '@/features/career/clubs';
import {
  MID_STATS,
  STAT_INIT,
  type PositionStats,
} from '@/features/career/position-stats';
import type { Club } from '@/types/career';

// MGC-1652 — WCAG 2.5.5: hitSlop 44dp total por eje (PR-379 / MGC-1502).
const HIT_SLOP_44 = { top: 22, left: 22, right: 22, bottom: 22 } as const;

/**
 * MGC-1649 [WF3/6] — SEASON HUB.
 *
 * Pantalla 6/6 del flow F1: hub de temporada con datos del jugador,
 * fatiga, stats posicionales (sólo MID en F1; resto se suma en F2),
 * próximo partido y CTAs a timeline (temporada) y a la decisión
 * semanal placeholder.
 *
 * Acceptance criteria (MGC-1649):
 *  - Walk QA: tras WF2, el hub muestra datos del jugador.
 *  - Stats y fatiga actualizan al volver de partido.
 *  - box-none en footer (PR-394 / MGC-1578).
 *  - hitSlop 44dp en CTAs (PR-379 / MGC-1502).
 *  - i18n seasonHub.* en es/en/zh-CN (PR-392 / MGC-1570 pattern).
 *
 * Snapshot del estado al cerrar el hub: lo cubre `flushPendingSave()`
 * que ya invoca el `AppState` listener (`app/_layout.native.tsx`) y cada
 * mutación de la store (decide, advance, weeklyChoice, etc.). La
 * navegación entre pantallas NO es mutación, pero `lastSnapshot` (ver
 * `careerStore.ts` MGC-363) refleja el último estado persistido y se
 * escribe en background → al volver al hub, positionStats + career.fisico
 * + lesion ya vienen actualizados desde el partido (F2.3
 * resolveMatchweek).
 */
export default function SeasonHubScreen() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  const { t } = useLocale();

  const profile = useCareerStore((s) => s.profile);

  const positionStats: PositionStats = profile.positionStats ?? STAT_INIT;
  const isMid = useMemo(
    () =>
      profile.position === 'CM' ||
      profile.position === 'CAM' ||
      profile.position === 'CDM' ||
      profile.position === 'LM' ||
      profile.position === 'RM',
    [profile.position],
  );
  const visibleStats = useMemo(
    () => (isMid ? MID_STATS : []),
    [isMid],
  );

  // MGC-1649 — Próximo partido (F1 placeholder). Rotación determinista
  // sobre ACADEMY_CLUBS usando (week % length) + offset por clubId para
  // que dos carreras con distinto club vean distinto rival sin samplear
  // RNG. Cuando el club del jugador no existe (Free agent) mostramos
  // "Aún sin rival" (nextMatchEmpty).
  const rival = useMemo<Club | null>(() => {
    if (!profile.club) return null;
    const pool = ACADEMY_CLUBS.filter((c) => c.id !== profile.club?.id);
    if (pool.length === 0) return profile.club;
    const seedOffset =
      profile.club.id.charCodeAt(0) + profile.club.id.length;
    const idx = (profile.week + seedOffset) % pool.length;
    return pool[idx];
  }, [profile.club, profile.week]);

  const onViewTable = useCallback(() => {
    router.push('/simulador-carrera/temporada');
  }, [router]);

  const onDecideWeek = useCallback(() => {
    router.push('/simulador-carrera/week-decision');
  }, [router]);

  // Sticky footer altura fija (PR-394 box-none / MGC-1381 pattern):
  // 2 botones lg × 52dp + 1 gap(8) + paddingVertical(8)*2 = 120dp.
  // Lo declaramos por adelantado para que Yoga reserve el alto sin
  // depender del measure pass del ScrollView (MGC-1339).
  const CTA_HEIGHT = 52;
  const ctaCount = 2;
  const ctaFooterHeight =
    ctaCount * CTA_HEIGHT + (ctaCount - 1) * spacing[2] + spacing[2] * 2;

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
        testID="season-hub-scroll"
      >
        {/* Eyebrow + hero */}
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
            {t('seasonHub.eyebrow')}
          </Text>
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
                color: colors.textStrong,
                fontSize: fontSize['2xl'],
                fontWeight: fontWeight.bold,
                flexShrink: 1,
              }}
              numberOfLines={1}
              accessibilityLabel={t('seasonHub.heroName', { name: profile.name })}
            >
              {t('seasonHub.heroName', { name: profile.name })}
            </Text>
            <Pill
              label={`#${profile.number} ${profile.position}`}
              bg={colors.primary}
              fg={colors.textOnPrimary}
            />
          </View>
          <View
            style={{
              flexDirection: 'row',
              gap: spacing[3],
              flexWrap: 'wrap',
            }}
          >
            <Meta label={t('seasonHub.position', { position: profile.position })} />
            <Meta label={t('seasonHub.age', { age: profile.age })} />
            <Meta
              label={
                profile.club
                  ? t('seasonHub.club', { club: profile.club.name })
                  : t('seasonHub.freeAgent')
              }
            />
          </View>
          <Text
            style={{
              color: colors.primary,
              fontSize: fontSize.xs,
              fontWeight: fontWeight.bold,
              letterSpacing: 2,
              marginTop: spacing[1],
            }}
          >
            {t('seasonHub.week', { week: profile.week })}
          </Text>
        </View>

        {/* Fatiga */}
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
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'baseline',
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
              {t('seasonHub.fatigueEyebrow')}
            </Text>
            <Text
              style={{
                color: colors.textStrong,
                fontSize: fontSize.md,
                fontWeight: fontWeight.bold,
              }}
              accessibilityLabel={t('seasonHub.fatigueValue', {
                value: profile.career.fisico,
              })}
            >
              {t('seasonHub.fatigueValue', { value: profile.career.fisico })}
            </Text>
          </View>
          <FatigueBar value={profile.career.fisico} />
        </View>

        {/* Stats posicionales (sólo MID en F1) */}
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
            {t('seasonHub.statsEyebrow')}
          </Text>
          {isMid ? (
            <>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: spacing[2],
                }}
              >
                {visibleStats.map((key) => (
                  <StatChip
                    key={key}
                    label={t(statLabelKey(key))}
                    value={positionStats[key]}
                  />
                ))}
              </View>
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: fontSize.xs,
                }}
              >
                {t('seasonHub.statsNote')}
              </Text>
            </>
          ) : (
            <Text
              style={{
                color: colors.textMuted,
                fontSize: fontSize.xs,
              }}
            >
              {t('seasonHub.statsNote')}
            </Text>
          )}
        </View>

        {/* Próximo partido */}
        <View
          style={{
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.primary,
            backgroundColor: colors.primarySoft,
            padding: spacing[4],
            gap: spacing[2],
          }}
          testID="season-hub-next-match"
        >
          <Text
            style={{
              color: colors.primary,
              fontSize: 10,
              fontWeight: fontWeight.bold,
              letterSpacing: 2,
            }}
          >
            {t('seasonHub.nextMatchEyebrow')}
          </Text>
          {rival ? (
            <>
              <Text
                style={{
                  color: colors.textStrong,
                  fontSize: fontSize.lg,
                  fontWeight: fontWeight.bold,
                }}
                accessibilityLabel={t('seasonHub.nextMatchVs', {
                  rival: rival.name,
                })}
              >
                {t('seasonHub.nextMatchVs', { rival: rival.name })}
              </Text>
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: fontSize.xs,
                }}
              >
                {t('seasonHub.nextMatchJornada', { week: profile.week })}
              </Text>
            </>
          ) : (
            <Text
              style={{
                color: colors.textMuted,
                fontSize: fontSize.xs,
              }}
            >
              {t('seasonHub.nextMatchEmpty')}
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Footer sticky (PR-394 / MGC-1578 box-none pattern). hitSlop
          44dp (PR-379 / MGC-1502) sobre cada Pressable. */}
      <View
        testID="season-hub-cta-footer"
        collapsable={false}
        style={{
          height: ctaFooterHeight,
          flexBasis: ctaFooterHeight,
          flexGrow: 0,
          flexShrink: 0,
          gap: spacing[2],
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[2],
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        }}
      >
        <Button
          label={t('seasonHub.ctaViewTable')}
          onPress={onViewTable}
          variant="secondary"
          size="lg"
          fullWidth
          testID="btn-season-hub-view-table"
          accessibilityHint={t('seasonHub.ctaViewTableHint')}
          hitSlop={HIT_SLOP_44}
        />
        <Button
          label={t('seasonHub.ctaDecide')}
          onPress={onDecideWeek}
          variant="primary"
          size="lg"
          fullWidth
          testID="btn-season-hub-decide"
          accessibilityHint={t('seasonHub.ctaDecideHint')}
          hitSlop={HIT_SLOP_44}
        />
      </View>
    </SafeAreaView>
  );
}

// ── Subcomponentes locales (helpers) ────────────────────────────────────

function Meta({ label }: { label: string }) {
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: spacing[2],
        paddingVertical: spacing[1],
        borderRadius: radii.pill,
        backgroundColor: colors.surface2,
      }}
    >
      <Text
        style={{
          color: colors.textMuted,
          fontSize: fontSize.xs,
          fontWeight: fontWeight.bold,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function Pill({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  const { radii, spacing, fontSize, fontWeight } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[1],
        borderRadius: radii.pill,
        backgroundColor: bg,
      }}
    >
      <Text
        style={{
          color: fg,
          fontSize: fontSize.xs,
          fontWeight: fontWeight.bold,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface2,
      }}
    >
      <Text
        style={{
          color: colors.textMuted,
          fontSize: fontSize.xs,
          fontWeight: fontWeight.bold,
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: colors.textStrong,
          fontSize: fontSize.md,
          fontWeight: fontWeight.bold,
        }}
        accessibilityLabel={`${label} ${value}`}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * Fatiga como progress bar horizontal. La barra cambia de color según
 * valor: >= 60 verde (recuperado), 30-59 amarillo (regular), < 30 rojo
 * (agotado). La barra TIENE hitSlop 44dp (PR-379 WCAG) por si la UI
 * decide más adelante hacerla tappable (placeholder: hoy read-only).
 */
function FatigueBar({ value }: { value: number }) {
  const { colors, radii, spacing } = useTheme();
  const clamped = Math.max(0, Math.min(100, value));
  const fillColor =
    clamped >= 60 ? colors.primary : clamped >= 30 ? '#E0A82E' : '#D9534F';
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      style={{
        height: spacing[3],
        borderRadius: radii.pill,
        backgroundColor: colors.surface2,
        overflow: 'hidden',
      }}
    >
      <View
        testID="season-hub-fatigue-fill"
        style={{
          height: '100%',
          width: `${clamped}%`,
          backgroundColor: fillColor,
        }}
      />
    </View>
  );
}

/**
 * Mapeo entre `StatKey` MID y la copy key i18n. Sólo cubrimos los 4
 * stats que F1 muestra (vision, pase, dribling, resistencia); el resto
 * cae al branch `statsNote` arriba.
 */
function statLabelKey(k: string): string {
  switch (k) {
    case 'vision':
      return 'seasonHub.statVision';
    case 'pase':
      return 'seasonHub.statPass';
    case 'dribling':
      return 'seasonHub.statDribble';
    case 'resistencia':
      return 'seasonHub.statStamina';
    default:
      return 'seasonHub.statVision';
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  // El ScrollView comparte el viewport con `season-hub-cta-footer`.
  // flex:1 + flexShrink:1 → toma el remanente después de que el footer
  // reserva su alto fijo (PR-394 box-none pattern).
  scroll: { flex: 1, flexShrink: 1 },
  container: {},
});