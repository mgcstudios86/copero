import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing } from '@/features/ui/theme';
import { CATEGORIES_META } from '@/features/game/categories';
import { useGameStore } from '@/shared/store/gameStore';

export default function Categoria() {
  const router = useRouter();
  const startGame = useGameStore((s) => s.startGame);

  const onPick = (id: typeof CATEGORIES_META[number]['id']) => {
    startGame(id);
    router.replace('/ronda');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} testID="categoria-screen">
        <Text style={styles.title}>Elegí una categoría</Text>
        <Text style={styles.subtitle}>
          Cada categoría tiene palabras distintas. Jugá 10 rondas de 30 segundos.
        </Text>
        <View style={styles.grid}>
          {CATEGORIES_META.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => onPick(c.id)}
              accessibilityRole="button"
              accessibilityLabel={`Elegir ${c.label}`}
              testID={`cat-${c.id}`}
              style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
            >
              <Text style={styles.emoji}>{c.emoji}</Text>
              <Text style={styles.tileTitle}>{c.label}</Text>
              <Text style={styles.tileDesc}>{c.description}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.textDim,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
  grid: {
    gap: spacing.md,
  },
  tile: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  tilePressed: { opacity: 0.85 },
  emoji: { fontSize: 36 },
  tileTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 18,
  },
  tileDesc: {
    color: colors.muted,
    fontSize: 12,
    flex: 1,
  },
});
