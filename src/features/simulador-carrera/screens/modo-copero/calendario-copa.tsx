/**
 * src/features/simulador-carrera/screens/modo-copero/calendario-copa.tsx — MGC-490
 *
 * Screen 2/3 del flow modo-copero: calendario de la fase actual con banner
 * gradient accent + cards de partido (HOY/Pendiente).
 *
 * Spec visual: docs/handoffs/modo-copero.md §Pantalla 2.
 *   - Header: filters chips (Octavos/Cuartos/Semis/Final)
 *   - Body: phase banner (gradient accent) + list de partidos con cards (HOY/Pendiente)
 *
 * State: lee `getSlot()` (módulo). Cada card "Jugar" dispatcha
 * `resolveMatch()` y refresca. Cuando la fase final cierra, navega a
 * `/modo-copero/celebracion`.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import {
  getSlot,
  resolveMatch,
  subscribeSlot,
  type CoperoSlot,
} from '@/features/copero/slot';
import {
  PHASE_LABEL_ES,
  PHASE_ORDER,
  type BracketPhase,
  type Match,
} from '@/features/copero/bracket';

export default function CalendarioCopaScreen() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize } = useTheme();
  const [slot, setSlot] = useState<CoperoSlot | null>(getSlot());

  useEffect(() => subscribeSlot(setSlot), []);

  const phase = slot
    ? PHASE_ORDER[slot.currentPhaseIndex] ?? 'round_of_16'
    : 'round_of_16';

  const phaseLabel = PHASE_LABEL_ES[phase];
  const matches = slot?.bracket.rounds[phase] ?? [];

  const onPlay = useCallback(
    (matchId: string, winner: string) => {
      if (!slot) return;
      resolveMatch(matchId, winner);
      // After mutation, slot.status changes; navigation triggered in another effect.
    },
    [slot],
  );

  useEffect(() => {
    if (slot?.status === 'won') {
      router.replace('/simulador-carrera/modo-copero/celebracion' as never);
    }
  }, [slot?.status, router]);

  const chips = useMemo(() => PHASE_ORDER.map((p) => PHASE_LABEL_ES[p]), []);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.header,
          {
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[3],
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.eyebrow, { color: colors.primary }]}>COPA NACIONAL</Text>
        <Text style={[styles.title, { color: colors.textStrong, fontSize: fontSize['2xl'] }]}>
          Calendario de la copa
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing[2], paddingTop: spacing[2] }}
        >
          {chips.map((label) => {
            const active = label === phaseLabel;
            return (
              <View
                key={label}
                style={{
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[1],
                  borderRadius: 999,
                  backgroundColor: active ? colors.primarySoft : colors.surface2,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    fontWeight: '600',
                    color: active ? colors.primary : colors.text,
                  }}
                >
                  {label}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={[styles.body, { padding: spacing[4], gap: spacing[4] }]}>
        <PhaseBanner phase={phase} phaseLabel={phaseLabel} />

        {matches.length === 0 ? (
          <View
            style={{
              padding: spacing[5],
              alignItems: 'center',
              backgroundColor: colors.surface,
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.textMuted }}>Sin partidos en esta fase.</Text>
          </View>
        ) : (
          matches.map((m, idx) => (
            <MatchCard key={m.id} match={m} isToday={idx === 0} onPlay={onPlay} />
          ))
        )}
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
      >
        <Button
          label="Volver al inicio"
          onPress={() => router.replace('/simulador-carrera/dashboard' as never)}
          variant="secondary"
          fullWidth
        />
      </View>
    </SafeAreaView>
  );
}

function PhaseBanner({ phase, phaseLabel }: { phase: BracketPhase; phaseLabel: string }) {
  const { colors, radii, spacing, fontSize } = useTheme();
  return (
    <View
      style={{
        padding: spacing[4],
        borderRadius: radii.lg,
        // gradient accent-soft → surface (we approximate with solid + accentSoft for RN).
        backgroundColor: colors.accentSoft,
        borderWidth: 1,
        borderColor: colors.accent,
        gap: spacing[1],
      }}
    >
      <Text style={{ color: colors.accent, fontSize: fontSize.xs, fontWeight: '700', letterSpacing: 1 }}>
        FASE ACTUAL · {phase.toUpperCase()}
      </Text>
      <Text style={{ color: colors.textStrong, fontSize: fontSize.lg, fontWeight: '700' }}>
        {phaseLabel}
      </Text>
    </View>
  );
}

function MatchCard({
  match,
  isToday,
  onPlay,
}: {
  match: Match;
  isToday: boolean;
  onPlay: (matchId: string, winner: string) => void;
}) {
  const { colors, radii, spacing, fontSize } = useTheme();
  const resolved = match.winner != null;
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing[4],
        gap: spacing[3],
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            color: isToday ? colors.primary : colors.textMuted,
            fontSize: fontSize.xs,
            fontWeight: '700',
            letterSpacing: 1,
          }}
        >
          {isToday ? 'HOY' : 'PENDIENTE'}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{match.id}</Text>
      </View>

      <View style={{ gap: spacing[2] }}>
        <TeamRow label={match.home ?? 'TBD'} isWinner={match.winner === match.home} />
        <TeamRow label={match.away ?? 'TBD'} isWinner={match.winner === match.away} />
      </View>

      {!resolved && match.home && match.away ? (
        <View style={{ flexDirection: 'row', gap: spacing[2] }}>
          <Pressable
            onPress={() => onPlay(match.id, match.home!)}
            style={{
              flex: 1,
              paddingVertical: spacing[3],
              borderRadius: 999,
              backgroundColor: colors.primary,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: colors.textOnPrimary, fontSize: fontSize.sm, fontWeight: '700' }}>
              Gana {match.home}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onPlay(match.id, match.away!)}
            style={{
              flex: 1,
              paddingVertical: spacing[3],
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: '700' }}>
              Gana {match.away}
            </Text>
          </Pressable>
        </View>
      ) : resolved ? (
        <Text style={{ color: colors.success, fontSize: fontSize.sm, fontWeight: '600' }}>
          ✓ Ganador: {match.winner}
        </Text>
      ) : null}
    </View>
  );
}

function TeamRow({ label, isWinner }: { label: string; isWinner: boolean }) {
  const { colors, radii, spacing, fontSize } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing[2],
        paddingHorizontal: spacing[3],
        borderRadius: radii.sm,
        backgroundColor: isWinner ? colors.primarySoft : colors.surface2,
        borderWidth: 1,
        borderColor: isWinner ? colors.primary : colors.borderStrong,
      }}
    >
      <Text
        style={{
          color: isWinner ? colors.primary : colors.text,
          fontSize: fontSize.base,
          fontWeight: isWinner ? '700' : '500',
        }}
      >
        {label === 'PLAYER' ? '★ Tu club' : label}
      </Text>
      {isWinner ? (
        <Text style={{ color: colors.primary, fontSize: fontSize.xs, fontWeight: '700' }}>W</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { borderBottomWidth: 1 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  title: { fontWeight: '700' },
  body: {},
  footer: { borderTopWidth: 1 },
});
