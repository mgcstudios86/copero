import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '@/design';
import { gameT } from '@/i18n/game-copy';
import type { GameLocale } from '@/i18n/game-copy';

/**
 * OriginPhase — header de la fase de origen (MGC-232).
 *
 * Encapsula el bloque eyebrow + título + bajada de la pantalla de elección
 * de club. El título se arma con `gameT('origin.title', { count })`, así que
 * si el catálogo pasa de 4 a 3 o a 5 clubes el copy sigue al catálogo sin
 * tocar código ni redeployar.
 *
 * Regresión que cubre: MGC-222 ("TRES CAMINOS" con 4 clubes) y MGC-232
 * ("CUATRO" hardcodeado).
 */
export function OriginPhase({ count, locale }: { count: number; locale?: GameLocale }) {
  const { colors, spacing, fontSize, fontWeight } = useTheme();

  return (
    <View style={{ gap: spacing[2] }}>
      <Text
        style={{
          color: colors.primary,
          letterSpacing: 4,
          fontSize: fontSize.sm,
          fontWeight: fontWeight.bold,
        }}
        accessibilityRole="header"
      >
        {gameT('origin.eyebrow', undefined, locale)}
      </Text>
      <Text
        style={{
          color: colors.textStrong,
          fontSize: fontSize['2xl'],
          fontWeight: fontWeight.bold,
        }}
        accessibilityRole="header"
        testID="origin-title"
      >
        {gameT('origin.title', { count }, locale)}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>
        {gameT('origin.body', undefined, locale)}
      </Text>
    </View>
  );
}

export default OriginPhase;
