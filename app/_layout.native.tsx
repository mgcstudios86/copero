import { Stack, Redirect } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { AppState, Platform, View, StyleSheet, ActivityIndicator } from 'react-native';
import { useEffect, useRef, useState } from 'react';
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
import { loadOnboardedFlag } from '@/i18n/onboarding-flag';
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

  // MGC-491 + MGC-555 — gate de primer launch (idioma). 3 ramas:
  //   hydrating → splash neutro sin Stack ni SiteHeader
  //   hydrated && !onboarded → redirect a /onboarding/language
  //   hydrated && onboarded → main con SiteHeader + Stack normal
  // Antes del PR el root layout solo esperaba la hidratación del career
  // store y `loadOnboardedFlag()` NUNCA se leía en builds nativos — un
  // usuario nuevo caía directo en la home sin pasar por el selector de
  // idioma. Best-effort: en error dejamos pasar a main.
  const [onboardedState, setOnboardedState] = useState<
    'hydrating' | 'needs-onboarding' | 'ready'
  >('hydrating');
  useEffect(() => {
    void loadOnboardedFlag()
      .then((onboarded) => {
        setOnboardedState(onboarded ? 'ready' : 'needs-onboarding');
      })
      .catch(() => {
        setOnboardedState('ready');
      });
  }, []);

  if (!hydrated || onboardedState === 'hydrating') {
    return (
      <View style={[styles.root, styles.hydrationGate, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (onboardedState === 'needs-onboarding') {
    // MGC-491 — primer launch: redirect a `/onboarding/language` que monta
    // un Stack mínimo sin SiteHeader y llama `markOnboarded()` al confirmar.
    return <Redirect href="/onboarding/language" />;
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
        {/* MGC-42.C — Rutas del juego de palabras removidas. Ver comentario
            paralelo en app/_layout.tsx. Las screens de `features/game/*` ya
            no son alcanzables desde el root layout nativo. */}
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

  // MGC-763 — root-cause del white-screen permanente en release APK sobre
  // ZY22G728HN. PR #692 + MGC-724 atajaron el síntoma (throttle logs +
  // setTimeout 5s en ThemedShell) pero el render seguía congelado desde
  // el primer frame post-splash, lo que demuestra que el `useEffect` con
  // el setTimeout del MGC-724 nunca corrió: `ThemedShell` nunca montó
  // porque `RootLayout` esperaba `useFonts()` antes de ceder. Si el
  // bridge de expo-font se atasca en release (común cuando el bundle de
  // TTFs de `@expo-google-fonts/*` falla el autolinking o el asset
  // bundling pierde el `dist/assets/<hash>.ttf`), `useFonts` queda
  // esperando indefinidamente, el `<View style={styles.root} />` early
  // return es transparente (sin backgroundColor) y queda expuesto el
  // splash de expo-splash-screen — que como nadie llama
  // `SplashScreen.hideAsync()` (solo se llama automáticamente en dev),
  // pinta blanco permanente sobre cualquier APK no-dev.
  //
  // Fix: (a) timeout 5s sobre fontsLoaded/fontError para no bloquear el
  // árbol React cuando el bridge no responde — fallback a system fonts;
  // (b) `SplashScreen.hideAsync()` explícito al desmontar el gate nativo
  // para destrabar el splash aunque fuentes no carguen; (c)
  // backgroundColor explícito en el View early-return para que si
  // splash hide falla el surface matchee el tema copero y no quede un
  // hueco blanco.
  const [fontFallbackFired, setFontFallbackFired] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFontFallbackFired(true), 5000);
    return () => clearTimeout(timer);
  }, []);
  const splashHiddenRef = useRef(false);
  useEffect(() => {
    if (!(fontsLoaded || fontError || fontFallbackFired)) return;
    if (splashHiddenRef.current) return;
    splashHiddenRef.current = true;
    void SplashScreen.hideAsync().catch(() => {
      // best-effort: si el módulo nativo no está disponible (web/jest)
      // no bloqueamos el render
    });
  }, [fontsLoaded, fontError, fontFallbackFired]);

  if (!fontsLoaded && !fontError && !fontFallbackFired) {
    return (
      <View
        style={[styles.root, { backgroundColor: SPLASH_FALLBACK_BG }]}
      />
    );
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

// MGC-763 — color de fondo del early-return antes de que `useTheme()`
// esté disponible. Matchea `app.json#expo.plugins.expo-splash-screen.backgroundColor`
// (#0B1320) para que si el splash se atrasa en ocultarse, la transición
// splash→app sea visualmente continua y no haya flash blanco.
const SPLASH_FALLBACK_BG = '#0B1320';

const styles = StyleSheet.create({
  root: { flex: 1 },
  hydrationGate: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
