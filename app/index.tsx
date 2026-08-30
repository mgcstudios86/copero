import React from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/design';
import { Button } from '@/design/components';

/**
 * Home — MGC-394 splash + botón Jugar.
 *
 * Limpieza del landing: la pantalla principal muestra solo la imagen
 * de referencia (assets/splash.png) y un CTA "Jugar" verde que inicia
 * la carrera. Sin form de identidad, sin hero card premium, sin
 * comparador Classic/Purist, sin FAQ, sin tags, sin mini-stats, sin
 * "Continuar carrera", sin dorsal, sin anchors #how-to-play. El
 * header global con 7 links (SiteHeader) y el footer global con
 * Privacy · Terms · Contacto · GitHub (SiteFooter) tampoco se
 * renderizan acá — el chrome vive solo en rutas internas (ver
 * `app/_layout.tsx`, que los oculta cuando pathname === '/').
 *
 * La lógica de carrera no se toca: este screen es solo presentación.
 * El push a /simulador-carrera delega al flow existente (identity →
 * dashboard → draft → club → season → retirement).
 *
 * A11y:
 * - `accessibilityRole="image"` + `accessibilityLabel` en el splash.
 * - CTA con `accessibilityRole="button"` + label "Jugar / Iniciar
 *   carrera" explícito.
 */

export default function Home() {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();

  // MGC-394: el splash respeta el aspectRatio original (1242 x 2436
  // ≈ 0.51). En viewports anchos (tablet/web) limitamos el alto a
  // 70vh para que el botón quede visible sin scroll. En móvil portrait
  // el splash llena el ancho y se centra verticalmente sobre `colors.bg`.
  const SPLASH_ASPECT = 1242 / 2436;
  const splashWidth = viewportWidth;
  const splashHeight = Math.min(splashWidth / SPLASH_ASPECT, viewportHeight * 0.7);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.bg }]}
      edges={['top', 'bottom']}
      // MGC-394: conservamos `home-screen` como testID legacy del
      // contenedor (los specs de Playwright que sólo verifican que el
      // landing montó siguen pasando) y agregamos `home-screen-clean`
      // como segundo testID canónico vía wrapper. Los specs que
      // assertan la presencia de elementos del home anterior
      // (home-tag-list, btn-career, etc.) ahora deben usar
      // `toHaveCount(0)` — eso valida la limpieza.
      testID="home-screen"
    >
      <View
        style={[
          styles.container,
          {
            paddingHorizontal: spacing[5],
            paddingVertical: spacing[6],
            gap: spacing[6],
          },
        ]}
        testID="home-screen-clean"
      >
        <View style={styles.splashWrap}>
          <Image
            source={require('../assets/splash.png')}
            style={{
              width: splashWidth,
              height: splashHeight,
              maxWidth: 480,
              alignSelf: 'center',
            }}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="Imagen de portada del simulador de carrera"
            testID="home-splash-image"
          />
        </View>

        <Button
          label="Jugar"
          onPress={() => router.push('/simulador-carrera')}
          variant="primary"
          size="lg"
          fullWidth
          testID="btn-home-play"
          accessibilityLabel="Jugar. Iniciar carrera."
          accessibilityHint="Abre la pantalla para crear tu carrera futbolística"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ display: 'flex' } as const) : null),
  },
  splashWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});