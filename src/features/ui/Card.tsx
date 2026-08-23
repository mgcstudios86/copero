import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii, spacing } from '@/features/ui/theme';

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
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
