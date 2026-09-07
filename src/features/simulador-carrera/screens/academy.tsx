import React from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button, ClubCrest } from '@/design/components';
import { copy } from '@/design/copy/es-AR/simulador-carrera';
import { useCareerStore } from '@/shared/store/careerStore';
import { ACADEMY_CLUBS } from '@/features/career/clubs';
import type { Club } from '@/types/career';

export default function AcademyScreen() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight, fontFamily, lineHeight } = useTheme();

  const acceptClub = useCareerStore((s) => s.acceptClub);

  const onPickClub = async (club: Club) => {
    // MGC-421 AC7 — C1 atomic save gate: acceptClub ahora retorna
    // `Promise<void>` y resuelve solo cuando AsyncStorage confirmó la
    // escritura del snapshot con el club aplicado. Await bloquea la
    // navegación hasta que `setItem` haya escrito a disco — antes
    // fire-and-forget podía perder el snapshot si el usuario force-
    // stopeaba entre el tap y el `router.replace('/dashboard')`.
    await acceptClub(club);
    const title = copy.resolve('academy_cta', { club: club.name });
    const body = copy.resolve('academy_sub');
    const acceptLabel = copy.resolve('academy_accept_cta');
    const goToDashboard = () => router.replace('/simulador-carrera/dashboard');

    // RN Web: Alert.alert no monta <dialog>/role="alertdialog" en el DOM
    // (verificado por QA MGC-452 → MGC-473). En web usamos window.confirm,
    // que dispara un dialog nativo que Playwright captura con page.on('dialog').
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        if (window.confirm(`${title}\n\n${body}`)) {
          goToDashboard();
        }
      }
      return;
    }

    Alert.alert(title, body, [
      {
        text: acceptLabel,
        onPress: goToDashboard,
      },
    ]);
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
              {/* ClubCrest: escudo genérico con colores del club (MGC-466).
                  Reemplaza placeholder de círculos. Mantiene tamaño 72px. */}
              <ClubCrest club={club} size={72} />
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
                {/* MGC-1802 P2-4 — eslogan distinto por club. El walk
                    MGC-1739 catalogó "Diálogo 'Fichar por academia' usa
                    copy idéntico para todos los clubes". Ahora cada club
                    expone `description` con propuesta de valor acorde
                    a su arquetipo (DESARROLLO/EQUILIBRIO/AMBICIÓN). */}
                {club.description ? (
                  <Text
                    style={{ color: colors.textMuted, fontSize: fontSize.xs, fontStyle: 'italic' }}
                    numberOfLines={2}
                  >
                    {club.description}
                  </Text>
                ) : null}
              </View>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xl }}>›</Text>
            </Pressable>
          ))}
        </View>

        <Button
          label={copy.resolve('academy_back_cta')}
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