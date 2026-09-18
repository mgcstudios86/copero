/**
 * src/features/simulador-carrera/screens/modo-copero/seleccion-copa.tsx — MGC-490
 *
 * Screen 1/3 del flow modo-copero: selección de copa nacional con bracket inicial.
 *
 * Spec visual: docs/handoffs/modo-copero.md §Pantalla 1.
 *   - Hero: icono 🏆 + título "Copa nacional · 16 equipos" (placeholder, en real 32)
 *   - Body: bracket 4 columnas (8 partidos de octavos visibles) con tu equipo ★
 *   - Footer: "Iniciar octavos" / "Ver copas internacionales"
 *
 * State: local — el slot manager es módulo-scope (slot.ts). Aquí solo
 * dispatcheamos `startSlot()` y navegamos.
 *
 * Navegación:
 *   - Tap "Iniciar octavos" → startSlot + router.push('/simulador-carrera/modo-copero/calendario')
 *   - Tap "Ver copas internacionales" → placeholder (futuro feature)
 */

import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { startSlot } from '@/features/copero/slot';
import { generateBracket } from '@/features/copero/bracket';
import type { Match } from '@/features/copero/bracket';

const PLAYER_TEAM_ID = 'PLAYER';

// 32 equipos sintéticos para el demo (top seeds + lower seeds).
const TEAMS_32 = [
  'RIV', 'BOC', 'IND', 'RAC', 'SLO', 'EST', 'VEL', 'LAN',
  'TIG', 'HUR', 'GOD', 'NEW', 'UNI', 'DEF', 'CEN', 'ARS',
  'BAN', 'TAL', 'COL', 'BAR', 'ALM', 'PAT', 'SAN', 'DYJ',
  'ATL', 'CAR', 'BEL', 'SAR', 'CHA', 'GIM', 'ALL', 'PLA',
];

export default function SeleccionCopaScreen() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();

  // Generamos un bracket determinista para mostrar antes de confirmar.
  // El seed usa fecha del día → cambia día a día, ok para preview.
  const seed = useMemo(() => `preview-${new Date().toISOString().slice(0, 10)}`, []);
  const bracketPreview = useMemo(() => {
    try {
      return generateBracket(TEAMS_32, seed);
    } catch {
      return null;
    }
  }, [seed]);

  const onStart = useCallback(() => {
    startSlot(TEAMS_32, seed);
    router.push('/simulador-carrera/modo-copero/calendario' as never);
  }, [router, seed]);

  const onSeeInternational = useCallback(() => {
    // Placeholder: feature futura (sudamericana). Mantener CTA visible.
  }, []);

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
        <Text style={[styles.eyebrow, { color: colors.primary }]}>MODO COPERO</Text>
        <Text style={[styles.title, { color: colors.textStrong, fontSize: fontSize['2xl'] }]}>
          🏆 Copa nacional · {TEAMS_32.length} equipos
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted, fontSize: fontSize.sm }]}>
          5 rondas · eliminación directa · tu club sembrado por ranking
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.body,
          { padding: spacing[4], gap: spacing[4] },
        ]}
      >
        <BracketPreview
          matches={bracketPreview?.rounds.round_of_16 ?? []}
          playerId={PLAYER_TEAM_ID}
        />

        <View style={[styles.callout, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
          <Text style={[styles.calloutText, { color: colors.accent, fontSize: fontSize.sm }]}>
            ★ Tu club participa en esta copa. La siembra se decide al cierre de la temporada regular.
          </Text>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            padding: spacing[4],
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            gap: spacing[2],
          },
        ]}
      >
        <Button label="Iniciar octavos" onPress={onStart} variant="primary" fullWidth />
        <Button
          label="Ver copas internacionales"
          onPress={onSeeInternational}
          variant="secondary"
          fullWidth
        />
      </View>
    </SafeAreaView>
  );
}

function BracketPreview({ matches, playerId }: { matches: Match[]; playerId: string }) {
  const { colors, radii, spacing, fontSize } = useTheme();
  // 4 columnas × 2 partidos = 8 partidos de octavos visibles
  const cols = useMemo(() => {
    const out: Match[][] = [[], [], [], []];
    matches.slice(0, 8).forEach((m, i) => out[Math.floor(i / 2)].push(m));
    return out;
  }, [matches]);

  if (matches.length === 0) {
    return (
      <View style={[styles.bracketEmpty, { borderColor: colors.border }]}>
        <Text style={{ color: colors.textMuted }}>Cargando bracket…</Text>
      </View>
    );
  }

  return (
    <View style={styles.bracketGrid}>
      {cols.map((col, ci) => (
        <View key={ci} style={[styles.bracketCol, { gap: spacing[3] }]}>
          {col.map((m) => (
            <MatchCard key={m.id} match={m} playerId={playerId} />
          ))}
        </View>
      ))}
    </View>
  );
}

function MatchCard({ match, playerId }: { match: Match; playerId: string }) {
  const { colors, radii, spacing, fontSize } = useTheme();
  const teamStyle = (tid: string | null) => {
    const isPlayer = tid === playerId;
    return {
      backgroundColor: isPlayer ? colors.primarySoft : colors.surface2,
      color: isPlayer ? colors.primary : colors.text,
      borderColor: isPlayer ? colors.primary : colors.borderStrong,
    };
  };
  return (
    <View
      style={[
        styles.matchCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radii.md,
          padding: spacing[3],
          gap: spacing[2],
        },
      ]}
    >
      <TeamRow label={match.home ?? 'TBD'} style={teamStyle(match.home)} />
      <TeamRow label={match.away ?? 'TBD'} style={teamStyle(match.away)} />
    </View>
  );
}

function TeamRow({
  label,
  style,
}: {
  label: string;
  style: { backgroundColor: string; color: string; borderColor: string };
}) {
  const { radii, spacing, fontSize } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing[2],
        paddingHorizontal: spacing[3],
        borderRadius: radii.sm,
        backgroundColor: style.backgroundColor,
        borderWidth: 1,
        borderColor: style.borderColor,
      }}
    >
      <Text style={{ color: style.color, fontSize: fontSize.sm, fontWeight: '600' }}>
        {label === 'PLAYER' ? '★ Tu club' : label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { borderBottomWidth: 1 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  title: { fontWeight: '700' },
  subtitle: { marginTop: 2 },
  body: {},
  bracketGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  bracketCol: { flex: 1 },
  bracketEmpty: {
    padding: 24,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
  },
  matchCard: {
    borderWidth: 1,
  },
  callout: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  calloutText: { lineHeight: 20 },
  footer: { borderTopWidth: 1 },
});
