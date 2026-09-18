import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { ACADEMY_CLUBS } from '@/features/career/clubs';
import { useCareerStore } from '@/shared/store/careerStore';
import {
  advancePlayoffRound,
  bracketChampion,
  buildPlayoffBracket,
  type PlayoffMatch,
  type PlayoffRound,
} from '@/features/career/playoff';
import type { Club } from '@/types/career';

// MGC-487 — Bracket UI de playoffs nacionales (semanas 35–38).
// Renderiza el bracket por ronda y permite avanzar la ronda
// (cuartos → semis → final) usando el helper puro `advancePlayoffRound`.
// MVP: el engine real de partidos (`match.ts#resolveMatch`) reemplaza
// el 50/50 placeholder cuando se integre con la fase semanal.

const ROUND_LABEL: Record<PlayoffRound, string> = {
  quarter: 'Cuartos',
  semi: 'Semifinales',
  final: 'Final',
};

const ROUND_ORDER: PlayoffRound[] = ['quarter', 'semi', 'final'];

function buildRng(seed: number) {
  let s = seed >>> 0;
  return {
    int: (min: number, max: number) => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      const r = ((t ^ (t >>> 14)) >>> 0) % (max - min + 1);
      return min + r;
    },
  };
}

function seedTopEight(profile: { club?: Club | null; seed: number }): string[] {
  const pool = ACADEMY_CLUBS.filter((c) => c.id !== profile.club?.id);
  const seedBase = profile.seed + (profile.club?.id.charCodeAt(0) ?? 0);
  const sorted = [...pool].sort((a, b) => {
    const ha = (a.id.charCodeAt(0) + seedBase) % 1000;
    const hb = (b.id.charCodeAt(0) + seedBase) % 1000;
    return hb - ha;
  });
  return sorted.slice(0, 8).map((c) => c.name);
}

export default function PlayoffScreen() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();

  const profile = useCareerStore((s) => s.profile);

  // Seed estable basado en la temporada y semana (35+ activa playoffs).
  const seed = useMemo(
    () => (profile?.season ?? 1) * 1009 + (profile?.week ?? 35),
    [profile?.season, profile?.week],
  );

  const seeded = useMemo(
    () =>
      seedTopEight({
        club: profile?.club ?? null,
        seed,
      }),
    [profile?.club, seed],
  );

  const [bracket, setBracket] = useState<PlayoffMatch[]>(() =>
    buildPlayoffBracket(seeded, buildRng(seed)),
  );

  const champion = bracketChampion(bracket);

  const onAdvanceRound = useCallback(() => {
    setBracket((current) => advancePlayoffRound(current, buildRng(seed + current.length)));
  }, [seed]);

  const onCloseSeason = useCallback(() => {
    router.push('/simulador-carrera/season-summary');
  }, [router]);

  const onBack = useCallback(() => {
    router.back();
  }, [router]);

  const isFinalResolved = champion !== null;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.bg }]}
      edges={['bottom']}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { padding: spacing[4], gap: spacing[4] },
        ]}
        testID="playoff-scroll"
      >
        <View style={{ gap: spacing[1] }}>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 12,
              fontWeight: fontWeight.bold,
              letterSpacing: 2,
            }}
            accessibilityRole="header"
          >
            MGC-487 · PLAYOFFS
          </Text>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize['2xl'],
              fontWeight: fontWeight.bold,
            }}
            accessibilityLabel={`Temporada ${profile?.season ?? 1} · playoffs`}
          >
            Temporada {profile?.season ?? 1} · playoffs
          </Text>
        </View>

        {ROUND_ORDER.map((round) => {
          const matches = bracket.filter((m) => m.round === round);
          if (matches.length === 0) return null;
          return (
            <View
              key={round}
              style={{
                borderRadius: radii.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                padding: spacing[3],
                gap: spacing[2],
              }}
              testID={`playoff-round-${round}`}
            >
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: 12,
                  fontWeight: fontWeight.bold,
                  letterSpacing: 2,
                }}
              >
                {ROUND_LABEL[round]}
              </Text>
              {matches.map((match) => (
                <Pressable
                  key={`${match.round}-${match.slot}`}
                  style={{
                    borderRadius: radii.md,
                    backgroundColor:
                      match.winner === match.home
                        ? colors.primary
                        : colors.bg,
                    borderWidth: 1,
                    borderColor:
                      match.winner === match.away
                        ? colors.primary
                        : colors.border,
                    padding: spacing[3],
                    gap: spacing[1],
                  }}
                  accessibilityLabel={`${match.home} vs ${match.away} · ${ROUND_LABEL[match.round]}`}
                >
                  <View style={styles.matchRow}>
                    <Text
                      style={{
                        color:
                          match.winner === match.home
                            ? colors.textOnPrimary
                            : colors.text,
                        fontSize: fontSize.md,
                        fontWeight:
                          match.winner === match.home
                            ? fontWeight.bold
                            : fontWeight.regular,
                      }}
                    >
                      {match.home}
                    </Text>
                    {match.winner === match.home ? (
                      <Text style={{ color: colors.textOnPrimary }}>✓</Text>
                    ) : null}
                  </View>
                  <View style={styles.matchRow}>
                    <Text
                      style={{
                        color:
                          match.winner === match.away
                            ? colors.textOnPrimary
                            : colors.text,
                        fontSize: fontSize.md,
                        fontWeight:
                          match.winner === match.away
                            ? fontWeight.bold
                            : fontWeight.regular,
                      }}
                    >
                      {match.away}
                    </Text>
                    {match.winner === match.away ? (
                      <Text style={{ color: colors.textOnPrimary }}>✓</Text>
                    ) : null}
                  </View>
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontSize: 12,
                    }}
                  >
                    Semana {match.week}
                  </Text>
                </Pressable>
              ))}
            </View>
          );
        })}

        {champion ? (
          <View
            style={{
              borderRadius: radii.lg,
              borderWidth: 2,
              borderColor: colors.primary,
              backgroundColor: colors.surface,
              padding: spacing[4],
              alignItems: 'center',
              gap: spacing[2],
            }}
            testID="playoff-champion"
            accessibilityLabel={`Campeón: ${champion}`}
          >
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 12,
                fontWeight: fontWeight.bold,
                letterSpacing: 2,
              }}
            >
              🏆 CAMPEÓN
            </Text>
            <Text
              style={{
                color: colors.textStrong,
                fontSize: fontSize.xl,
                fontWeight: fontWeight.bold,
              }}
            >
              {champion}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            padding: spacing[4],
            gap: spacing[2],
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
          },
        ]}
      >
        {!isFinalResolved ? (
          <Button
            label="Avanzar ronda"
            onPress={onAdvanceRound}
            testID="playoff-advance-round"
            fullWidth
          />
        ) : (
          <Button
            label="Cerrar temporada"
            onPress={onCloseSeason}
            testID="playoff-close-season"
            fullWidth
          />
        )}
        <Button
          label="Volver"
          onPress={onBack}
          variant="ghost"
          fullWidth
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {},
  footer: {
    borderTopWidth: 1,
  },
  matchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
