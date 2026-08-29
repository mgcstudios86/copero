import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { useCareerStore } from '@/shared/store/careerStore';
import { RETIREMENT_AGE } from '@/features/career/season';
import { NATIONALITIES_BY_CODE } from '@/features/career/nationalities';

/**
 * MGC-209 [5/6] — TEMPORADA.
 *
 * Replica `copero-web/web/src/screens/Temporada.tsx`: bloque izquierdo
 * con edad, club, OVR, valor, stats y selección; timeline derecha con
 * todas las temporadas registradas. Las filas se derivan de
 * `state.log.timeline` (motor) más un placeholder hasta RETIREMENT_AGE
 * para que la grilla siempre tenga la misma densidad visual.
 */
export default function TemporadaScreen() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();

  const profile = useCareerStore((s) => s.profile);
  const log = useCareerStore((s) => s.log);
  const stage = useCareerStore((s) => s.stage);
  const advanceSeason = useCareerStore((s) => s.advanceSeason);
  const runCareerToRetirement = useCareerStore((s) => s.runCareerToRetirement);

  const nat = NATIONALITIES_BY_CODE[profile.nationalityCode];

  // Construye filas de timeline: las del log + placeholders hasta retiro.
  const startAge = profile.age - (log?.timeline.length ?? 0);
  const endAge = RETIREMENT_AGE;
  const ages: number[] = [];
  for (let a = startAge; a <= endAge; a++) ages.push(a);

  const rowFor = (age: number) => log?.timeline.find((r) => r.age === age);

  const onAdvance = () => {
    advanceSeason();
  };

  const onRunAll = () => {
    runCareerToRetirement();
  };

  const onRetire = () => {
    if (stage === 'retirement') {
      router.replace('/simulador-carrera/fin-carrera');
    }
  };

  useEffect(() => {
    if (stage === 'retirement') {
      router.replace('/simulador-carrera/fin-carrera');
    }
  }, [stage, router]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.container, { gap: spacing[5], padding: spacing[4] }]}
        testID="temporada-screen"
      >
        {/* Hero block */}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text
              style={{
                color: colors.textStrong,
                fontSize: fontSize['3xl'],
                fontWeight: fontWeight.bold,
              }}
              accessibilityLabel={`Overall rating ${profile.ovr}`}
            >
              {profile.ovr}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], justifyContent: 'flex-end' }}>
              <Pill label={nat ? `${nat.flag} ${nat.code}` : '—'} bg={colors.surface2} fg={colors.textMuted} />
              <Pill label={`#${profile.number} ${profile.position}`} bg={colors.primary} fg={colors.textOnPrimary} />
              <Pill
                label={profile.club?.name ?? 'Free agent'}
                bg={colors.surface2}
                fg={colors.textMuted}
              />
            </View>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
            {nat ? nat.name : 'Nacionalidad'} · Escenario regional
          </Text>

          <View style={{ flexDirection: 'row', gap: spacing[3] }}>
            <Tile label="EDAD" value={`${profile.age}`} />
            <Tile label="VALOR" value={`${profile.value} M US$`} valueColor={colors.primary} />
          </View>

          <View style={{ flexDirection: 'row', gap: spacing[3], alignItems: 'center' }}>
            <Stat icon="🧮" value={profile.stats.apps} label="P" />
            <Stat icon="⚽" value={profile.stats.goals} label="G" />
            <Stat icon="📈" value={profile.stats.ast} label="A" />
          </View>

          {/* Selección */}
          <View
            style={{
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface2,
              padding: spacing[3],
              gap: spacing[1],
            }}
          >
            <Text style={{ color: colors.textStrong, fontSize: fontSize.xs, fontWeight: fontWeight.bold }}>
              SELECCIÓN · {nat?.code ?? '—'}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
              {profile.career.reputation.seleccionConvocado
                ? 'Convocado a selección mayor.'
                : 'Sin convocatorias todavía'}
            </Text>
          </View>

          {/* Vitrina placeholder */}
          <View style={{ flexDirection: 'row', gap: spacing[2], alignItems: 'center' }}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>🏆</Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, letterSpacing: 2, fontWeight: fontWeight.bold }}>
              VITRINA VACÍA
            </Text>
          </View>
        </View>

        {/* Estilo del jugador */}
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
            TU ESTILO DE JUGADOR
          </Text>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize.md,
              fontWeight: fontWeight.bold,
            }}
          >
            ELEGÍ HASTA 2 RASGOS
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
            Cambian eventos, ofertas y desarrollo. Seleccioná 1 o 2.
          </Text>
          {(['Magneto mediático', 'Trotamundos'] as const).map((r) => (
            <View
              key={r}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: spacing[2],
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <Text
                style={{
                  color: colors.textStrong,
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.bold,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                }}
              >
                {r.toUpperCase()}
              </Text>
              <Pill label="0 / 2" bg={colors.surface2} fg={colors.textMuted} />
            </View>
          ))}
        </View>

        {/* CTAs */}
        <View style={{ gap: spacing[3] }}>
          <Button
            label="Pasar temporada"
            onPress={onAdvance}
            variant="primary"
            size="lg"
            fullWidth
            testID="btn-temporada-advance"
            disabled={stage === 'retirement'}
          />
          <Button
            label="Correr carrera hasta el retiro"
            onPress={onRunAll}
            variant="secondary"
            size="lg"
            fullWidth
            testID="btn-temporada-run-all"
            disabled={stage === 'retirement'}
          />
          {stage === 'retirement' ? (
            <Button
              label="Ver fin de carrera"
              onPress={onRetire}
              variant="primary"
              size="lg"
              fullWidth
              testID="btn-temporada-retire"
            />
          ) : null}
        </View>

        {/* Timeline */}
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
          <View style={{ flexDirection: 'row', gap: spacing[2], paddingBottom: spacing[2] }}>
            <Text
              style={{
                flex: 1,
                color: colors.textMuted,
                fontSize: 10,
                fontWeight: fontWeight.bold,
                letterSpacing: 2,
              }}
            >
              EDAD
            </Text>
            <Text
              style={{
                flex: 2,
                color: colors.textMuted,
                fontSize: 10,
                fontWeight: fontWeight.bold,
                letterSpacing: 2,
              }}
            >
              CLUB
            </Text>
            <Text
              style={{
                flex: 1,
                textAlign: 'right',
                color: colors.textMuted,
                fontSize: 10,
                fontWeight: fontWeight.bold,
                letterSpacing: 2,
              }}
            >
              OVR
            </Text>
            <Text
              style={{
                flex: 1.5,
                textAlign: 'right',
                color: colors.textMuted,
                fontSize: 10,
                fontWeight: fontWeight.bold,
                letterSpacing: 2,
              }}
            >
              P / G / A
            </Text>
          </View>
          {ages.map((age) => {
            const row = rowFor(age);
            return (
              <View
                key={age}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[2],
                  paddingVertical: spacing[2],
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    width: 32,
                    height: 32,
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.bold,
                    }}
                  >
                    {age}
                  </Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 2,
                    color: row ? colors.textStrong : colors.textMuted,
                    fontSize: fontSize.sm,
                  }}
                >
                  {row?.clubName ?? '—'}
                </Text>
                <Text
                  style={{
                    flex: 1,
                    textAlign: 'right',
                    color: row ? colors.textStrong : colors.textMuted,
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.bold,
                  }}
                >
                  {row ? row.ovr : '—'}
                </Text>
                <Text
                  style={{
                    flex: 1.5,
                    textAlign: 'right',
                    color: row ? colors.textMuted : colors.textMuted,
                    fontSize: fontSize.xs,
                  }}
                >
                  {row ? `${row.apps} / ${row.goals} / ${row.assists}` : '—'}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
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
      <Text style={{ color: fg, fontSize: fontSize.xs, fontWeight: fontWeight.bold }}>{label}</Text>
    </View>
  );
}

function Tile({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface2,
        padding: spacing[3],
        gap: spacing[1],
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
        {label}
      </Text>
      <Text
        style={{
          color: valueColor ?? colors.textStrong,
          fontSize: fontSize.lg,
          fontWeight: fontWeight.bold,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function Stat({ icon, value, label }: { icon: string; value: number; label: string }) {
  const { colors, spacing, fontSize } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
      <Text style={{ fontSize: fontSize.base }}>{icon}</Text>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{value} {label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {},
});
