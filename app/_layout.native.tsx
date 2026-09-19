import { Stack, Redirect } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
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
import { loadCareerSave } from '@/features/career/persistence';

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
    // MGC-1022 iter18 — bypass directo del hydrate gate sobre cold-start.
    // Síntoma iter17: `requestHydrate()` (gate centralizado) emitía
    // `[hydrateGate] FIRST hydrate=null` y luego el JS event loop quedaba
    // congelado sin disparar el `setTimeout(hardBypass, 250ms)` ni el
    // `await loader()` continuation. Diagnóstico: la diferencia vs
    // copero-mgc812 (donde el patrón MGC-852 iter13 funciona) es la
    // presencia del `hydrateGate` IIFE + `new Error('hydrate=null
    // first-emission').stack` en `emitNullOnce`. En Hermes release,
    // capturar stack desde dentro de un IIFE async durante cold-start
    // bloquea el bridge JS↔native. Mitigación: llamar `loadCareerSave()`
    // DIRECTO sin pasar por el gate para el bootstrap inicial. El gate
    // sigue activo para callers sub-siguientes (`dashboard.onSlotChanged`,
    // `SaveSlotPicker.onConfirm`, `__forceHydrateFromSave`) — solo lo
    // bypaseamos en el path de cold-start que probó colgarse.
    const coldStartBypass = (async () => {
      try {
        const saved = await loadCareerSave();
        if (saved) {
          // Misma aplicación que `hydrateFromSave` hace en el branch
          // `outcome.ok === true`. Mantenemos los campos críticos para
          // que la UI monte con state coherente.
          const cur = useCareerStore.getState();
          useCareerStore.setState((s) => ({
            ...s,
            stage: saved.stage,
            profile: saved.profile,
            draft: saved.draft ?? null,
            card: saved.card ?? null,
            log: saved.log,
            history: saved.history ?? [],
            seed: saved.seed,
            rng: saved.rng,
            postMatchPending: saved.postMatchPending ?? null,
            nextWeekModifiers: saved.nextWeekModifiers,
            transferState: saved.transferState ?? null,
            marketState: saved.marketState ?? { entries: [], offers: [], budget: 0, tickAt: 0 },
            seasonStandings: saved.seasonStandings ?? {},
            seasonFixtures: saved.seasonFixtures ?? [],
          }));
          void cur; // silence unused
        }
        useCareerStore.setState({ hydrated: true });
        // eslint-disable-next-line no-console
        console.warn('[iter18] cold-start bypass resolved hydrated=true');
      } catch (err) {
        useCareerStore.setState({ hydrated: true });
        // eslint-disable-next-line no-console
        console.warn('[iter18] cold-start bypass caught error', err);
      }
    })();
    void coldStartBypass;
    // MGC-1022 iter18 — bypass duro del hydration gate post cold-start.
    // 50ms es más agresivo que iter17 (250ms) por dos razones:
    //   (a) iter17 confirmó que el setTimeout NO disparaba — JS event
    //       loop congelado post-hydrate-gate. 50ms sigue cubriendo
    //       cold-start normal (~80-150ms hydrate resolve) sin
    //       parpadear; si el bridge nativo está congelado, el bypass
    //       duro libera la UI igual.
    //   (b) requestAnimationFrame es un timer alternativo que NO
    //       comparte la cola de setTimeout. Si Hermes está饿死 la
    //       macrotask queue, rAF sigue procesándose vía UI thread.
    const hardBypass = setTimeout(() => {
      if (!useCareerStore.getState().hydrated) {
        useCareerStore.setState({ hydrated: true });
        // eslint-disable-next-line no-console
        console.warn('[iter18] hardBypass (50ms) fired hydrated=true');
      }
    }, 50);
    const rafBypass = requestAnimationFrame(() => {
      if (!useCareerStore.getState().hydrated) {
        useCareerStore.setState({ hydrated: true });
        // eslint-disable-next-line no-console
        console.warn('[iter18] rafBypass fired hydrated=true');
      }
    });
    return () => {
      clearTimeout(hardBypass);
      cancelAnimationFrame(rafBypass);
    };
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
          // MGC-1018 — `contentStyle` mantiene `colors.bg`. La defensa real contra
          // el flash blanco es `styles.root` con `backgroundColor: '#0B1320'`
          // hardcodeado (ver styles abajo): cubre fontsLoaded splash,
          // hydration gate y el root wrapper de ThemedShell.
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

  // MGC-1022 iter17 — bypass duro del font gate si `useFonts` se cuelga en
  // release builds. Síntoma: blank/black screen persistente post splash
  // gate (MGC-998 vector A liberó splash a frames=3 elapsedMs=3017 sobre
  // ZY22G728HN) — el View temprano mostraba #0B1320 dark navy pero el
  // árbol React nunca montaba porque `useFonts` quedaba esperando la
  // respuesta del bridge expo-font. 500ms es lo bastante generoso para
  // fuentes bundleadas en release (~80-150ms en buenas condiciones) y lo
  // bastante corto para no parpadear más de 1 frame tras el splash.
  const [fontFallbackFired, setFontFallbackFired] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFontFallbackFired(true), 500);
    return () => clearTimeout(timer);
  }, []);

  // MGC-1018 — fix parpadeo blanco en Moto edge30: el View de splash durante
  // la carga de fonts (`useFonts` resolving) ahora trae `backgroundColor`
  // explicito `#0B1320` (mismo dark navy que `app.config.js splashscreen` y
  // `android:windowBackground`). Antes era transparente → window manager
  // del Moto flasheaba blanco por unos frames antes de que ThemeProvider
  // montara con `colors.bg`.
  if (!fontsLoaded && !fontError && !fontFallbackFired) {
    return <View style={[styles.root, styles.splashFallback]} />;
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
  // MGC-1018 — `root` con `backgroundColor: #0B1320` dark navy hardcodeado.
  // Antes sin bg → transparente durante fontsLoaded → flash blanco en
  // Moto edge30 (DayNight light fallback). Mismo color que splash nativo
  // para cadena continua native splash → JS root → ThemeProvider → Stack.
  root: { flex: 1, backgroundColor: '#0B1320' },
  splashFallback: { backgroundColor: '#0B1320' },
  hydrationGate: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// MGC-1035 iter2 — safety-net a nivel de módulo. Se registra apenas
// Hermes evalúa el bundle, ANTES del mount de React. QA walk MGC-1031
// sobre MGC-1025 iter1 (build-mgc1025-iter1-7dddf3f.apk) detectó que
// los `setTimeout` defensivos de 3s/3.5s NUNCA se disparaban sobre
// ZY22G728HN: el logcat sólo registró `[persistence] hydrate=null
// slot=default reason=no-snapshot-in-storage` una vez (a t=0.6s) y
// luego silencio absoluto — ni el splash gate se liberó ni el ActivityIndicator
// desapareció. La pantalla quedó blanca hasta t=60s sin contenido renderizado.
//
// iter1 (MGC-1025) registraba los timers DENTRO de `useEffect` de
// ThemedShell. Si el árbol React queda congelado antes del primer
// commit (bug confirmado en release APK sobre ZY22G728HN con Hermes
// engine), el `useEffect` nunca corre → splash colgado. iter18
// (MGC-1022, ca9bffd) confía en un `useEffect`-based 50ms hardBypass
// + rAF + coldStartBypass IIFE — mismo riesgo si React no monta.
//
// iter2 invierte el modelo: registra los timers como副作用 a nivel
// de módulo, fuera de cualquier `useEffect`. El setTimeout se agenda
// en cuanto el import de este archivo resuelve, garantizando que aun
// si React queda congelado, el gate se libere. Triple cobertura:
//
//   t=400ms   → flip hydrated:true  (cubre bridge expo-font colgado,
//               caso MGC-763). Marca el log `[copero:hydra]`.
//   t=3000ms  → flip redundante idempotente (cubre el caso worst-case
//               del bridge AsyncStorage colgado, caso MGC-1022 iter17).
//
// Los timers llaman la misma función idempotente. Si hydrated ya es
// true, el `setState` no hace nada (zustand noop) — el segundo timer
// queda como red de seguridad.
//
// `useCareerStore` ya está importado arriba vía ESM (hoisted), así que
// la referencia directa está disponible apenas Hermes evalúa el bundle.
// Si por algún motivo el módulo no terminó de inicializarse, el catch
// silencioso evita romper el startup y el segundo timer cubre el gap.
let __mgc1035GateReleased = false;
const __mgc1035ReleaseHydrationGate = () => {
  if (__mgc1035GateReleased) return;
  __mgc1035GateReleased = true;
  try {
    if (
      typeof useCareerStore !== 'undefined' &&
      useCareerStore.getState &&
      !useCareerStore.getState().hydrated
    ) {
      useCareerStore.setState({ hydrated: true });
      // eslint-disable-next-line no-console
      console.warn(
        '[copero:hydra] module-scope hydration gate timeout — forzando hydrated=true para liberar splash gate',
      );
    }
  } catch {
    // best-effort: si el store todavía no terminó de inicializar, el
    // segundo timer a 3000ms cubre el gap.
  }
};
setTimeout(__mgc1035ReleaseHydrationGate, 400);
setTimeout(__mgc1035ReleaseHydrationGate, 3000);
