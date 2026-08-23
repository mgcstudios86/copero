import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../useTheme';
import { useReducedMotion } from '../useReducedMotion';

type Props = {
  /** Total de la ronda en segundos. */
  totalSeconds: number;
  /** Segundos restantes (controlado). */
  remainingSeconds: number;
  /** Umbral (seg) para entrar en estado "urgente" (color danger). */
  urgentAt?: number;
  testID?: string;
  /** Notifica cuando el tiempo llega a 0 (callback opcional para integraciones
   * que prefieran manejar el timeout fuera del componente). */
  onTimeout?: () => void;
};

export function RoundTimer({ totalSeconds, remainingSeconds, urgentAt = 5, testID, onTimeout }: Props) {
  const { colors, radii, spacing, fontSize, fontWeight, motion } = useTheme();
  const reducedMotion = useReducedMotion();

  const progress = Math.max(0, Math.min(1, remainingSeconds / totalSeconds));
  const urgent = remainingSeconds <= urgentAt;

  // Animated.Value se mantiene entre renders. useState con lazy initializer
  // evita acceder a `.current` durante el render (regla react-hooks/refs de
  // eslint-config-expo 57). Animated.Value es mutable; useState sólo guarda
  // la referencia para que persista entre renders.
  const [widthAnim] = useState(() => new Animated.Value(progress));
  const [colorAnim] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));

  useEffect(() => {
    if (remainingSeconds <= 0) {
      onTimeout?.();
    }
  }, [remainingSeconds, onTimeout]);

  useEffect(() => {
    if (reducedMotion) {
      widthAnim.setValue(progress);
      colorAnim.setValue(urgent ? 1 : 0);
      return;
    }
    Animated.timing(widthAnim, {
      toValue: progress,
      duration: motion.duration.base,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
    Animated.timing(colorAnim, {
      toValue: urgent ? 1 : 0,
      duration: motion.duration.fast,
      useNativeDriver: false,
    }).start();
    // widthAnim y colorAnim son referencias estables vía useState lazy init;
    // se incluyen en deps para satisfacer react-hooks/exhaustive-deps.
  }, [progress, urgent, reducedMotion, motion.duration.base, motion.duration.fast, widthAnim, colorAnim]);

  // Interpolaciones se crean una sola vez. widthAnim y colorAnim son referencias
  // estables capturadas por el lazy initializer; colors.primary/danger son valores
  // del tema usados en el primer render (no cambian entre rondas).
  const [widthRange] = useState(() =>
    widthAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', '100%'],
    }),
  );
  const [colorRange] = useState(() =>
    colorAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [colors.primary, colors.danger],
    }),
  );

  const trackColor = colors.surface2;

  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel={`Tiempo restante: ${remainingSeconds} segundos`}
      accessibilityValue={{ min: 0, max: totalSeconds, now: remainingSeconds }}
      style={{ gap: spacing[1] }}
    >
      <View
        style={{
          height: 10,
          borderRadius: radii.pill,
          backgroundColor: trackColor,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={{
            width: widthRange,
            height: '100%',
            backgroundColor: colorRange,
            borderRadius: radii.pill,
          }}
        />
      </View>
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={{
          color: urgent ? colors.danger : colors.textMuted,
          fontSize: fontSize.sm,
          fontWeight: fontWeight.semibold,
          textAlign: 'right',
        }}
      >
        {remainingSeconds}s
      </Text>
    </View>
  );
}

export const RoundTimerStyles = StyleSheet.create({});
