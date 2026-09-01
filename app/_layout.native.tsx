import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppState, Platform, View, StyleSheet, ActivityIndicator } from 'react-native';
import { useEffect, useRef } from 'react';
import { useFonts } from 'expo-font';
// MGC-743 — imports subpath explícitos: el `index.js` raíz de
// @expo-google-fonts/{inter,poppins} re-exporta TODOS los pesos (100Thin
// a 900Black + italic), pero acá sólo necesitamos 4 pesos por familia.
// Subpath imports permiten a Metro DCE los 28 no usados. Jugar este
// desempate para APK: ahorra ~3.5 MB en el bundle TTF binario nativo.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Poppins_400Regular } from '@expo-google-fonts/poppins/400Regular';
import { Poppins_500Medium } from '@expo-google-fonts/poppins/500Medium';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins/600SemiBold';
import { Poppins_700Bold } from '@expo-google-fonts/poppins/700Bold';
import { Banner } from '@/features/ads';
import { ThemeProvider, useTheme } from '@/design';
import { SiteHeader } from '@/design/components/SiteHeader';
import { LocaleProvider } from '@/i18n/locale-context';
// MGC-394: SiteFooter removido del root layout (ver comentario sobre el JSX).
import {
  useCareerStore,
  bootstrapPersistence,
  flushPendingSave,
} from '@/shared/store/careerStore';

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

  // MGC-722 — gate de hidratación usando `hydrated` flag del store (mismo
  // patrón que `_layout.tsx`). Antes este layout tenía `useState(false)`
  // local + no llamaba `bootstrapPersistence()`: el module-level AppState
  // listener de `careerStore.ts` (que drena `pendingSave` y vuelca
  // `lastSnapshot` a disco) NUNCA se instalaba en builds Android/iOS. Sin
  // esa red, una save en vuelo al momento de un force-stop (Android no
  // envía AppState 'background' en force-stop) podía quedar huérfana y la
  // home re-pintaba con initialSnapshot vacío en el relaunch (AC4/AC7 de
  // MGC-722 sobre build-MGC306-159-14-dc89705.apk).
  const hydrated = useCareerStore((s) => s.hydrated);
  useEffect(() => {
    bootstrapPersistence();
    void useCareerStore
      .getState()
      .hydrateFromSave()
      .catch(() => {
        // Falla best-effort: si AsyncStorage falla, dejamos el
        // initial snapshot y desbloqueamos igual para no bloquear la
        // UI forever.
        useCareerStore.setState({ hydrated: true });
      });
  }, []);

  // MGC-722 — drenamos la save pendiente cuando el OS manda la app a
  // background (app switcher, lockscreen). Defensa redundante sobre el
  // module-level listener instalado por `bootstrapPersistence()`. Cubre el
  // gap si el orden de imports retrasa la instalación module-level.
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
      {/*
        MGC-653 — SiteHeader global con 7 nav links + LanguageSwitcher +
        CTA "Jugar" verde. Reemplaza el header built-in de expo-router
        (todas las `Stack.Screen` debajo quedan con `headerShown: false`).
        El header chrome vive acá; las pantallas ya no deben montar su
        propio `<Header>`.
      */}
      <SiteHeader />
      <Stack
        initialRouteName="index"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      >
        {/* MGC-534 — `initialRouteName="index"` fuerza al cold-start nativo
            (post `pm clear` + `am start`) a montar `app/index.tsx` (home,
            `testID=btn-career`). Sin esto, Expo Router 57 puede resolver
            `simulador-carrera` como entry point cuando AsyncStorage está
            vacío, lo que dispara el `<Redirect>` de
            `app/simulador-carrera/index.tsx` → `/simulador-carrera/identity`
            e invalida el primer assert del Maestro flow. */}
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
        {/*
          MGC-1160 — `simulador-carrera/identity` se resuelve via file-based
          route `app/simulador-carrera/identity.tsx` (MGC-379 + MGC-429 +
          MGC-771). No registrar acá: la registration explícita en root
          Stack con `name="simulador-carrera/identity"` provoca "Unmatched
          Route" en pm clear + cold start sobre ZY22G728HN 1080x2400
          (resource-id `expo-router-unmatched`, logcat `nested children
          [index, simulador-carrera]` — `simulador-carrera/identity` no
          matchea). PR-295 original (c15dc43) + MGC-1147 (f689b9b)
          intentaron fix via root registration + wrapper fuera de `app/`
          pero el child fantasma del Stack.Screen con nested path sigue
          sin resolver. File-based route es el patrón probado en MGC-919
          PASS (build-MGC-919-1-8eb411b.apk).
        */}
        <Stack.Screen name="simulador-carrera" />
      </Stack>
      {/*
        MGC-394 — SiteFooter global removido. El footer exponía enlaces
        a GitHub/Terms/Privacidad/Contacto que contaminaban visualmente
        la pantalla principal. Si en el futuro se necesita restaurar
        (ej. ajustes/about), reintroducir como conditional dentro de cada
        screen para preservar el principio de "pantalla principal limpia".
      */}
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
  hydrationGate: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
