import { View, Text, Platform, AccessibilityRole } from 'react-native';
import { useTheme } from '@/design';

const DIALOG_ROLE = 'dialog' as AccessibilityRole;

/**
 * Provider de Ads para web (AdSense con fallback placeholder).
 * AdSense script se inyecta via `headContent` de app.json o <Head> en el layout.
 * Si no hay unidad cargada (bloqueador, dev local) mostramos un placeholder
 * con altura reservada — evita CLS en Core Web Vitals.
 */

const BANNER_HEIGHT = 60;

type BannerProps = {
  slotId?: string;
};

export const Banner = ({ slotId }: BannerProps) => {
  const { colors, spacing, fontSize } = useTheme();
  if (Platform.OS !== 'web') return null;
  return (
    <View
      testID="ad-banner-web"
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
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', height: BANNER_HEIGHT }}
        data-ad-client={slotId ?? 'ca-pub-XXXXXXXXXXXXXXXX'}
        data-ad-slot="1234567890"
        data-ad-format="auto"
      />
      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, letterSpacing: 1 }}>
        PUBLICIDAD
      </Text>
    </View>
  );
};

type InterstitialProps = {
  open: boolean;
  onClose: () => void;
};

export const Interstitial = ({ open, onClose }: InterstitialProps) => {
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  if (Platform.OS !== 'web') return null;
  if (!open) return null;
  return (
    <View
      testID="ad-interstitial-web"
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
            Espacio publicitario full-screen
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
          Cerrar y ver resultado →
        </Text>
      </View>
    </View>
  );
};
