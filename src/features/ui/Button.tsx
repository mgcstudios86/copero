/**
 * Compat shim — `Button` re-exporta el componente del design system (MGC-297).
 * Callers legados del compass (MGC-321 C1) pueden seguir importando desde
 * `@/features/ui`. La API acepta `variant: primary | secondary | ghost` y los
 * mapea al sistema nuevo.
 */
import { View } from 'react-native';
import { Button as DSButton } from '@/design/components/Button';
import type { ButtonVariant } from '@/design/components/Button';
import type { ViewStyle } from 'react-native';

type LegacyVariant = 'primary' | 'secondary' | 'ghost';

type Props = {
  label: string;
  onPress: () => void;
  variant?: LegacyVariant;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
  accessibilityHint?: string;
};

const mapVariant = (v: LegacyVariant | undefined): ButtonVariant => {
  switch (v) {
    case 'ghost':
      return 'ghost';
    case 'secondary':
      return 'secondary';
    case 'primary':
    default:
      return 'primary';
  }
};

export const Button = ({ label, onPress, variant, disabled, style, testID, accessibilityHint }: Props) => (
  <View style={style}>
    <DSButton
      label={label}
      onPress={onPress}
      variant={mapVariant(variant)}
      disabled={disabled}
      testID={testID}
      accessibilityHint={accessibilityHint}
    />
  </View>
);
