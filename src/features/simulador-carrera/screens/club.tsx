import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { useCareerStore } from '@/shared/store/careerStore';
import { OriginPhase } from '../components/OriginPhase';
import { clubsForPosition } from '@/features/career/clubs';
import { POSITIONS } from '@/features/career/positions';
import type { Club, PositionGroup } from '@/types/career';

/**
 * MGC-209 [4/6] — ELEGÍ TU CLUB.
 *
 * Replica `copero-web/web/src/screens/SeleccionClub.tsx`: tarjetas con
 * escudo (ClubCrest), arquetipo, reputación, minutos, títulos y riesgo.
 * Los clubes vienen del motor (`engine.ts#applyCardToProfile` ya seteó
 * profile.attrs/ovr/potencial); acá solo mostramos opciones con metadata
 * consistente.
 *
 * MGC-249: el catálogo se filtra y ordena por `clubsForPosition(group)`
 * según la posición del jugador. Para ST/LW/RW/CAM sale Boca y Vélez
 * primero; para CB/LB/RB sale Temperley/Morón (DESARROLLO). Siempre hay
 * ≥1 club recomendado visible — el bug "queda Free agent" del
 * build-143 desaparece.
 */

type ClubMeta = {
  minutesLabel: string;
  minutesColor: 'green' | 'amber' | 'rose';
  growthLabel: string;
  titlesLabel: string;
  riskLabel: string;
};

const CLUB_META: Record<string, ClubMeta> = {
  velez: { minutesLabel: 'Alta', minutesColor: 'green', growthLabel: 'Medio', titlesLabel: 'Alta', riskLabel: 'Medio' },
  temperley: { minutesLabel: 'Muy alta', minutesColor: 'green', growthLabel: 'Alto', titlesLabel: 'Baja', riskLabel: 'Bajo' },
  moron: { minutesLabel: 'Muy alta', minutesColor: 'green', growthLabel: 'Muy alto', titlesLabel: 'Baja', riskLabel: 'Bajo' },
  boca: { minutesLabel: 'Baja', minutesColor: 'rose', growthLabel: 'Medio', titlesLabel: 'Muy alta', riskLabel: 'Alto' },
};

const ARCHETYPE_LABEL: Record<'DESARROLLO' | 'EQUILIBRIO' | 'AMBICIÓN', string> = {
  DESARROLLO: 'DESARROLLO',
  EQUILIBRIO: 'EQUILIBRIO',
  'AMBICIÓN': 'AMBICIÓN',
};

function positionGroupFor(position: string): PositionGroup {
  return POSITIONS.find((p) => p.id === position)?.group ?? 'midfield';
}


export default function SeleccionClubScreen() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();

  const card = useCareerStore((s) => s.card);
  const profile = useCareerStore((s) => s.profile);
  const pickClub = useCareerStore((s) => s.pickClub);

  // MGC-249: ordenamos los clubes por afinidad con la posición del jugador.
  // Memo para evitar re-sort en cada render.
  const clubOptions = useMemo(
    () => clubsForPosition(positionGroupFor(profile.position)),
    [profile.position],
  );

  const onPick = async (club: Club) => {
    // MGC-284: await del flush antes de navegar. `pickClub` ahora es
    // async + await flushPendingSave() — sin el await, la navegación
    // puede dispararse antes de que AsyncStorage confirme el stage
    // 'season' + profile con club asignado, y un force-stop del
    // usuario pierde el snapshot (AC4 — 8 rounds + force-stop).
    await pickClub(club);
    router.replace('/simulador-carrera/temporada');
  };

  const minutesColor = (c: 'green' | 'amber' | 'rose') =>
    c === 'green' ? colors.primary : c === 'amber' ? '#FBBF24' : '#E96A56';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.container, { gap: spacing[5], padding: spacing[4] }]}
        testID="club-screen"
      >
        {/* Header — copy i18n con count dinámico (MGC-232) */}
        <OriginPhase count={clubOptions.length} />

        {/* Profile summary */}
        <View
          style={{
            borderRadius: radii.md,
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
              fontSize: fontSize.xs,
              fontWeight: fontWeight.bold,
              letterSpacing: 2,
            }}
          >
            TU PERFIL
          </Text>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize.lg,
              fontWeight: fontWeight.bold,
            }}
          >
            OVR {card?.ovrInicial ?? '—'} · POT {card?.potencial ?? '—'}
          </Text>
        </View>

        {/* Clubs */}
        <View style={{ gap: spacing[4] }}>
          {clubOptions.map((club) => {
            const archetypeBg =
              club.archetype === 'AMBICIÓN'
                ? '#FBBF24'
                : club.archetype === 'EQUILIBRIO'
                  ? colors.surface2
                  : colors.primary;
            const archetypeFg =
              club.archetype === 'AMBICIÓN' ? '#0A120E' : club.archetype === 'EQUILIBRIO' ? colors.text : colors.textOnPrimary;
            const meta = CLUB_META[club.id] ?? {
              minutesLabel: 'Media',
              minutesColor: 'amber' as const,
              growthLabel: 'Medio',
              titlesLabel: 'Media',
              riskLabel: 'Medio',
            };
            const isFit = club.positionGroups.includes(positionGroupFor(profile.position));

            return (
              <View
                key={club.id}
                style={{
                  borderRadius: radii.lg,
                  borderWidth: 1,
                  borderColor: isFit ? colors.primary : colors.border,
                  backgroundColor: colors.surface,
                  padding: spacing[4],
                  gap: spacing[3],
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
                  {/* Monogram crest (cross-platform sin SVG). */}
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: club.crestColor,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    accessibilityLabel={`Escudo de ${club.name}`}
                  >
                    <Text
                      style={{
                        color: '#fff',
                        fontSize: fontSize.sm,
                        fontWeight: fontWeight.bold,
                      }}
                    >
                      {club.name.slice(0, 1)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
                    <View
                      style={{
                        paddingHorizontal: spacing[3],
                        paddingVertical: spacing[1],
                        borderRadius: radii.pill,
                        backgroundColor: archetypeBg,
                      }}
                    >
                      <Text
                        style={{
                          color: archetypeFg,
                          fontSize: fontSize.xs,
                          fontWeight: fontWeight.bold,
                        }}
                      >
                        {ARCHETYPE_LABEL[club.archetype ?? 'EQUILIBRIO']}
                      </Text>
                    </View>
                    <View
                      style={{
                        paddingHorizontal: spacing[3],
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
                      >
                        REPUTACIÓN {club.reputation}/5
                      </Text>
                    </View>
                  </View>
                </View>

                <Text
                  style={{
                    color: colors.textStrong,
                    fontSize: fontSize.md,
                    fontWeight: fontWeight.bold,
                    textTransform: 'uppercase',
                  }}
                >
                  {club.name}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
                  {club.league} · Rol probable: Titular
                </Text>

                {/* Metrics */}
                <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                  <Metric label="MINUTOS" value={meta.minutesLabel} valueColor={minutesColor(meta.minutesColor)} />
                  <Metric label="CRECIMIENTO" value={meta.growthLabel} valueColor={colors.primary} />
                  <Metric label="TÍTULOS" value={meta.titlesLabel} valueColor="#FBBF24" />
                  <Metric label="RIESGO" value={meta.riskLabel} valueColor={colors.textStrong} />
                </View>

                <Button
                  label={`Firmar con ${club.name}`}
                  onPress={() => onPick(club)}
                  variant="primary"
                  fullWidth
                  testID={`club-pick-${club.id}`}
                  accessibilityLabel={`Firmar con ${club.name}`}
                />
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor: string;
}) {
  const { colors, spacing, fontSize, fontWeight } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: spacing[1] }}>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 9,
          fontWeight: fontWeight.bold,
          letterSpacing: 1,
        }}
      >
        {label}
      </Text>
      <Text style={{ color: valueColor, fontSize: fontSize.sm, fontWeight: fontWeight.bold }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {},
});
