import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button, ScoreBoard } from '@/design/components';
import { useGameStore } from '@/shared/store/gameStore';
import { useCareerStore } from '@/shared/store/careerStore';

export default function Home() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight, fontFamily, lineHeight } = useTheme();
  const bestStreak = useGameStore((s) => s.bestStreak);
  // Antes mostrábamos `score` como "Mejor puntaje", pero `score` es la ronda
  // actual y vuelve a 0 al iniciar una nueva partida. Eso era engañoso.
  // Mostramos `highScore`, que persiste entre sesiones. (MGC-317)
  const highScore = useGameStore((s) => s.highScore);
  const careerStage = useCareerStore((s) => s.stage);
  const careerProfileName = useCareerStore((s) => s.profile.name);

  const hasStats = highScore > 0 || bestStreak > 0;
  const hasCareer = careerStage !== 'identity' && careerProfileName.length > 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.container, { gap: spacing[4] }]}
        testID="home-screen"
      >
        <View style={{ paddingTop: spacing[5], gap: spacing[2] }}>
          <Text
            style={{
              color: colors.primary,
              letterSpacing: 4,
              fontSize: fontSize.sm,
              fontWeight: fontWeight.bold,
            }}
            accessibilityRole="header"
          >
            COPERO
          </Text>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize['3xl'],
              fontFamily: fontFamily.display,
              fontWeight: fontWeight.bold,
              lineHeight: fontSize['3xl'] * lineHeight.tight,
            }}
            accessibilityRole="header"
          >
            Juego de palabras
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: fontSize.base,
              lineHeight: fontSize.base * lineHeight.base,
            }}
          >
            Adiviná la palabra antes de que se acabe el tiempo. Sumá puntos, hacé
            racha y competí con tu mejor marca.
          </Text>
        </View>

        {hasStats ? (
          <ScoreBoard score={highScore} bestStreak={bestStreak} />
        ) : null}

        <View style={{ gap: spacing[3] }}>
          <Button
            label="Jugar (palabras)"
            onPress={() => router.push('/categoria')}
            variant="primary"
            size="lg"
            fullWidth
            testID="btn-play"
          />
          <Button
            label="Ideología Futbolística"
            onPress={() => router.push('/compass')}
            variant="secondary"
            size="lg"
            fullWidth
            testID="btn-compass"
            accessibilityHint="Abre el modo trivia de decisiones rápidas"
          />
          <Button
            label={hasCareer ? 'Continuar carrera' : 'Simulador de carrera'}
            onPress={() =>
              router.push(
                careerStage === 'identity'
                  ? '/simulador-carrera/identity'
                  : '/simulador-carrera/dashboard',
              )
            }
            variant="secondary"
            size="lg"
            fullWidth
            testID="btn-career"
            accessibilityHint="Abre el simulador de carrera"
          />
        </View>

        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radii.lg,
            padding: spacing[4],
            borderWidth: 1,
            borderColor: colors.border,
            gap: spacing[2],
          }}
        >
          <Text
            style={{
              color: colors.text,
              fontSize: fontSize.base,
              fontWeight: fontWeight.semibold,
            }}
          >
            Cómo se juega
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: fontSize.sm,
              lineHeight: fontSize.sm * lineHeight.base,
            }}
          >
            1. Elegí una categoría.{'\n'}
            2. Cada ronda tiene 30 segundos para hacer adivinar la palabra.{'\n'}
            3. Tu compañero debe acertar: sí vale puntos, no consume el tiempo.{'\n'}
            4. 10 rondas. Puntaje final y mejor racha quedan guardados.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: 16 },
});
