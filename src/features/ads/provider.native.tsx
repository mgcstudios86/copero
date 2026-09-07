import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Platform,
  Pressable,
  StyleSheet,
  AccessibilityRole,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design';

// `expo-constants` se carga lazy para no romper `vitest` (su transitivo
// `expo-modules-core` referencia `__DEV__`, que no existe en Node test env).
// Si falla la carga (CI web, tests), caemos a TestIds sin tirar la suite.
type ExpoConstantsLike = {
  expoConfig?: { extra?: { admob?: Partial<AdMobConfig> } };
};
const resolveConstants = (): ExpoConstantsLike | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-constants') as ExpoConstantsLike;
  } catch {
    return null;
  }
};
const ConstantsRef: ExpoConstantsLike | null = resolveConstants();

// `dialog` role en Android con TalkBack lanza
// `JSApplicationIllegalArgumentException: Invalid accessibility role value: dialog`
// en ViewManagersPropertyCache. Omitimos en Android; iOS sigue con `dialog`.
const DIALOG_ROLE: AccessibilityRole =
  Platform.OS === 'android' ? 'none' : ('dialog' as AccessibilityRole);

/**
 * Provider nativo de AdMob (MGC-323 / C3).
 *
 * Carga `react-native-google-mobile-ads` **lazy** mediante `require` en try/catch.
 * Si el módulo nativo no está instalado (CI web, runner sin `npm install` local
 * del paquete), caemos al placeholder visible. Esto permite que `expo export`
 * y los tests de Vitest sigan corriendo aunque el módulo nativo aún no esté
 * en el lockfile.
 *
 * Para activar la unidad real en un Dev Client:
 *   npm install react-native-google-mobile-ads
 *   cd ios && pod install && cd ..
 *   npx expo prebuild --no-install
 * (ver docs/ads.md §3)
 */

const BANNER_HEIGHT = 60;

type AdMobConfig = {
  enabled: boolean;
  bannerUnitId: string;
  interstitialUnitId: string;
  testBannerUnitId: string;
  testInterstitialUnitId: string;
};

const TEST_IDS = {
  banner: 'ca-app-pub-3940256099942544/6300978111',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
};

const readAdMobConfig = (): AdMobConfig => {
  // Preferimos los `extra` que `app.config.js` ya inyectó; si falta algo
  // o `expo-constants` no se pudo cargar, caemos a TestIds.
  const extra = ConstantsRef?.expoConfig?.extra?.admob ?? {};
  return {
    enabled: Boolean(extra.enabled),
    bannerUnitId: extra.bannerUnitId ?? TEST_IDS.banner,
    interstitialUnitId: extra.interstitialUnitId ?? TEST_IDS.interstitial,
    testBannerUnitId: extra.testBannerUnitId ?? TEST_IDS.banner,
    testInterstitialUnitId: extra.testInterstitialUnitId ?? TEST_IDS.interstitial,
  };
};

const resolveSdk = (): {
  BannerAd?: React.ComponentType<{ unitId: string; size?: string }>;
  InterstitialAd?: new (opts: { adUnitId: string }) => {
    addAdEventListener: (
      type: 'loaded' | 'closed' | 'error' | 'opened',
      cb: (payload?: unknown) => void,
    ) => () => void;
    show: () => Promise<void>;
    load: () => Promise<void>;
  };
  AdEventType?: { CLOSED: 'closed' };
  BannerAdSize?: { BANNER: string };
} | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sdk = require('react-native-google-mobile-ads');
    return sdk;
  } catch {
    return null;
  }
};

const SDK = Platform.OS === 'web' ? null : resolveSdk();

// ─────────────────────────────────────────────────────────────────────────────
// Banner
// ─────────────────────────────────────────────────────────────────────────────

export const Banner = () => {
  const { colors, fontSize } = useTheme();
  // MGC-1802 P2-3 — el walk MGC-1739 catalogó "Ad banner superpone
  // system nav bar" porque el banner se montaba como sibling del
  // Stack sin respetar `insets.bottom` del system nav bar (gesture
  // bar en Android, home indicator en iOS). Sumamos paddingBottom =
  // insets.bottom para que el banner quede ARRIBA del nav bar sin
  // taparlo. Patrón canónico MGC-394 (SafeAreaView edges=['bottom']).
  const insets = useSafeAreaInsets();
  const cfg = useMemo(() => readAdMobConfig(), []);
  // SDK se resuelve sincrónicamente en module-load (resolveSdk).
  // Derivar `sdkReady` evita setState dentro de useEffect
  // (regla react-hooks/set-state-in-effect --max-warnings=0).
  const sdkReady = !!SDK?.BannerAd;

  if (Platform.OS === 'web') return null;

  const unitId = cfg.enabled ? cfg.bannerUnitId : cfg.testBannerUnitId;

  if (sdkReady && SDK?.BannerAd) {
    return (
      <View
        testID="ad-banner-native"
        accessibilityLabel="Espacio publicitario"
        style={[
          styles.banner,
          {
            borderColor: colors.border,
            backgroundColor: colors.surface2,
            // MGC-1802 P2-3 — respeta system nav bar inset.
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <SDK.BannerAd unitId={unitId} size={SDK.BannerAdSize?.BANNER ?? 'BANNER'} />
      </View>
    );
  }

  // Placeholder (CI web, tests, módulo nativo no instalado).
  return (
    <View
      testID="ad-banner-native"
      importantForAccessibility="no-hide-descendants"
      accessibilityLabel="Espacio publicitario"
      style={[
        styles.banner,
        {
          borderColor: colors.border,
          backgroundColor: colors.surface2,
          // MGC-1802 P2-3 — respeta system nav bar inset.
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <Text
        style={{ color: colors.textMuted, fontSize: fontSize.xs, letterSpacing: 1 }}
      >
        PUBLICIDAD
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 9 }}>
        {cfg.enabled ? `AdMob ${unitId}` : 'AdMob TestId'}
      </Text>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Interstitial
// ─────────────────────────────────────────────────────────────────────────────

type InterstitialProps = {
  open: boolean;
  onClose: () => void;
};

export const Interstitial = ({ open, onClose }: InterstitialProps) => {
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  const cfg = useMemo(() => readAdMobConfig(), []);
  const [usingSdk, setUsingSdk] = useState(false);

  // Cuando `open` pasa a true y tenemos SDK, mostramos la unidad real.
  // La rama síncrona (try/catch) se mueve a un IIFE async para evitar
  // setState directo en el cuerpo del useEffect
  // (regla react-hooks/set-state-in-effect --max-warnings=0).
  useEffect(() => {
    if (!open || !SDK?.InterstitialAd || !SDK?.AdEventType) return;
    let cancelled = false;
    let unsubClose: (() => void) | null = null;

    (async () => {
      try {
        const InterstitialAdCtor = SDK.InterstitialAd;
        const AdEventType = SDK.AdEventType;
        if (!InterstitialAdCtor || !AdEventType) return;
        const ad = new InterstitialAdCtor({
          adUnitId: cfg.enabled ? cfg.interstitialUnitId : cfg.testInterstitialUnitId,
        });
        unsubClose = ad.addAdEventListener(AdEventType.CLOSED, () => {
          if (!cancelled) {
            setUsingSdk(false);
            onClose();
          }
        });
        await ad.load();
        if (cancelled) return;
        setUsingSdk(true);
        await ad.show();
      } catch {
        if (!cancelled) setUsingSdk(false);
      }
    })();

    return () => {
      cancelled = true;
      if (unsubClose) unsubClose();
    };
  }, [open, cfg.enabled, cfg.interstitialUnitId, cfg.testInterstitialUnitId, onClose]);

  if (Platform.OS === 'web') return null;

  // Si la unidad real del SDK se mostró, no dibujamos overlay placeholder encima.
  if (usingSdk) return null;

  if (!open) return null;

  return (
    <View
      testID="ad-interstitial-native"
      accessibilityRole={DIALOG_ROLE}
      accessibilityViewIsModal={Platform.OS === 'android'}
      style={[styles.interstitialWrap, { backgroundColor: colors.overlay }]}
    >
      <View
        style={[
          styles.interstitialCard,
          { backgroundColor: colors.surface, borderRadius: radii.lg },
        ]}
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
          style={[
            styles.interstitialSlot,
            {
              backgroundColor: colors.surface2,
              borderColor: colors.border,
              borderRadius: radii.md,
              marginVertical: spacing[4],
            },
          ]}
        >
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
            {SDK ? 'Intersticial AdMob (cargando)' : 'Intersticial AdMob'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar anuncio"
          onPress={onClose}
          style={{ paddingVertical: spacing[3] }}
        >
          <Text
            style={{
              color: colors.primary,
              fontWeight: fontWeight.bold,
              fontSize: fontSize.base,
            }}
          >
            Cerrar →
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    minHeight: BANNER_HEIGHT,
    borderTopWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  interstitialWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 1000,
  },
  interstitialCard: {
    width: '100%',
    maxWidth: 480,
    padding: 24,
    alignItems: 'center',
  },
  interstitialSlot: {
    width: '100%',
    height: 320,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
