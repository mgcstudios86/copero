import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { Interstitial } from '@/features/ads';
import { useGameStore } from '@/shared/store/gameStore';
import { useAdsStore } from '@/shared/store/adsStore';

export default function Fin() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight, fontFamily, lineHeight } = useTheme();
  const score = useGameStore((s) => s.score);
  const bestStreak = useGameStore((s) => s.bestStreak);
  const rounds = useGameStore((s) => s.rounds);
  const reset = useGameStore((s) => s.reset);
  const requestInterstitial = useAdsStore((s) => s.requestInterstitial);
  const markInterstitialShown = useAdsStore((s) => s.markInterstitialShown);

  const [interstitialOpen, setInterstitialOpen] = useState(false);

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
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.container, { padding: spacing[4], gap: spacing[4] }]}
        testID="fin-screen"
      >
        <View style={{ gap: spacing[1] }}>
          <Text
            style={{
              color: colors.primary,
              letterSpacing: 4,
              fontSize: fontSize.sm,
              fontWeight: fontWeight.bold,
            }}
            accessibilityRole="header"
          >
            COPERO TERMINADO
          </Text>
          <Text
            style={{
              color: colors.textStrong,
              fontSize: fontSize['2xl'],
              fontFamily: fontFamily.display,
              fontWeight: fontWeight.bold,
            }}
            accessibilityRole="header"
          >
            Tu resultado
          </Text>
        </View>

        <View
          accessibilityRole="summary"
          accessibilityLabel={`Puntos finales: ${score}. Mejor racha: ${bestStreak}. Acertó ${correctCount}, pasó ${skipCount}, timeout ${timeoutCount}.`}
          style={{
            backgroundColor: colors.surface,
            borderRadius: radii.lg,
            padding: spacing[6],
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            gap: spacing[2],
          }}
        >
          <Text
            style={{
              color: colors.textMuted,
              letterSpacing: 2,
              fontSize: fontSize.xs,
              fontWeight: fontWeight.medium,
              textTransform: 'uppercase',
            }}
          >
            Puntos finales
          </Text>
          <Text
            testID="final-score"
            style={{
              color: colors.textStrong,
              fontSize: fontSize.display,
              fontFamily: fontFamily.display,
              fontWeight: fontWeight.bold,
              lineHeight: fontSize.display * lineHeight.tight,
            }}
          >
            {score}
          </Text>
          <Text
            style={{
              color: colors.accent,
              fontSize: fontSize.base,
              fontWeight: fontWeight.semibold,
            }}
          >
            🔥 Mejor racha: {bestStreak}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radii.lg,
            padding: spacing[4],
            borderWidth: 1,
            borderColor: colors.border,
            gap: spacing[3],
          }}
        >
          <Text
            style={{
              color: colors.text,
              fontWeight: fontWeight.semibold,
              fontSize: fontSize.base,
            }}
          >
            Detalle por ronda
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Stat label="Acertó" value={correctCount} color={colors.success} />
            <Stat label="Pasó" value={skipCount} color={colors.warning} />
            <Stat label="Timeout" value={timeoutCount} color={colors.danger} />
          </View>
        </View>

        <Button
          label="Jugar de nuevo"
          onPress={onPlayAgain}
          variant="primary"
          size="lg"
          fullWidth
          testID="btn-play-again"
        />
      </ScrollView>

      {/* Provider nativo/web de ads intersticiales */}
      <Interstitial open={interstitialOpen} onClose={onCloseAd} />
    </SafeAreaView>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  const { colors, fontSize, fontWeight, fontFamily } = useTheme();
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text
        style={{ color, fontSize: fontSize['2xl'], fontFamily: fontFamily.mono, fontWeight: fontWeight.bold }}
      >
        {value}
      </Text>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: fontSize.xs,
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flexGrow: 1 },
});
