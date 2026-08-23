import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '@/features/ui';
import { colors, radii, spacing } from '@/features/ui/theme';
import { useGameStore } from '@/shared/store/gameStore';

export default function Home() {
  const router = useRouter();
  const bestStreak = useGameStore((s) => s.bestStreak);
  // Antes mostrábamos `score` como "Mejor puntaje", pero `score` es la ronda
  // actual y vuelve a 0 al iniciar una nueva partida. Eso era engañoso.
  // Mostramos `highScore`, que persiste entre sesiones.
  const highScore = useGameStore((s) => s.highScore);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} testID="home-screen">
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>COPERO</Text>
          <Text style={styles.title}>Juego de palabras</Text>
          <Text style={styles.subtitle}>
            Adiviná la palabra antes de que se acabe el tiempo. Sumá puntos, hacé
            racha y competí con tu mejor marca.
          </Text>
        </View>

        {(highScore > 0 || bestStreak > 0) && (
          <Card style={styles.statsCard}>
            <Text style={styles.statsTitle}>Tus marcas</Text>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{highScore}</Text>
                <Text style={styles.statLabel}>Mejor puntaje</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>🔥 {bestStreak}</Text>
                <Text style={styles.statLabel}>Mejor racha</Text>
              </View>
            </View>
          </Card>
        )}

        <View style={styles.cta}>
          <Link href="/categoria" asChild>
            <Pressable
              accessibilityRole="button"
              testID="btn-play"
              style={({ pressed }) => [styles.playCta, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/categoria')}
            >
              <Text style={styles.playCtaLabel}>Jugar</Text>
            </Pressable>
          </Link>
        </View>

        <Card>
          <Text style={styles.howTitle}>Cómo se juega</Text>
          <Text style={styles.howText}>
            1. Elegí una categoría.{'\n'}
            2. Cada ronda tiene 30 segundos para hacer adivinar la palabra.{'\n'}
            3. Tu compañero debe acertar: sí vale puntos, no consume el tiempo.{'\n'}
            4. 10 rondas. Puntaje final y mejor racha quedan guardados.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  hero: {
    paddingTop: spacing.xl,
  },
  eyebrow: {
    color: colors.primary,
    letterSpacing: 4,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.textDim,
    fontSize: 16,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  statsCard: {},
  statsTitle: {
    color: colors.muted,
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  stat: { flex: 1 },
  statValue: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.muted,
    fontSize: 12,
  },
  cta: {
    marginVertical: spacing.md,
  },
  playCta: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCtaLabel: {
    color: colors.primaryFg,
    fontSize: 18,
    fontWeight: '800',
  },
  howTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  howText: {
    color: colors.textDim,
    lineHeight: 22,
  },
});
