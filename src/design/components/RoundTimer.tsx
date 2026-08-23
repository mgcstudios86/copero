import React, { useEffect, useRef } from 'react';
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

  useEffect(() => {
    if (remainingSeconds <= 0) {
      onTimeout?.();
    }
  }, [remainingSeconds, onTimeout]);

  const widthAnim = useRef(new Animated.Value(progress)).current;
  const colorAnim = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

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
  }, [progress, urgent, reducedMotion, motion.duration.base, motion.duration.fast, widthAnim, colorAnim]);

  const barColor = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.primary, colors.danger],
  });

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
            width: widthAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
            height: '100%',
            backgroundColor: barColor,
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
