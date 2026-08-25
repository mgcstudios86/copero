import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { CATEGORIES_META } from '@/features/game/categories';
import { useGameStore } from '@/shared/store/gameStore';

export default function Categoria() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  const startGame = useGameStore((s) => s.startGame);

  const onPick = (id: typeof CATEGORIES_META[number]['id']) => {
    startGame(id);
    router.replace('/ronda');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing[4], gap: spacing[4] }}
        testID="categoria-screen"
      >
        <Text
          style={{
            color: colors.textStrong,
            fontSize: fontSize['2xl'],
            fontFamily: 'System',
            fontWeight: fontWeight.bold,
          }}
          accessibilityRole="header"
        >
          Elegí una categoría
        </Text>
        <Text
          style={{
            color: colors.textMuted,
            fontSize: fontSize.sm,
          }}
        >
          Cada categoría tiene palabras distintas. Jugá 10 rondas de 30 segundos.
        </Text>
        <View style={{ gap: spacing[3] }}>
          {CATEGORIES_META.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => onPick(c.id)}
              accessibilityRole="button"
              accessibilityLabel={`Elegir ${c.label}`}
              testID={`cat-${c.id}`}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.surface,
                  borderRadius: radii.lg,
                  padding: spacing[4],
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[3],
                },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={{ fontSize: 36 }}>{c.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: fontWeight.semibold,
                    fontSize: fontSize.md,
                  }}
                >
                  {c.label}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
                  {c.description}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
