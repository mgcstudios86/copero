import { Stack, usePathname } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppState, Platform, View, StyleSheet, ActivityIndicator } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useFonts, FontDisplay } from 'expo-font';
import { Banner } from '@/features/ads';
import { ThemeProvider, useTheme } from '@/design';
import { SiteHeader } from '@/design/components/SiteHeader';
import { LocaleProvider } from '@/i18n/locale-context';
import { SiteFooter } from '@/design/components/SiteFooter';
import { useCareerStore, flushPendingSave } from '@/shared/store/careerStore';

/**
 * MGC-743 — split-layout (web) · carga tipográfica WOFF2 latin subset.
 *
 * Spec copero.com.ar §4: Inter (body), Poppins (headings).
 *
 * Antes (MGC-555 PR1): `@expo-google-fonts/{inter,poppins}` empacaban 8 TTFs
 * sin subset (~2 MB total) que se copiaban a `dist/assets/`. Lighthouse
 * mobile perf 55/100 — FCP 12.5 s, LCP 14.6 s por la descarga de fuentes
 * bloqueantes (FontDisplay.AUTO = FOIT en web).
 *
 * Fix MGC-743:
 * 1. Pre-subset latin-only + recodificar a WOFF2 (~30% TTF) — 8 TTFs
 *    1.99 MB → 8 WOFF2 ~191 KB (~9.6% del peso original).
 *    Ver `scripts/subset-fonts.py` para el subsetter (pyftsubset).
 * 2. Carga de fuentes en web usa `FontDisplay.SWAP` — texto cae al
 *    fallback `system-ui` mientras se descarga el WOFF2 → FCP visible
 *    antes. Sin FOIT.
 * 3. Critical preloads (`rel=preload as=font crossorigin`) en
 *    `scripts/inject-preload.mjs` para Inter-Regular + Poppins-Bold,
 *    los únicos pesos visibles en el first paint de `/` (body 400 +
 *    hero H1 Poppins 700).
 *
 * La variante `app/_layout.native.tsx` se usa para iOS/Android y sigue
 * resolviendo los TTF @expo-google-fonts (offline-first APK/IPA). Metro
 * elige esta variante en el bundle web gracias al sufijo `.web.tsx`.
 * Mantener sincronizada la lista de pesos con `_layout.native.tsx`.
 */

// Metro requiere require() con paths estáticos para análisis del grafo
// (no acepta template literals). Carga los 8 WOFF2 con referencias
// explícitas — Metro resuelve cada una a la URL hasheada en dist/assets/
// en tiempo de bundle. Ver `scripts/subset-fonts.py` para el subset.
// Tamaños típicos tras subset latin:
//   Inter-Regular.woff2 ≈ 35 KB · Poppins-Regular.woff2 ≈ 11 KB.
// eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
const InterRegular = require('../assets/fonts/woff2/Inter-Regular.woff2');
// eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
const InterMedium = require('../assets/fonts/woff2/Inter-Medium.woff2');
// eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
const InterSemiBold = require('../assets/fonts/woff2/Inter-SemiBold.woff2');
// eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
const InterBold = require('../assets/fonts/woff2/Inter-Bold.woff2');
// eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
const PoppinsRegular = require('../assets/fonts/woff2/Poppins-Regular.woff2');
// eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
const PoppinsMedium = require('../assets/fonts/woff2/Poppins-Medium.woff2');
// eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
const PoppinsSemiBold = require('../assets/fonts/woff2/Poppins-SemiBold.woff2');
// eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
const PoppinsBold = require('../assets/fonts/woff2/Poppins-Bold.woff2');

function ThemedShell() {
  const { colors, mode } = useTheme();
  // MGC-394 — chrome global (SiteHeader + SiteFooter + Banner) oculto
  // en la pantalla principal. Mantener sincronizado con `_layout.tsx`
  // y `_layout.native.tsx`.
  const pathname = usePathname();
  const isHome = pathname === '/' || pathname === '/index';

  // MGC-259 — gate de hidratación. Mismo patrón que `_layout.native.tsx`.
  // Bloqueamos el render del Stack hasta que `hydrateFromSave()` termine
  // para que la home no pinte con snapshot vacío y luego salte al
  // persistido. En web no hay force-stop del proceso (la pestaña vive
  // hasta refresh/close), pero el `refresh` del dev server o un F5
  // reproducen el mismo flash si no esperamos la carga de AsyncStorage.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void useCareerStore
      .getState()
      .hydrateFromSave()
      .catch(() => {
        // best-effort: misma política que la variante native.
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // MGC-259 — drenamos la save pendiente cuando la pestaña pasa a
  // hidden (cubrimos el caso de cerrar/refresh abrupto donde el
  // navegador mata el contexto JS antes de que `setItem` resuelva).
  // `AppState` en RN-Web reusa el evento `visibilitychange` del
  // browser y dispara `change` a `'background'` cuando `document.hidden`.
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (
        (prev === 'active' || prev === 'unknown') &&
        (next === 'background' || next === 'inactive')
      ) {
        void flushPendingSave();
      }
    });
    return () => sub.remove();
  }, []);

  // MGC-556 — copia el `colors.bg` al `<body>` y `<html>` en web para que
  // `getComputedStyle(document.body).backgroundColor` matchee `palette.copero.bg`.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const target = colors.bg;
    document.documentElement.style.backgroundColor = target;
    document.body.style.backgroundColor = target;
  }, [colors.bg]);

  if (!hydrated) {
    return (
      <View style={[styles.root, styles.hydrationGate, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar style={mode === 'dark' || mode === 'copero' ? 'light' : 'dark'} />
      {!isHome ? <SiteHeader /> : null}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        {/* MGC-782 code-split — ver comentario en app/_layout.tsx */}
        <Stack.Screen
          name="categoria"
          // @ts-expect-error Expo Router 57 typings omiten getComponent.
          getComponent={() => import('@/features/game/screens/categoria').then((m) => m.default)}
        />
        <Stack.Screen
          name="ronda"
          // @ts-expect-error Expo Router 57 typings omiten getComponent.
          getComponent={() => import('@/features/game/screens/ronda').then((m) => m.default)}
        />
        <Stack.Screen
          name="fin"
          // @ts-expect-error Expo Router 57 typings omiten getComponent.
          getComponent={() => import('@/features/game/screens/fin').then((m) => m.default)}
        />
        <Stack.Screen
          name="compass"
          // @ts-expect-error Expo Router 57 typings omiten getComponent.
          getComponent={() => import('@/features/game/screens/compass').then((m) => m.default)}
        />
        <Stack.Screen name="simulador-carrera" />
      </Stack>
      {!isHome ? <SiteFooter /> : null}
      {!isHome ? <Banner /> : null}
    </View>
  );
}

export default function RootLayout() {
  // MGC-743 — WOFF2 + FontDisplay.SWAP. expo-font genera
  //   @font-face { font-display: swap; src: url(<woff2>): ...; }
  // en un <style> in-lineado durante el primer render. El browser usa
  // system-ui como fallback mientras el WOFF2 se descarga, evitando FOIT.
  // Las claves del mapa coinciden con la API anterior — ningún componente
  // necesita cambio.
  const [fontsLoaded, fontError] = useFonts({
    Inter: { uri: InterRegular, display: FontDisplay.SWAP },
    'Inter-Medium': { uri: InterMedium, display: FontDisplay.SWAP },
    'Inter-SemiBold': { uri: InterSemiBold, display: FontDisplay.SWAP },
    'Inter-Bold': { uri: InterBold, display: FontDisplay.SWAP },
    Poppins: { uri: PoppinsRegular, display: FontDisplay.SWAP },
    'Poppins-Medium': { uri: PoppinsMedium, display: FontDisplay.SWAP },
    'Poppins-SemiBold': { uri: PoppinsSemiBold, display: FontDisplay.SWAP },
    'Poppins-Bold': { uri: PoppinsBold, display: FontDisplay.SWAP },
  });

  if (!fontsLoaded && !fontError) {
    return <View style={styles.root} />;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider initialPreference="copero">
        <LocaleProvider>
          <ThemedShell />
        </LocaleProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hydrationGate: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
