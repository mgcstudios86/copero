import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { ACADEMY_CLUBS } from '@/features/career/clubs';
import { createRng } from '@/features/career/rng';
import { useCareerStore } from '@/shared/store/careerStore';
import {
  advancePlayoffRound,
  bracketChampion,
  buildPlayoffBracket,
  type PlayoffMatch,
  type PlayoffRound,
} from '@/features/career/playoff';
import type { Club } from '@/types/career';
import { CelebrationModal } from './CelebrationModal';

// MGC-487 — Bracket UI de playoffs nacionales (semanas 35–38).
// Renderiza el bracket por ronda y permite avanzar la ronda
// (cuartos → semis → final) usando el helper puro `advancePlayoffRound`.
// MGC-487.2 — usa `createRng` del módulo central (mismo Mulberry32 que
// el motor de partidos) para que `resolvePlayoffMatch` pueda consumir
// `chance()` además de `int()`.

const ROUND_LABEL: Record<PlayoffRound, string> = {
  quarter: 'Cuartos',
  semi: 'Semifinales',
  final: 'Final',
};

const ROUND_ORDER: PlayoffRound[] = ['quarter', 'semi', 'final'];

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
    buildPlayoffBracket(seeded, createRng(seed)),
  );

  const champion = bracketChampion(bracket);

  // MGC-601 / MGC-487.4 — Modal de celebración del campeón.
  // Auto-aparece cuando el bracket pasa de `champion === null` a un
  // campeón resuelto (al tap "Avanzar ronda" sobre la final). El
  // caller (playoff.tsx) controla el dismiss: backdrop, "Cerrar" o
  // "Nueva temporada" — todos preservan el estado para que QA pueda
  // reabrir el modal tras dismiss sin re-jugar el bracket.
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationDismissed, setCelebrationDismissed] = useState(false);

  useEffect(() => {
    if (champion && !celebrationDismissed) {
      // Diferimos el setState al próximo tick para evitar
      // `react-hooks/set-state-in-effect` (cascading renders).
      // El cleanup cancela el timer si champion cambia antes de que
      // dispare, evitando re-aperturas cuando el usuario dismissa.
      const id = setTimeout(() => setShowCelebration(true), 0);
      return () => clearTimeout(id);
    }
  }, [champion, celebrationDismissed]);

  const onAdvanceRound = useCallback(() => {
    setBracket((current) => advancePlayoffRound(current, createRng(seed + current.length)));
  }, [seed]);

  const onCloseSeason = useCallback(() => {
    console.log('[iter6 MGC-629] onCloseSeason called → router.replace');
    router.replace('/simulador-carrera/season-summary');
  }, [router]);

  // MGC-601 — handlers del modal.
  const onCelebrationClose = useCallback(() => {
    setShowCelebration(false);
    setCelebrationDismissed(true);
  }, []);

  // MGC-629 iter6 — handler "Nueva temporada".
  //
  // iter5 (081251e) confirmó por QA walks MGC-641/MGC-642 que llamar
  // `router.replace()` sincrónicamente dentro del handler (junto con
  // `setShow(false)` y `setCelebrationDismissed(true)`) sigue sin
  // navegar: el modal cierra OK pero `season-summary` no aparece.
  //
  // iter6 invierte el contrato: la navegación pasa a ser declarativa
  // vía `useEffect`. El handler sólo flippa state JS y levanta una
  // flag `newSeasonRequested`. La navegación se ejecuta cuando el
  // useEffect detecta que (a) el overlay ya está desmontado
  // (`!showCelebration`), (b) el bracket está dismissed, y (c) hay un
  // request pendiente. Así garantizamos que `router.replace` corre
  // DESPUÉS del commit de React que desmonta el overlay — sin race
  // con la transición de expo-router.
  //
  // console.log instrumentation permite a QA confirmar:
  //   - "handler fired" → el Pressable del Button ejecutó onPress.
  //   - "useEffect: navigation requested, overlay unmounted" →
  //     navigation corre tras el commit.
  //   - "onCloseSeason called → router.replace" → router.replace
  //     ejecutó la transición.
  const [newSeasonRequested, setNewSeasonRequested] = useState(false);
  const newSeasonRequestedRef = useRef(false);

  const onCelebrationNewSeason = useCallback(() => {
    console.log('[iter6 MGC-629] onCelebrationNewSeason handler fired');
    setShowCelebration(false);
    setCelebrationDismissed(true);
    setNewSeasonRequested(true);
    newSeasonRequestedRef.current = true;
  }, []);

  useEffect(() => {
    if (
      newSeasonRequested &&
      !showCelebration &&
      celebrationDismissed
    ) {
      console.log('[iter6 MGC-629] useEffect: navigation requested, overlay unmounted → calling onCloseSeason');
      // Navegación sigue siendo síncrona (no es setState) — es la
      // pieza que MGC-629 iter6 validó por QA walks MGC-641/642.
      // Reset de flags se difiere al próximo tick para no caer en
      // `react-hooks/set-state-in-effect` (cascading renders). El
      // cleanup cancela el timer si las deps cambian antes de que
      // dispare.
      const resetId = setTimeout(() => {
        setNewSeasonRequested(false);
        newSeasonRequestedRef.current = false;
      }, 0);
      onCloseSeason();
      return () => clearTimeout(resetId);
    }
  }, [
    newSeasonRequested,
    showCelebration,
    celebrationDismissed,
    onCloseSeason,
  ]);

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

      {/* MGC-601 / MGC-487.4 — Modal celebración del campeón. */}
      <CelebrationModal
        visible={showCelebration}
        champion={champion}
        season={profile?.season ?? 1}
        onClose={onCelebrationClose}
        onNewSeason={onCelebrationNewSeason}
      />
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
