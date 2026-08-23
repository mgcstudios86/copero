import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Timer, ScoreBadge } from '@/features/ui';
import { colors, spacing } from '@/features/ui/theme';
import { useGameStore } from '@/shared/store/gameStore';

export default function Ronda() {
  const router = useRouter();
  const status = useGameStore((s) => s.status);
  const round = useGameStore((s) => s.round);
  const totalRounds = useGameStore((s) => s.totalRounds);
  const score = useGameStore((s) => s.score);
  const streak = useGameStore((s) => s.streak);
  const word = useGameStore((s) => s.currentWord);
  const remaining = useGameStore((s) => s.timerMsRemaining);
  const resolve = useGameStore((s) => s.resolveRound);
  const next = useGameStore((s) => s.nextRound);

  // Cuando entramos a /fin disparamos intersticial (lo gestiona adsStore allí).
  useEffect(() => {
    if (status === 'gameEnd') {
      router.replace('/fin');
    }
  }, [status, router]);

  const handleCorrect = () => {
    resolve('correct', remaining);
    advance();
  };

  const handleSkip = () => {
    resolve('skip', remaining);
    advance();
  };

  const handleTimeout = () => {
    resolve('timeout', 0);
    advance();
  };

  const advance = () => {
    // Pequeño delay para que el usuario vea la palabra antes de cambiar
    setTimeout(() => next(), 350);
  };

  if (!word) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Cargando palabra…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container} testID="ronda-screen">
        <ScoreBadge score={score} streak={streak} round={round} totalRounds={totalRounds} />

        <Timer onTimeout={handleTimeout} testID="round-timer" />

        <Card style={styles.wordCard}>
          <Text style={styles.wordEyebrow}>ADIVINÁ</Text>
          <Text style={styles.word} testID="current-word">{word.text.toUpperCase()}</Text>
          {word.hint && <Text style={styles.hint}>Pista: {word.hint}</Text>}
        </Card>

        <View style={styles.actions}>
          <Button label="¡Acertó!" onPress={handleCorrect} testID="btn-correct" />
          <Button label="Pasar" onPress={handleSkip} variant="secondary" testID="btn-skip" />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 16,
  },
  wordCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  wordEyebrow: {
    color: colors.muted,
    letterSpacing: 4,
    fontSize: 12,
  },
  word: {
    color: colors.text,
    fontSize: 48,
    fontWeight: '900',
    textAlign: 'center',
  },
  hint: {
    color: colors.textDim,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  actions: {
    gap: spacing.sm,
  },
});
