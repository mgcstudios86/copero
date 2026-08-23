import React from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { copy } from '@/design/copy/es-AR/simulador-carrera';
import { useCareerStore } from '@/shared/store/careerStore';
import { ACADEMY_CLUBS } from '@/features/career/clubs';
import { POSITION_LABEL } from '@/features/career/positions';
import type { Club } from '@/types/career';

/** Mapea presupuesto del club al copyId de la card tier (copy-matrix.md §3). */
function tierCopyId(club: Club): string {
  if (club.presupuesto >= 5) return 'academy_card_top';
  if (club.presupuesto >= 2) return 'academy_card_medium';
  return 'academy_card_low';
}

export default function AcademyScreen() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight, fontFamily, lineHeight } = useTheme();

  const profile = useCareerStore((s) => s.profile);
  const acceptClub = useCareerStore((s) => s.acceptClub);

  const onPickClub = (club: Club) => {
    acceptClub(club);
    Alert.alert(
      copy.resolve('academy_cta', { club: club.name }),
      copy.resolve('academy_sub'),
      [
        {
          text: copy.resolve('identity_cta'),
          onPress: () => router.replace('/simulador-carrera/dashboard'),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.container, { gap: spacing[5], padding: spacing[4] }]}
        testID="academy-screen"
      >
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
            {copy.resolve('academy_step')}
          </Text>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize['2xl'],
              fontFamily: fontFamily.display,
              fontWeight: fontWeight.bold,
              lineHeight: fontSize['2xl'] * lineHeight.tight,
            }}
            accessibilityRole="header"
          >
            {copy.resolve('academy_h1')}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>
            {copy.resolve('academy_sub')}
          </Text>
        </View>

        <View style={{ gap: spacing[4] }}>
          {ACADEMY_CLUBS.map((club) => (
            <Pressable
              key={club.id}
              onPress={() => onPickClub(club)}
              accessibilityRole="button"
              accessibilityLabel={`Fichar por ${club.name} en ${club.league}`}
              testID={`club-${club.id}`}
              style={{
                borderRadius: radii.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                padding: spacing[4],
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[4],
              }}
            >
              {/* Escudo placeholder: dos círculos concéntricos con colores del club */}
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  borderWidth: 2,
                  borderColor: club.crestAccent,
                  backgroundColor: club.crestColor,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    borderWidth: 2,
                    borderColor: club.crestAccent,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: club.crestAccent,
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.bold,
                    }}
                  >
                    {club.name.slice(0, 3).toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={{ flex: 1, gap: spacing[1] }}>
                <Text
                  style={{
                    color: colors.textStrong,
                    fontSize: fontSize.md,
                    fontWeight: fontWeight.bold,
                  }}
                >
                  {club.name}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
                  {club.league}
                </Text>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xl }}>›</Text>
            </Pressable>
          ))}
        </View>

        <Button
          label="Volver al dashboard"
          onPress={() => router.replace('/simulador-carrera/dashboard')}
          variant="ghost"
          size="md"
          fullWidth
          accessibilityHint="Cancela la oferta del academy y vuelve"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {},
});