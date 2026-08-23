import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors, radii, spacing } from '@/features/ui/theme';

/**
 * Placeholders nativos (AdMob). El módulo real `react-native-google-mobile-ads`
 * requiere rebuild nativo + keys de AdMob; se conecta cuando MGC-292 lo apruebe.
 * Mantener interfaz idéntica a `provider.web.tsx` para que el resto del código
 * no sepa qué provider está activo.
 */

const BANNER_HEIGHT = 60;

export const Banner = () => {
  if (Platform.OS === 'web') return null;
  return (
    <View
      testID="ad-banner-native"
      accessibilityLabel="Espacio publicitario"
      style={styles.banner}
    >
      <Text style={styles.bannerLabel}>PUBLICIDAD</Text>
      <Text style={styles.bannerSubLabel}>AdMob slot</Text>
    </View>
  );
};

type InterstitialProps = {
  open: boolean;
  onClose: () => void;
};

export const Interstitial = ({ open, onClose }: InterstitialProps) => {
  if (Platform.OS === 'web') return null;
  if (!open) return null;
  return (
    <View
      testID="ad-interstitial-native"
      accessibilityRole="alert"
      style={styles.interstitialWrap}
    >
      <View style={styles.interstitialCard}>
        <Text style={styles.interstitialEyebrow}>PUBLICIDAD</Text>
        <View style={styles.interstitialSlot}>
          <Text style={styles.placeholder}>Intersticial AdMob</Text>
        </View>
        <Text
          accessibilityRole="button"
          onPress={onClose}
          style={styles.closeBtn}
        >
          Cerrar →
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    minHeight: BANNER_HEIGHT,
    backgroundColor: colors.bgElev,
    borderTopWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  bannerLabel: {
    color: colors.muted,
    fontSize: 10,
    letterSpacing: 1,
  },
  bannerSubLabel: {
    color: colors.muted,
    fontSize: 9,
  },
  interstitialWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    zIndex: 1000,
  },
  interstitialCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#0b1220',
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  interstitialEyebrow: {
    color: colors.muted,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  interstitialSlot: {
    width: '100%',
    height: 320,
    backgroundColor: colors.bgElev,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.lg,
  },
  placeholder: {
    color: colors.muted,
    fontSize: 14,
  },
  closeBtn: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 16,
    paddingVertical: spacing.md,
  },
});
