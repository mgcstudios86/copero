import { View, Text, Platform, AccessibilityRole } from 'react-native';
import { useTheme } from '@/design';

const DIALOG_ROLE = 'dialog' as AccessibilityRole;

/**
 * Placeholders nativos (AdMob). El módulo real `react-native-google-mobile-ads`
 * requiere rebuild nativo + keys de AdMob; se conecta cuando MGC-292 lo apruebe.
 * Mantener interfaz idéntica a `provider.web.tsx` para que el resto del código
 * no sepa qué provider está activo.
 */

const BANNER_HEIGHT = 60;

export const Banner = () => {
  const { colors, spacing, fontSize } = useTheme();
  if (Platform.OS === 'web') return null;
  return (
    <View
      testID="ad-banner-native"
      importantForAccessibility="no-hide-descendants"
      accessibilityLabel="Espacio publicitario"
      style={{
        minHeight: BANNER_HEIGHT,
        backgroundColor: colors.surface2,
        borderTopWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing[1],
      }}
    >
      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, letterSpacing: 1 }}>
        PUBLICIDAD
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 9 }}>AdMob slot</Text>
    </View>
  );
};

type InterstitialProps = {
  open: boolean;
  onClose: () => void;
};

export const Interstitial = ({ open, onClose }: InterstitialProps) => {
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  if (Platform.OS === 'web') return null;
  if (!open) return null;
  return (
    <View
      testID="ad-interstitial-native"
      accessibilityRole={DIALOG_ROLE}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: colors.overlay,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing[5],
        zIndex: 1000,
      }}
    >
      <View
        style={{
          width: '100%',
          maxWidth: 480,
          backgroundColor: colors.surface,
          borderRadius: radii.lg,
          padding: spacing[5],
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            color: colors.textMuted,
            fontSize: fontSize.xs,
            letterSpacing: 2,
            marginBottom: spacing[2],
          }}
        >
          PUBLICIDAD
        </Text>
        <View
          style={{
            width: '100%',
            height: 320,
            backgroundColor: colors.surface2,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            marginVertical: spacing[4],
          }}
        >
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
            Intersticial AdMob
          </Text>
        </View>
        <Text
          accessibilityRole="button"
          accessibilityLabel="Cerrar anuncio"
          onPress={onClose}
          style={{
            color: colors.primary,
            fontWeight: fontWeight.bold,
            fontSize: fontSize.base,
            paddingVertical: spacing[3],
          }}
        >
          Cerrar →
        </Text>
      </View>
    </View>
  );
};
