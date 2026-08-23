/**
 * Barra de progreso segmentada (15 segmentos, uno por pregunta).
 * Se ilumina el segmento actual y los anteriores completados.
 */

import { View, StyleSheet } from 'react-native';
import { colors, radii } from '@/features/ui/theme';

type Props = {
  /** Total de preguntas. */
  total: number;
  /** Índice 0-based de la pregunta actual. */
  current: number;
  /** Set de ids respondidos (para iluminar segmentos ya completados). */
  answeredIds: ReadonlySet<string>;
  /** Ids en orden (preguntas). */
  questionIds: readonly string[];
};

export const ProgressBar = ({ total, current, answeredIds, questionIds }: Props) => {
  return (
    <View style={styles.row} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: current + 1 }}>
      {Array.from({ length: total }).map((_, i) => {
        const id = questionIds[i];
        const answered = answeredIds.has(id);
        const isCurrent = i === current;
        return (
          <View
            key={i}
            testID={`progress-segment-${i}`}
            style={[
              styles.segment,
              answered && styles.answered,
              isCurrent && styles.current,
            ]}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.bgElev,
  },
  answered: {
    backgroundColor: colors.primary,
  },
  current: {
    backgroundColor: colors.warning,
  },
});