import { useEffect } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { colors, radii } from '@/features/ui/theme';
import { useGameStore } from '@/shared/store/gameStore';
import { DEFAULT_ROUND_DURATION_MS } from '@/features/game/engine';

type Props = {
  /** ms totales; default = DEFAULT_ROUND_DURATION_MS */
  totalMs?: number;
  /** Notifica cuando llega a 0 (timeout) */
  onTimeout?: () => void;
  testID?: string;
};

export const Timer = ({ totalMs = DEFAULT_ROUND_DURATION_MS, onTimeout, testID }: Props) => {
  const remaining = useGameStore((s) => s.timerMsRemaining);
  const tick = useGameStore((s) => s.tickTimer);

  useEffect(() => {
    if (remaining <= 0) {
      onTimeout?.();
      return;
    }
    const id = setTimeout(() => tick(remaining - 100), 100);
    return () => clearTimeout(id);
  }, [remaining, tick, onTimeout]);

  const ratio = Math.max(0, Math.min(1, remaining / totalMs));
  const seconds = (remaining / 1000).toFixed(1);
  const barColor = ratio > 0.5 ? colors.primary : ratio > 0.2 ? colors.warning : colors.danger;

  return (
    <View testID={testID} accessibilityRole="timer" accessibilityLabel={`Tiempo restante ${seconds} segundos`}>
      <Text style={styles.label}>{seconds}s</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: barColor }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    color: colors.textDim,
    fontSize: 14,
    textAlign: 'right',
    marginBottom: 4,
  },
  track: {
    height: 8,
    backgroundColor: colors.bgElev,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    borderRadius: radii.pill,
  },
});
