import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { useCareerStore } from '@/shared/store/careerStore';
import { OriginPhase } from '../components/OriginPhase';
import type { Club } from '@/types/career';

/**
 * MGC-209 [4/6] — ELEGÍ TU CLUB.
 *
 * Replica `copero-web/web/src/screens/SeleccionClub.tsx`: tarjetas con
 * escudo (ClubCrest), arquetipo, reputación, minutos, títulos y riesgo.
 * Los clubes vienen del motor (`engine.ts#applyCardToProfile` ya seteó
 * profile.attrs/ovr/potencial); acá solo mostramos opciones con metadata
 * consistente.
 *
 * Catálogo: usamos el mismo set de clubs del motor (MGC-430) pero con
 * los metadatos de arquetipo/reputation extendidos en línea para que la
 * tarjeta refleje lo que el jugador va a recibir.
 */
const CLUB_OPTIONS: (Club & {
  archetype: 'DESARROLLO' | 'EQUILIBRIO' | 'AMBICIÓN';
  reputation: number;
  minutesLabel: string;
  minutesColor: 'green' | 'amber' | 'rose';
  growthLabel: string;
  titlesLabel: string;
  riskLabel: string;
})[] = [
  {
    id: 'velez',
    name: 'Vélez Sarsfield',
    league: 'Liga Profesional',
    crestColor: '#1F2A24',
    crestAccent: '#FFFFFF',
    presupuesto: 8,
    archetype: 'EQUILIBRIO',
    reputation: 4,
    minutesLabel: 'Alta',
    minutesColor: 'green',
    growthLabel: 'Medio',
    titlesLabel: 'Alta',
    riskLabel: 'Medio',
  },
  {
    id: 'temperley',
    name: 'Temperley',
    league: 'Primera Nacional',
    crestColor: '#5B0A0A',
    crestAccent: '#F0EAE0',
    presupuesto: 3,
    archetype: 'DESARROLLO',
    reputation: 2,
    minutesLabel: 'Muy alta',
    minutesColor: 'green',
    growthLabel: 'Alto',
    titlesLabel: 'Baja',
    riskLabel: 'Bajo',
  },
  {
    id: 'moron',
    name: 'Morón',
    league: 'Primera Nacional',
    crestColor: '#0E1411',
    crestAccent: '#FFFFFF',
    presupuesto: 1,
    archetype: 'DESARROLLO',
    reputation: 1,
    minutesLabel: 'Muy alta',
    minutesColor: 'green',
    growthLabel: 'Muy alto',
    titlesLabel: 'Baja',
    riskLabel: 'Bajo',
  },
  {
    id: 'boca',
    name: 'Boca Juniors',
    league: 'Liga Profesional',
    crestColor: '#0A2A6B',
    crestAccent: '#FBBF24',
    presupuesto: 25,
    archetype: 'AMBICIÓN',
    reputation: 5,
    minutesLabel: 'Baja',
    minutesColor: 'rose',
    growthLabel: 'Medio',
    titlesLabel: 'Muy alta',
    riskLabel: 'Alto',
  },
];

const ARCHETYPE_LABEL: Record<'DESARROLLO' | 'EQUILIBRIO' | 'AMBICIÓN', string> = {
  DESARROLLO: 'DESARROLLO',
  EQUILIBRIO: 'EQUILIBRIO',
  'AMBICIÓN': 'AMBICIÓN',
};

export default function SeleccionClubScreen() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();

  const card = useCareerStore((s) => s.card);
  const pickClub = useCareerStore((s) => s.pickClub);

  const onPick = (club: Club) => {
    pickClub(club);
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
        <OriginPhase count={CLUB_OPTIONS.length} />

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
          {CLUB_OPTIONS.map((club) => {
            const archetypeBg =
              club.archetype === 'AMBICIÓN'
                ? '#FBBF24'
                : club.archetype === 'EQUILIBRIO'
                  ? colors.surface2
                  : colors.primary;
            const archetypeFg =
              club.archetype === 'AMBICIÓN' ? '#0A120E' : club.archetype === 'EQUILIBRIO' ? colors.text : colors.textOnPrimary;

            return (
              <View
                key={club.id}
                style={{
                  borderRadius: radii.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
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
                        {ARCHETYPE_LABEL[club.archetype]}
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
                  <Metric label="MINUTOS" value={club.minutesLabel} valueColor={minutesColor(club.minutesColor)} />
                  <Metric label="CRECIMIENTO" value={club.growthLabel} valueColor={colors.primary} />
                  <Metric label="TÍTULOS" value={club.titlesLabel} valueColor="#FBBF24" />
                  <Metric label="RIESGO" value={club.riskLabel} valueColor={colors.textStrong} />
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
