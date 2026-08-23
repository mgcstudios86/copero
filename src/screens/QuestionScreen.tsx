/**
 * Pantalla de pregunta del Ideología Futbolística.
 *
 * Renderiza una pregunta con 2-3 opciones. El usuario selecciona una y avanza.
 */

import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/features/ui';
import { colors, radii, spacing } from '@/features/ui/theme';
import { QUESTIONS, type Question, type Option } from '@/data/questions';
import { useQuizStore } from '@/state/quizStore';
import { ProgressBar } from './ProgressBar';

type Props = {
  onAdvance: () => void;
  onFinish: () => void;
};

export const QuestionScreen = ({ onAdvance, onFinish }: Props) => {
  const currentIndex = useQuizStore((s) => s.currentIndex);
  const answers = useQuizStore((s) => s.answers);
  const answer = useQuizStore((s) => s.answer);
  const next = useQuizStore((s) => s.next);
  const previous = useQuizStore((s) => s.previous);

  const total = QUESTIONS.length;
  const question: Question = QUESTIONS[currentIndex];
  const selected = answers[question.id];

  const onSelect = (optionId: string) => {
    answer(question.id, optionId);
  };

  const handleAdvance = () => {
    if (currentIndex === total - 1) {
      next(); // setea phase=done
      onFinish();
    } else {
      next();
      onAdvance();
    }
  };

  const answeredIds = new Set(Object.keys(answers));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ProgressBar
        total={total}
        current={currentIndex}
        answeredIds={answeredIds}
        questionIds={QUESTIONS.map((q) => q.id)}
      />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.counter}>
          Pregunta {currentIndex + 1} de {total}
        </Text>
        <Text style={styles.prompt}>{question.prompt}</Text>

        <View style={styles.options}>
          {question.options.map((opt) => (
            <OptionRow
              key={opt.id}
              opt={opt}
              selected={selected === opt.id}
              onPress={() => onSelect(opt.id)}
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Button
            label="Atrás"
            variant="ghost"
            onPress={previous}
            disabled={currentIndex === 0}
            testID="btn-prev"
          />
        </View>
        <View style={{ flex: 2 }}>
          <Button
            label={currentIndex === total - 1 ? 'Ver resultado' : 'Siguiente'}
            onPress={handleAdvance}
            disabled={!selected}
            testID="btn-next"
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const OptionRow = ({
  opt,
  selected,
  onPress,
}: {
  opt: Option;
  selected: boolean;
  onPress: () => void;
}) => {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      testID={`option-${opt.id}`}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={[styles.dot, selected && styles.dotSelected]} />
      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
        {opt.label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  counter: {
    color: colors.muted,
    letterSpacing: 2,
    fontSize: 12,
    fontWeight: '700',
  },
  prompt: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
  },
  options: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.bgElev,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: '#052e16',
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.muted,
  },
  dotSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  optionLabel: {
    color: colors.text,
    fontSize: 16,
    flex: 1,
    lineHeight: 22,
  },
  optionLabelSelected: {
    color: colors.text,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
});