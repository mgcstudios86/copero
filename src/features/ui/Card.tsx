/**
 * Compat shim — `Card` envuelve un `View` con tokens del design system (MGC-297)
 * para mantener la API legacy del compass (MGC-321 C1).
 */
import { View, StyleSheet } from 'react-native';
import { colors, radii, spacing } from './theme';
import type { ViewStyle } from 'react-native';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
};

export const Card = ({ children, style, testID }: Props) => (
  <View testID={testID} style={[styles.card, style]}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
