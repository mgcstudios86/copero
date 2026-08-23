/**
 * Pantalla de bienvenida del Ideología Futbolística.
 *
 * CTA principal: empezar el quiz. Texto breve y copy propia.
 */

import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card } from '@/features/ui';
import { colors, spacing } from '@/features/ui/theme';
import { useQuizStore } from '@/state/quizStore';

type Props = {
  onStart: () => void;
  /** Si hay respuestas guardadas, permitir reanudar. */
  hasSavedProgress: boolean;
  onResume?: () => void;
};

export const SplashScreen = ({ onStart, hasSavedProgress, onResume }: Props) => {
  const reset = useQuizStore((s) => s.reset);
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>COPERO</Text>
          <Text style={styles.title}>Ideología Futbolística</Text>
          <Text style={styles.subtitle}>
            15 preguntas. Un compass. Tu DT más parecido.
          </Text>
        </View>

        <Card>
          <Text style={styles.howTitle}>Cómo se juega</Text>
          <Text style={styles.howText}>
            1. Respondé 15 preguntas filosóficas.{'\n'}
            2. Tus respuestas se proyectan en un compass 2D.{'\n'}
            3. Te decimos qué DT se parece más a tu manera de ver el fútbol.
          </Text>
        </Card>

        <Card>
          <Text style={styles.howTitle}>Los ejes</Text>
          <Text style={styles.howText}>
            Horizontal: <Text style={styles.bold}>Posesión</Text> ↔ <Text style={styles.bold}>Vertical</Text>.{'\n'}
            Vertical: <Text style={styles.bold}>Pragmático</Text> ↔ <Text style={styles.bold}>Dogmático</Text>.
          </Text>
        </Card>

        <View style={styles.cta}>
          <Button
            label={hasSavedProgress ? 'Reanudar' : 'Empezar'}
            onPress={() => {
              if (hasSavedProgress && onResume) {
                onResume();
              } else {
                reset();
                onStart();
              }
            }}
            testID="btn-start"
          />
          {hasSavedProgress && (
            <View style={{ marginTop: spacing.md }}>
              <Button
                label="Empezar de cero"
                onPress={() => {
                  reset();
                  onStart();
                }}
                variant="ghost"
                testID="btn-reset"
              />
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  hero: { paddingTop: spacing.xl },
  eyebrow: {
    color: colors.primary,
    letterSpacing: 4,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.textDim,
    fontSize: 16,
    marginTop: spacing.sm,
    lineHeight: 22,
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
  bold: {
    color: colors.text,
    fontWeight: '700',
  },
  cta: {
    marginVertical: spacing.md,
  },
});