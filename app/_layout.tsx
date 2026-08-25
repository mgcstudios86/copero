import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, StyleSheet } from 'react-native';
import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { Banner } from '@/features/ads';
import { ThemeProvider, useTheme } from '@/design';
import { SiteHeader } from '@/design/components/SiteHeader';
import { LocaleProvider } from '@/i18n/locale-context';
import { SiteFooter } from '@/design/components/SiteFooter';

/**
 * MGC-555 PR1 — carga tipográfica.
 * Spec copero.com.ar §4: Inter (body), Poppins (headings).
 * Migrado de CDN hardcoded (fonts.gstatic.com) a paquetes versionados
 * `@expo-google-fonts/{inter,poppins}` (H2 review CTO MGC-559):
 * - Nativo: fuentes bundleadas en el APK/IPA, offline-first, sin
 *   dependencia de gstatic rotation paths.
 * - Web: expo-font resuelve `@font-face` automático con `display=swap`
 *   y subset latin; fallback a system-ui si la fuente no carga.
 */

function ThemedShell() {
  const { colors, mode } = useTheme();

  // MGC-556 — copia el `colors.bg` al `<body>` y `<html>` en web para que
  // `getComputedStyle(document.body).backgroundColor` matchee `palette.copero.bg`
  // (#09090B). RN-Web renderiza el theme en un `<div>` interno; el `<body>`
  // propiamente queda transparente y la captura muestra el negro default del
  // user-agent. Inyectar el color en ambos elementos resuelve el delta visual.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const target = colors.bg;
    document.documentElement.style.backgroundColor = target;
    document.body.style.backgroundColor = target;
  }, [colors.bg]);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar style={mode === 'dark' || mode === 'copero' ? 'light' : 'dark'} />
      {/*
        MGC-653 — SiteHeader global con 7 nav links + LanguageSwitcher +
        CTA "Jugar" verde. Reemplaza el header built-in de expo-router
        (todas las `Stack.Screen` debajo quedan con `headerShown: false`).
        El header chrome vive acá; las pantallas ya no deben montar su
        propio `<Header>`.
      */}
      <SiteHeader />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        {/*
          MGC-782 code-split: las 4 screens del juego viven en
          `src/features/game/screens/*` y se registran acá vía `getComponent`
          lazy. Antes eran wrappers `app/{categoria,ronda,fin,compass}.tsx`
          que Expo Router trataba como entry points de la SPA — Metro
          bundleaba el engine + words + scoring (FSM completa) en el chunk
          inicial del home, arrastrando ~25-40 KB gz al entry. Al sacar las
          rutas del filesystem de `app/` y registrarlas explícitamente con
          `getComponent: () => import(...)`, Metro emite chunks asincrónicos
          dedicados que sólo se descargan al navegar a /categoria, /ronda,
          /fin o /compass. Native safety (MGC-724) preservado: el cambio
          es de organización; no toca metro.config.js.

          Mismo patrón que MGC-771 para simulador-carrera. Las typings de
          Expo Router 57 omiten `getComponent` (el runtime lo soporta y
          Metro lo respeta para emitir chunks async) — @ts-expect-error
          por línea para destrabar typecheck.
        */}
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
      {/*
        MGC-657 — SiteFooter global. Renderiza debajo del Stack (debajo del
        contenido de cualquier screen) con copyright dinámico del año actual
        Privacy · Terms · Contacto · GitHub. Replica `site-footer` de
        kiya0908/copero (Gap P1 MGC-646 audit). Hairline divider arriba lo
        separa visualmente del contenido.
      */}
      <SiteFooter />
      <Banner />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter: Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
    Poppins: Poppins_400Regular,
    'Poppins-Medium': Poppins_500Medium,
    'Poppins-SemiBold': Poppins_600SemiBold,
    'Poppins-Bold': Poppins_700Bold,
  });

  if (!fontsLoaded && !fontError) {
    return <View style={styles.root} />;
  }

  return (
    <SafeAreaProvider>
      {/*
        MGC-555 PR2 + MGC-556 — `initialPreference="copero"` fija el theme
        copero (dark zinc-950 + accent purple #A855F7) como default para
        toda la app. La spec visual (MGC-554) replica copero.com.ar que es
        dark-only; el simulador-carrera debe mantener esa identidad
        independientemente de `prefers-color-scheme` del sistema. Sin esto,
        el Playwright parity spec captura el banner con `colors.primary`
        forest-green (#1F6F4A) cuando el sistema reporta light.
      */}
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
});
