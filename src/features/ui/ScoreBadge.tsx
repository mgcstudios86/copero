import { Text, View, StyleSheet } from 'react-native';
import { colors, radii, spacing } from '@/features/ui/theme';

type Props = {
  score: number;
  streak?: number;
  round?: number;
  totalRounds?: number;
  testID?: string;
};

export const ScoreBadge = ({ score, streak, round, totalRounds, testID }: Props) => (
  <View testID={testID} style={styles.row}>
    {typeof round === 'number' && typeof totalRounds === 'number' && (
      <View style={styles.pill}>
        <Text style={styles.pillLabel}>Ronda</Text>
        <Text style={styles.pillValue}>{round}/{totalRounds}</Text>
      </View>
    )}
    <View style={styles.pill}>
      <Text style={styles.pillLabel}>Puntos</Text>
      <Text style={styles.pillValue}>{score}</Text>
    </View>
    {typeof streak === 'number' && streak > 0 && (
      <View style={[styles.pill, styles.streakPill]}>
        <Text style={styles.pillLabel}>Racha</Text>
        <Text style={styles.pillValue}>🔥 {streak}</Text>
      </View>
    )}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pill: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.bgElev,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  streakPill: {
    backgroundColor: colors.warning,
    borderColor: colors.warning,
  },
  pillLabel: {
    color: colors.muted,
    fontSize: 12,
  },
  pillValue: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
});
