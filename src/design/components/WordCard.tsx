import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../useTheme';

type Props = {
  word: string;
  category?: string;
  hint?: string;
  reveal?: boolean;
  testID?: string;
};

/**
 * Tarjeta principal con la palabra a adivinar. Modo `reveal` muestra la palabra
 * completa al final de la ronda. A11y: el screen reader anuncia la palabra
 * completa siempre (es información principal del juego).
 */
export function WordCard({ word, category, hint, reveal = false, testID }: Props) {
  const { colors, radii, spacing, fontSize, fontWeight, fontFamily } = useTheme();
  const masked = reveal
    ? word
    : word
        .split('')
        .map((c) => (c === ' ' ? ' ' : '_'))
        .join(' ');

  return (
    <View
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={
        reveal
          ? `Palabra: ${word}${category ? `. Categoría: ${category}` : ''}${hint ? `. Pista: ${hint}` : ''}`
          : `Palabra oculta${category ? `, categoría ${category}` : ''}${hint ? `. Pista: ${hint}` : ''}`
      }
      style={{
        backgroundColor: colors.surface,
        borderRadius: radii.xl,
        paddingVertical: spacing[6],
        paddingHorizontal: spacing[5],
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing[3],
      }}
    >
      {category ? (
        <Text
          style={{
            color: colors.textMuted,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          {category}
        </Text>
      ) : null}
      <Text
        style={{
          color: colors.textStrong,
          fontSize: reveal ? fontSize['2xl'] : fontSize.xl,
          fontFamily: fontFamily.display,
          fontWeight: fontWeight.bold,
          letterSpacing: 4,
          textAlign: 'center',
        }}
        // El View wrapper expone la palabra completa vía accessibilityLabel;
        // el texto visible se oculta al screen reader para evitar duplicación
        // (cuando reveal=false el masked text sería ilegible: solo guiones).
        accessibilityElementsHidden
      >
        {reveal ? word : masked}
      </Text>
      {hint ? (
        <Text
          style={{
            color: colors.accent,
            fontSize: fontSize.base,
            fontStyle: 'italic',
            textAlign: 'center',
          }}
        >
          💡 {hint}
        </Text>
      ) : null}
    </View>
  );
}
