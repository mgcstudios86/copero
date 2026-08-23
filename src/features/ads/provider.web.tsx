import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors, radii, spacing } from '@/features/ui/theme';

/**
 * Provider de Ads para web (AdSense con fallback placeholder).
 * AdSense script se inyecta via `headContent` de app.json o <Head> en el layout.
 * Si no hay unidad cargada (bloqueador, dev local) mostramos un placeholder
 * con altura reservada — evita CLS en Core Web Vitals.
 */

const BANNER_HEIGHT = 60;
const INTERSTITIAL_BG = '#0b1220';

type BannerProps = {
  slotId?: string;
};

export const Banner = ({ slotId }: BannerProps) => {
  if (Platform.OS !== 'web') return null;
  return (
    <View
      testID="ad-banner-web"
      accessibilityLabel="Espacio publicitario"
      style={styles.banner}
    >
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', height: BANNER_HEIGHT }}
        data-ad-client={slotId ?? 'ca-pub-XXXXXXXXXXXXXXXX'}
        data-ad-slot="1234567890"
        data-ad-format="auto"
      />
      <Text style={styles.bannerLabel}>PUBLICIDAD</Text>
    </View>
  );
};

type InterstitialProps = {
  open: boolean;
  onClose: () => void;
};

export const Interstitial = ({ open, onClose }: InterstitialProps) => {
  if (Platform.OS !== 'web') return null;
  if (!open) return null;
  return (
    <View
      testID="ad-interstitial-web"
      accessibilityRole="alert"
      style={styles.interstitialWrap}
    >
      <View style={styles.interstitialCard}>
        <Text style={styles.interstitialEyebrow}>PUBLICIDAD</Text>
        <View style={styles.interstitialSlot}>
          <Text style={styles.placeholder}>Espacio publicitario full-screen</Text>
        </View>
        <Text
          accessibilityRole="button"
          onPress={onClose}
          style={styles.closeBtn}
        >
          Cerrar y ver resultado →
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
    backgroundColor: INTERSTITIAL_BG,
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
