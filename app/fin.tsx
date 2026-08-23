import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card } from '@/features/ui';
import { colors, spacing } from '@/features/ui/theme';
import { Interstitial } from '@/features/ads';
import { useGameStore } from '@/shared/store/gameStore';
import { useAdsStore } from '@/shared/store/adsStore';

export default function Fin() {
  const router = useRouter();
  const score = useGameStore((s) => s.score);
  const bestStreak = useGameStore((s) => s.bestStreak);
  const rounds = useGameStore((s) => s.rounds);
  const reset = useGameStore((s) => s.reset);
  const requestInterstitial = useAdsStore((s) => s.requestInterstitial);
  const markInterstitialShown = useAdsStore((s) => s.markInterstitialShown);

  const [interstitialOpen, setInterstitialOpen] = useState(false);

  // Disparar intersticial al cargar la pantalla de fin.
  useEffect(() => {
    requestInterstitial();
    setInterstitialOpen(true);
  }, [requestInterstitial]);

  const onCloseAd = () => {
    setInterstitialOpen(false);
    markInterstitialShown();
  };

  const onPlayAgain = () => {
    reset();
    router.replace('/categoria');
  };

  const correctCount = rounds.filter((r) => r.outcome === 'correct').length;
  const skipCount = rounds.filter((r) => r.outcome === 'skip').length;
  const timeoutCount = rounds.filter((r) => r.outcome === 'timeout').length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} testID="fin-screen">
        <Text style={styles.eyebrow}>COPERO TERMINADO</Text>
        <Text style={styles.title}>Tu resultado</Text>

        <Card style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>Puntos finales</Text>
          <Text style={styles.scoreValue} testID="final-score">{score}</Text>
          <Text style={styles.streakLine}>🔥 Mejor racha: {bestStreak}</Text>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Detalle por ronda</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{correctCount}</Text>
              <Text style={styles.statLabel}>Acertó</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.warning }]}>{skipCount}</Text>
              <Text style={styles.statLabel}>Pasó</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.danger }]}>{timeoutCount}</Text>
              <Text style={styles.statLabel}>Timeout</Text>
            </View>
          </View>
        </Card>

        <Button label="Jugar de nuevo" onPress={onPlayAgain} testID="btn-play-again" />
      </ScrollView>

      <Interstitial open={interstitialOpen} onClose={onCloseAd} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  eyebrow: {
    color: colors.primary,
    letterSpacing: 4,
    fontSize: 12,
    fontWeight: '800',
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '900',
  },
  scoreCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  scoreLabel: {
    color: colors.muted,
    letterSpacing: 2,
    fontSize: 12,
  },
  scoreValue: {
    color: colors.text,
    fontSize: 64,
    fontWeight: '900',
    marginVertical: spacing.sm,
  },
  streakLine: {
    color: colors.warning,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: { alignItems: 'center', flex: 1 },
  statValue: {
    fontSize: 32,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.muted,
    fontSize: 12,
  },
});
