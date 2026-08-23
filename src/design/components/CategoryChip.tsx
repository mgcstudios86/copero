import React from 'react';
import { Pressable, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../useTheme';
import { useReducedMotion } from '../useReducedMotion';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
  hint?: string;
};

export function CategoryChip({ label, selected, onPress, testID, hint }: Props) {
  const { colors, radii, spacing, fontSize, tapTarget, borderWidth } = useTheme();
  const reducedMotion = useReducedMotion();

  const base: ViewStyle = {
    minHeight: tapTarget,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius: radii.pill,
    borderWidth: borderWidth.chip,
    borderColor: selected ? colors.primary : colors.border,
    backgroundColor: selected ? colors.primarySoft : colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  };

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        base,
        pressed && !reducedMotion ? { transform: [{ scale: 0.97 }] } : null,
      ]}
    >
      {selected ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.primary,
          }}
        />
      ) : null}
      <Text
        style={{
          color: selected ? colors.textStrong : colors.text,
          fontSize: fontSize.base,
          fontWeight: selected ? '600' : '500',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
