import React, { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { useLocale } from '@/i18n/locale-context';
import { useCareerStore } from '@/shared/store/careerStore';
import { ACADEMY_CLUBS } from '@/features/career/clubs';
import { createRng } from '@/features/career/rng';
import {
  buildCalendar,
  buildStandings,
  phaseFromWeek,
  PHASE_LABELS,
  PRETEMPORADA_WEEK,
  SEASON_LENGTH,
  type MatchdayRow,
  type SeasonPhase,
  type StandingRow,
} from '@/features/career/phase';

/**
 * MGC-212 — Calendar semanal jugable.
 *
 * Pantalla `/simulador-carrera/calendar`. Muestra el calendario completo
 * de la temporada (38 fechas + pretemporada), la fase actual
 * (pretemporada / regular / playoff / relegación / fin), la posición del
 * club del jugador en la tabla y un botón "Avanzar semana" que dispara
 * `advance()` desde el store. Cuando la fase es `fin`, ofrece
 * "Nueva temporada" (`advanceSeason()`). Antes de la fecha 1 hay
 * pretemporada y el botón dice "Empezar temporada".
 *
 * Acceptance criteria (MGC-212 §2):
 *  - Lista 38 fechas, marca la semana actual.
 *  - Botón "Avanzar semana" persiste y bumpea la semana.
 *  - 38 avances llegan a `fin` sin errores.
 *  - Al haber fecha agendada, auto-dispara match (lo hace el weekly
 *    screen F2.3 — acá sólo abrimos el chain).
 *  - Persistencia local vía `careerStore` (ya cubierta por
 *    `flushPendingSave()` en cada mutación).
 */
export default function CalendarScreen() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  const { t } = useLocale();

  const profile = useCareerStore((s) => s.profile);
  const advance = useCareerStore((s) => s.advance);
  const advanceSeason = useCareerStore((s) => s.advanceSeason);

  const week = Math.max(0, profile.week ?? PRETEMPORADA_WEEK);
  const season = Math.max(1, profile.season ?? 1);

  // Seed determinista para que el calendario sea estable entre cargas.
  // MGC-212 §3: QA valida 1 carrera completa con seed fijo.
  const seed = useMemo(() => {
    const fromName = (profile.name ?? 'copero')
      .split('')
      .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return (fromName * 31 + season * 1009) >>> 0;
  }, [profile.name, season]);

  const opponents = useMemo(
    () => ACADEMY_CLUBS.map((c) => c.name),
    [],
  );

  // Construye el calendario (38 fechas) y marca jugadas hasta `week`.
  const calendar = useMemo<MatchdayRow[]>(() => {
    const rng = createRng(seed);
    const rows = buildCalendar(
      seed,
      opponents,
      { int: (min, max) => rng.int(min, max) },
    );
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].week < week) rows[i] = { ...rows[i], result: 'draw' };
    }
    if (week >= 1 && week <= SEASON_LENGTH) {
      const idx = week - 1;
      rows[idx] = { ...rows[idx], result: 'pendiente' };
    }
    return rows;
  }, [seed, opponents, week]);

  const phase: SeasonPhase = useMemo(() => {
    if (week >= SEASON_LENGTH) return 'fin';
    return phaseFromWeek(week, null);
  }, [week]);

  const standings: StandingRow[] = useMemo(() => {
    const clubs = opponents.length > 0 ? opponents : ['Libre'];
    return buildStandings(seed, clubs, week);
  }, [seed, opponents, week]);

  const clubPosition = useMemo(() => {
    const own = profile.club?.name ?? opponents[0] ?? 'Tu club';
    const idx = standings.findIndex((row) => row.club === own);
    return idx >= 0 ? standings[idx].position : null;
  }, [profile.club?.name, standings, opponents]);

  const onAdvanceWeek = useCallback(async () => {
    await advance();
    // Auto-trigger del chain al partido cuando entramos en una fecha
    // regular nueva (semana 1..37). En pretemporada y `fin` no
    // disparamos match (sería antifuncional).
    if (week + 1 >= 1 && week + 1 < SEASON_LENGTH) {
      router.push('/simulador-carrera/match');
    }
  }, [advance, router, week]);

  const onAdvanceSeason = useCallback(async () => {
    await advanceSeason();
  }, [advanceSeason]);

  const isPretemporada = week === PRETEMPORADA_WEEK;
  const isFin = phase === 'fin';
  const ctaLabel = isPretemporada
    ? t('calendar.cta.startSeason')
    : isFin
      ? t('calendar.cta.newSeason')
      : t('calendar.cta.advanceWeek');
  const onCta = isFin ? onAdvanceSeason : onAdvanceWeek;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.bg }]}
      edges={['bottom']}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.container,
          { gap: spacing[4], padding: spacing[4] },
        ]}
        testID="calendar-screen"
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
              fontSize: 12,
              fontWeight: fontWeight.bold,
              letterSpacing: 2,
            }}
            accessibilityRole="header"
            testID="calendar-eyebrow"
          >
            {t('calendar.eyebrow')}
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
              testID="calendar-title"
            >
              {t('calendar.title', { season })}
            </Text>
            <View
              style={{
                paddingHorizontal: spacing[2],
                paddingVertical: 4,
                borderRadius: radii.pill,
                backgroundColor: phase === 'fin' ? colors.accent : colors.bg,
                borderColor: colors.border,
                borderWidth: 1,
              }}
              testID="calendar-phase-pill"
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: 11,
                  fontWeight: fontWeight.bold,
                  letterSpacing: 1,
                }}
              >
                {PHASE_LABELS[phase].toUpperCase()}
              </Text>
            </View>
          </View>
          <Text
            style={{ color: colors.textMuted, fontSize: fontSize.sm }}
            testID="calendar-week-label"
          >
            {isPretemporada
              ? t('calendar.week.pre')
              : t('calendar.week.current', { week })}
          </Text>
        </View>

        {/* Tabla de posiciones (snippet) */}
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
              color: colors.textStrong,
              fontSize: fontSize.base,
              fontWeight: fontWeight.bold,
            }}
          >
            {t('calendar.standingsTitle')}
          </Text>
          {standings.slice(0, 5).map((row) => (
            <View
              key={row.club}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: spacing[1],
              }}
            >
              <Text style={{ color: colors.text, fontSize: fontSize.sm }}>
                {row.position}. {row.club}
              </Text>
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: fontSize.sm,
                  fontWeight:
                    row.club === profile.club?.name
                      ? fontWeight.bold
                      : fontWeight.regular,
                }}
              >
                {row.points} pts
              </Text>
            </View>
          ))}
          {clubPosition !== null ? (
            <Text
              style={{
                color: colors.textMuted,
                fontSize: fontSize.sm,
                marginTop: spacing[2],
              }}
              testID="calendar-own-position"
            >
              {t('calendar.ownPosition', { position: clubPosition })}
            </Text>
          ) : null}
        </View>

        {/* Lista 38 fechas */}
        <View
          style={{
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: spacing[2],
            gap: spacing[1],
          }}
        >
          {calendar.map((row) => {
            const isCurrent = row.week === week;
            return (
              <View
                key={row.index}
                testID={`calendar-row-${row.index}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: spacing[2],
                  paddingVertical: spacing[2],
                  borderRadius: radii.md,
                  backgroundColor: isCurrent ? colors.bg : 'transparent',
                  borderWidth: isCurrent ? 1 : 0,
                  borderColor: colors.accent,
                }}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: fontSize.sm,
                    fontWeight: isCurrent ? fontWeight.bold : fontWeight.regular,
                    width: 36,
                  }}
                >
                  J{row.index}
                </Text>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: fontSize.sm,
                    flex: 1,
                    paddingHorizontal: spacing[2],
                  }}
                  numberOfLines={1}
                >
                  {row.isHome ? 'vs ' : '@ '}
                  {row.opponent}
                </Text>
                <Text
                  style={{
                    color:
                      row.result === 'pendiente'
                        ? colors.textMuted
                        : colors.text,
                    fontSize: fontSize.xs,
                  }}
                >
                  {row.result === 'pendiente' ? '–' : 'OK'}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            padding: spacing[4],
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
        ]}
        testID="calendar-footer"
      >
        <Button
          label={ctaLabel}
          onPress={onCta}
          variant="primary"
          testID="calendar-advance-cta"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  container: { paddingBottom: 120 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
  },
});