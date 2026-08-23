import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button, RoundTimer, ScoreBoard, WordCard } from '@/design/components';
import { useGameStore } from '@/shared/store/gameStore';
import { DEFAULT_ROUND_DURATION_MS } from '@/features/game/engine';

export default function Ronda() {
  const router = useRouter();
  const { colors, spacing, fontSize, fontWeight } = useTheme();
  const status = useGameStore((s) => s.status);
  const round = useGameStore((s) => s.round);
  const totalRounds = useGameStore((s) => s.totalRounds);
  const score = useGameStore((s) => s.score);
  const streak = useGameStore((s) => s.streak);
  const word = useGameStore((s) => s.currentWord);
  const remaining = useGameStore((s) => s.timerMsRemaining);
  const resolve = useGameStore((s) => s.resolveRound);
  const next = useGameStore((s) => s.nextRound);

  // useRef para el id del setTimeout; cleanup evita navegar tras unmount
  // (ej: usuario back-press durante la ventana de 350ms).
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current !== null) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
    };
  }, []);

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
    if (advanceTimerRef.current !== null) {
      // ya hay un advance en curso; no duplicar
      return;
    }
    resolve('timeout', 0);
    advance();
  };

  const advance = () => {
    if (advanceTimerRef.current !== null) {
      clearTimeout(advanceTimerRef.current);
    }
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null;
      next();
    }, 350);
  };

  if (!word) {
    // Estado de carga: expone los mismos testIDs (ronda-screen + current-word)
    // que el estado "cargada" para que los tests E2E que esperan el primer
    // render de /ronda (palabra aún no inyectada por el store) no se cuelguen
    // buscando un selector inexistente. MGC-378.
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <View
          style={[styles.container, { padding: spacing[4], gap: spacing[4] }]}
          testID="ronda-screen"
        >
          <View style={styles.empty} testID="current-word">
            <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>
              Cargando palabra…
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.bg }]}
      edges={['top']}
    >
      <View
        style={[styles.container, { padding: spacing[4], gap: spacing[4] }]}
        testID="ronda-screen"
      >
        <ScoreBoard
          score={score}
          bestStreak={streak}
          roundIndex={round}
          totalRounds={totalRounds}
        />

        <RoundTimer
          totalSeconds={Math.ceil(DEFAULT_ROUND_DURATION_MS / 1000)}
          remainingSeconds={Math.ceil(remaining / 1000)}
          urgentAt={5}
          testID="round-timer"
          onTimeout={handleTimeout}
        />

        <WordCard
          testID="current-word"
          word={word.text}
          category="Adiviná"
          hint={word.hint}
        />

        <View style={{ gap: spacing[3] }}>
          <Button
            label="¡Acerté!"
            onPress={handleCorrect}
            variant="primary"
            size="lg"
            fullWidth
            testID="btn-correct"
          />
          <Button
            label="Pasar"
            onPress={handleSkip}
            variant="secondary"
            size="lg"
            fullWidth
            testID="btn-skip"
            accessibilityHint="Salta la palabra actual sin sumar puntos"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1 },
});
