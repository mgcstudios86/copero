import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { useCareerStore } from '@/shared/store/careerStore';
import { cardToEntries } from '@/features/career/legends';

/**
 * MGC-209 [3/6] — TU JUGADOR (carta final).
 *
 * Replica `copero-web/web/src/screens/DraftComplete.tsx`: OVR inicial,
 * potencial, los 6 attrs + 2 skills en grilla y la lista de los 8 picks
 * con la leyenda de origen. Estado viene del motor (`state.card`) tras
 * confirmar el pick 8.
 */
export default function TuJugadorScreen() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();

  const profile = useCareerStore((s) => s.profile);
  const card = useCareerStore((s) => s.card);
  const draft = useCareerStore((s) => s.draft);

  if (!card || !draft) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
        <View style={[styles.container, { padding: spacing[5] }]}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>
            Tu carta aún no está lista. Volvé a terminar el draft.
          </Text>
          <View style={{ marginTop: spacing[4] }}>
            <Button
              label="Volver al draft"
              onPress={() => router.replace('/simulador-carrera/draft')}
              variant="primary"
              fullWidth
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const entries = cardToEntries(card);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            gap: spacing[5],
            padding: spacing[4],
            // MGC-1194 (reopen post PR-325/326): el player card tiene 2 filas
            // de 4 tiles (DEF/PHY/SKL/WF). La segunda fila quedaba recortada
            // contra el AdMob banner porque el ScrollView no reservaba espacio
            // inferior. paddingBottom 156dp (60dp banner + 24dp aire) saca la
            // segunda fila arriba del banner — patrón idéntico a club.tsx
            // MGC-832 / temporada.tsx (este mismo PR).
            paddingBottom: spacing[4] + 156,
          },
        ]}
        testID="tu-jugador-screen"
      >
        {/* Header */}
        <View style={{ gap: spacing[2] }}>
          <Text
            style={{
              color: colors.primary,
              letterSpacing: 4,
              fontSize: fontSize.sm,
              fontWeight: fontWeight.bold,
            }}
            accessibilityRole="header"
          >
            DRAFT COMPLETE
          </Text>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize['2xl'],
              fontWeight: fontWeight.bold,
            }}
            accessibilityRole="header"
          >
            TU FUTURO YA
          </Text>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize['2xl'],
              fontWeight: fontWeight.bold,
            }}
            accessibilityRole="header"
          >
            TIENE FORMA
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>
            El potencial se calcula según la posición y los ocho atributos elegidos. Es el techo
            de crecimiento de tu jugador durante la carrera.
          </Text>
        </View>

        {/* OVR / POT stats */}
        <View style={{ flexDirection: 'row', gap: spacing[3] }}>
          <View
            style={{
              flex: 1,
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
                fontSize: fontSize.xs,
                fontWeight: fontWeight.bold,
                letterSpacing: 2,
              }}
            >
              OVR INICIAL
            </Text>
            <Text
              style={{
                color: colors.textStrong,
                fontSize: fontSize['2xl'],
                fontWeight: fontWeight.bold,
              }}
              accessibilityLabel={`OVR inicial ${card.ovrInicial}`}
            >
              {card.ovrInicial}
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: colors.primary,
              backgroundColor: colors.primarySoft,
              padding: spacing[4],
              gap: spacing[2],
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
              POTENCIAL
            </Text>
            <Text
              style={{
                color: colors.primary,
                fontSize: fontSize['2xl'],
                fontWeight: fontWeight.bold,
              }}
              accessibilityLabel={`Potencial ${card.potencial}`}
            >
              {card.potencial}
            </Text>
          </View>
        </View>

        {/* CTA */}
        <Button
          label="Elegir club de origen"
          onPress={() => router.push('/simulador-carrera/club')}
          variant="primary"
          size="lg"
          fullWidth
          testID="btn-tu-jugador-club"
        />

        {/* Player card */}
        <View
          style={{
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: spacing[5],
            gap: spacing[4],
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View
              style={{
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[1],
                borderRadius: radii.pill,
                backgroundColor: colors.primary,
              }}
            >
              <Text style={{ color: colors.textOnPrimary, fontSize: fontSize.xs, fontWeight: fontWeight.bold }}>
                DRAFT COMPLETE
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text
                style={{
                  color: colors.textStrong,
                  fontSize: fontSize.lg,
                  fontWeight: fontWeight.bold,
                  textTransform: 'uppercase',
                }}
              >
                {profile.name || 'ROOKIE'}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
                #{profile.number} · {profile.position}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing[4] }}>
            <Text
              style={{
                color: colors.textStrong,
                fontSize: 48,
                fontWeight: fontWeight.bold,
              }}
            >
              {card.potencial}
            </Text>
            <View>
              <Text
                style={{
                  color: colors.textStrong,
                  fontSize: fontSize.md,
                  fontWeight: fontWeight.bold,
                  textTransform: 'uppercase',
                }}
              >
                {profile.position}
              </Text>
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: 10,
                  fontWeight: fontWeight.bold,
                  letterSpacing: 2,
                }}
              >
                {profile.nationalityCode}
              </Text>
            </View>
          </View>

          {/* 6 attrs + 2 skills grid */}
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}
            accessibilityLabel="Atributos finales"
          >
            {entries.map((e) => (
              <View
                key={e.key}
                style={{
                  flexBasis: '23%',
                  flexGrow: 1,
                  paddingVertical: spacing[3],
                  borderRadius: radii.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface2,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 10,
                    fontWeight: fontWeight.bold,
                    letterSpacing: 1,
                  }}
                >
                  {e.key}
                </Text>
                <Text
                  style={{
                    color: colors.textStrong,
                    fontSize: fontSize.lg,
                    fontWeight: fontWeight.bold,
                  }}
                >
                  {e.value}
                  {(e.key === 'SKL' || e.key === 'WF') ? '★' : ''}
                </Text>
              </View>
            ))}
          </View>

          {/* Picks list */}
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing[3], gap: spacing[2] }}>
            <Text
              style={{
                color: colors.textMuted,
                fontSize: fontSize.xs,
                fontWeight: fontWeight.bold,
                letterSpacing: 2,
              }}
            >
              CONSTRUIDO CON
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
              {draft.picks.map((p) => (
                <View
                  key={`${p.slot}-${p.legendId}`}
                  style={{
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[1],
                    borderRadius: radii.pill,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface2,
                  }}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.bold,
                      letterSpacing: 1,
                    }}
                  >
                    {p.slot} · {p.legendName}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {},
});
