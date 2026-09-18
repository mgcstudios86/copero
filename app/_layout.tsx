import { Stack, Redirect } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppState, Platform, View, StyleSheet, ActivityIndicator } from 'react-native';
import { useEffect, useRef, useState } from 'react';
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
import { loadOnboardedFlag } from '@/i18n/onboarding-flag';
// MGC-363 — el listener de `AppState` se mudó a `careerStore.ts`.
// `bootstrapPersistence()` se llama una vez al montar el root layout
// y registra el listener a nivel módulo + sincroniza `lastSnapshot`
// con cada mutación del store. Antes el listener vivía en este layout
// (atado al ciclo de vida del componente ThemedShell) y desaparecía
// en HMR o antes del mount — el OS mandaba la app a background antes
// de que React registrara el useEffect, perdiendo la save.
// MGC-394 — `SiteFooter` removido del root layout para limpiar la pantalla principal.
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

  // MGC-227 + MGC-306 AC4: bootstrap de persistencia. Llamamos
  // `hydrateFromSave()` una sola vez al montar el root layout y
  // BLOQUEAMOS el render del Stack hasta que `hydrated === true`.
  // Antes era fire-and-forget: el home pintaba con initialSnapshot
  // (form vacío, sin CTA Continuar) y luego re-renderizaba cuando
  // llegaba el save. El flash intermedio es lo que QA reprodujo en
  // ZY22G728HN tras `am force-stop` + relaunch — `careerStage='identity'`
  // y `careerProfileName=''` durante ~50–200 ms hasta que el gate
  // hidrataba. Ahora mostramos un splash neutro con el `colors.bg`
  // hasta que `hydrateFromSave` resuelva (éxito, vacío o error —
  // el flag se flippea en los tres paths).
  const hydrated = useCareerStore((s) => s.hydrated);
  useEffect(() => {
    bootstrapPersistence();
    void useCareerStore.getState().hydrateFromSave();
  }, []);

  // MGC-257 — al ir a background (app switcher, lockscreen, force-stop
  // inminente), drenamos la save en curso contra AsyncStorage. Antes
  // el `persistSnapshot` era fire-and-forget y un force-stop inmediato
  // podía perder el snapshot. AC7: carrera persistida resiste kill.
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      // Solo drenamos al pasar de activo/foreground a background/inactive.
      // `active` repetido o transiciones foreground->foreground son no-op.
      if (
        (prev === 'active' || prev === 'unknown') &&
        (next === 'background' || next === 'inactive')
      ) {
        void flushPendingSave();
      }
    });
    return () => sub.remove();
  }, []);

  // MGC-491 + MGC-555 — gate de primer launch (idioma). 3 ramas explícitas:
  //   hydrating → splash neutro (sin Stack, sin SiteHeader)
  //   hydrated && !onboarded → redirect a /onboarding/language
  //   hydrated && onboarded → main con SiteHeader + Stack normal
  // Antes del PR el root layout solo esperaba la hidratación del career
  // store y `loadOnboardedFlag()` NUNCA se leía — un usuario nuevo caía
  // directo en la home con `colors.bg` negro y sin SiteHeader de chrome
  // (el branch `!onboarded ⇒ onboarding/language` no existía). El screen
  // `/onboarding/language` quedaba inaccesible desde el primer launch.
  // El flag se flippea a `ready` en éxito, vacío (false) y error
  // (best-effort: nunca dejamos la UI bloqueada en splash).
  const [onboardedState, setOnboardedState] = useState<
    'hydrating' | 'needs-onboarding' | 'ready'
  >('hydrating');
  useEffect(() => {
    void loadOnboardedFlag()
      .then((onboarded) => {
        setOnboardedState(onboarded ? 'ready' : 'needs-onboarding');
      })
      .catch(() => {
        // best-effort: si AsyncStorage falla, dejamos pasar a main para
        // no bloquear la UI forever. El usuario verá el LanguageSwitcher
        // en el SiteHeader y podrá cambiar el locale manualmente.
        setOnboardedState('ready');
      });
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

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar style={mode === 'dark' || mode === 'copero' ? 'light' : 'dark'} />
      {/*
        MGC-491 + MGC-555 — gate first-launch en 3 ramas:
        1. hydrating (career store o flag onboarded pendiente) →
           splash neutro con `colors.bg` y ActivityIndicator.
        2. !hydrated es el flash histórico que QA reprodujo tras
           `am force-stop` + relaunch con `careerStage='identity'`
           durante 50–200 ms (MGC-306 AC4).
        3. hydrated && !onboarded → redirect a /onboarding/language.
        4. hydrated && onboarded → main con SiteHeader + Stack.
      */}
      {!hydrated || onboardedState === 'hydrating' ? (
        <View
          style={[styles.root, styles.hydrationGate, { backgroundColor: colors.bg }]}
          testID="career-hydrate-gate"
          accessibilityLabel="Cargando carrera guardada"
        >
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : onboardedState === 'needs-onboarding' ? (
        // MGC-491 — primer launch: el usuario todavía no pasó por el
        // selector de idioma. Lo mandamos a `/onboarding/language`,
        // que monta un Stack mínimo sin SiteHeader y llama
        // `markOnboarded()` al confirmar.
        <Redirect href="/onboarding/language" />
      ) : (
        <>
      {/* MGC-653 — SiteHeader global con 7 nav links + LanguageSwitcher +
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
        {/* MGC-534 — `initialRouteName="index"` simétrico a las variantes
            `.native.tsx` / `.web.tsx`; mantiene coherencia entre bundles. */}
        <Stack.Screen name="index" />
        {/*
          MGC-42.C — Rutas del juego de palabras / quiz Ideología Futbolística
          removidas del root layout. Categoría/ronda/fin/compass montaban el
          motor legacy (`@/features/game/screens/*`), fuera del simulador de
          carrera. Auditoría UX MGC-44 las marcó como dead routes; las entry
          points canónicas son las pantallas del simulador (`/simulador-carrera/...`).
          Los file-based wrappers `app/simulador-carrera/{categoria,ronda,fin,compass}.tsx`
          quedan como Redirect al index del simulador para preservar deep links
          históricos sin mostrar el quiz legacy.
        */}
        {/*
          MGC-1160 — ver comentario paralelo en `_layout.native.tsx`.
          `simulador-carrera/identity` resuelve via file-based route,
          NO via root Stack.Screen (provoca Unmatched Route, MGC-1158).
        */}
        <Stack.Screen name="simulador-carrera" />
        {/*
          MGC-1506 — `/settings` modal global accesible desde el link
          ⚙️ del SiteHeader. `presentation: 'modal'` evita que se
          renderice dentro del flow del simulador; permite swipe-down
          en iOS y back nativo en Android para volver al contexto previo
          (home o pantalla de carrera).
        */}
        <Stack.Screen
          name="settings"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
      {/*
        MGC-394 — SiteFooter global removido. El footer exponía enlaces
        a GitHub/Terms/Privacidad/Contacto que contaminaban visualmente
        la pantalla principal. Si en el futuro se necesita restaurar
        (ej. ajustes/about), reintroducir como conditional dentro de cada
        screen para preservar el principio de "pantalla principal limpia".
      */}
      <Banner />
        </>
      )}
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
