/**
 * MGC-1397 — Restaurar home-screen visible con botón "Jugar".
 *
 * Contexto: el PR #302 (MGC-1188) reemplazó esta ruta por un `<Redirect>`
 * invisible para acortar el cold-start nativo. Eso rompió el AC7.1 del
 * smoke Maestro (.maestro/ac7-force-stop.yaml) que afirma `text: "Jugar"`
 * en la home tras `pm clear`. La decisión CTO original ("marketing no es
 * gameplay") se revisó en MGC-1391: la home cumple un rol funcional como
 * punto de entrada del simulador (especialmente sin carrera persistida)
 * y el CTA "Jugar" es el contrato observable de AC7.1.
 *
 * Fix: restauramos la pantalla visible (hero + título + descripción + CTA
 * "Jugar" + CTA secundario "Continuar carrera" si hay sesión). El
 * dispatcher puro se conserva en `_layout.native.tsx` mediante el gate
 * `hydrated`, que sigue bloqueando el render del Stack hasta que
 * `hydrateFromSave()` resuelva — esto garantiza que el botón "Continuar
 * carrera" no aparezca parpadeando con stage stale.
 *
 * Comportamiento por escenario:
 *   1. `pm clear` + cold-start (sin carrera): home muestra solo "Jugar".
 *      Tap → /simulador-carrera/identity (pantalla 1/6 del flow MGC-209).
 *   2. Cold-start con carrera persistida: home muestra "Continuar carrera"
 *      (label dependiente del stage) + "Jugar" (nueva carrera). Tap
 *      "Continuar" → resumeRouteForStage(stage); tap "Jugar" → identity.
 *   3. Web bundle (Expo export): misma UI. Las specs e2e que asumían
 *      dispatcher invisible (MGC-1188) fueron reescritas en este mismo
 *      pase — ver `e2e/home.spec.ts` y demás.
 *
 * Compatibilidad preservada:
 *   - `_layout.tsx` / `_layout.native.tsx` / `_layout.web.tsx`:
 *     `initialRouteName="index"` y gate `hydrated` intactos (MGC-722).
 *   - `simulador-carrera/index.tsx`: sigue siendo red de seguridad para
 *     `router.push('/simulador-carrera')` sin stage (MGC-841).
 *   - Splash nativo Expo (`app.json`): sólo aplica al cold-start nativo
 *     antes del primer render JS; comportamiento del OS, sin cambios.
 *   - testIDs restaurados: `home-screen` (ScrollView), `btn-career`
 *     (CTA primario "Jugar"), `btn-home-resume-career` (CTA secundario
 *     "Continuar carrera"). Mismas refs que existían pre-MGC-1188.
 *
 * Accesibilidad:
 *   - h1 con accessibilityRole="header".
 *   - Botones con accessibilityHint explícito.
 *   - WCAG AA sobre `colors.primary` (texto blanco).
 *   - ScrollView envuelve para soportar pantallas chicas (SafeArea + teclado).
 */
import React, { useMemo } from 'react';
import {
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { CareerStage } from '@/types/career';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { useCareerStore } from '@/shared/store/careerStore';

// Mapa stage → ruta de resume (MGC-251). Se conserva tal cual para el CTA
// "Continuar carrera" cuando hay sesión persistida.
function resumeRouteForStage(stage: CareerStage): string {
  switch (stage) {
    case 'identity':
      return '/simulador-carrera/identity';
    case 'dashboard':
    case 'academy':
    case 'clubStart':
      return '/simulador-carrera/dashboard';
    case 'draft':
      return '/simulador-carrera/draft';
    case 'club':
      return '/simulador-carrera/tu-jugador';
    case 'season':
      return '/simulador-carrera/temporada';
    case 'retirement':
      return '/simulador-carrera/fin-carrera';
    default:
      return '/simulador-carrera/dashboard';
  }
}

function resumeLabelForStage(stage: CareerStage): string {
  switch (stage) {
    case 'draft':
      return 'Continuar draft';
    case 'club':
      return 'Elegir club de origen';
    case 'season':
      return 'Retomar temporada';
    case 'retirement':
      return 'Ver fin de carrera';
    default:
      return 'Continuar carrera';
  }
}

export default function Home() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight, fontFamily, lineHeight } = useTheme();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const careerStage = useCareerStore((s) => s.stage);
  const careerProfileName = useCareerStore((s) => s.profile.name);
  const hasCareer = careerStage !== 'identity' && careerProfileName.length > 0;

  const goPlay = () => router.push('/simulador-carrera/identity');
  const goResume = () => router.push(resumeRouteForStage(careerStage));

  // MGC-1397: el splash ocupa el viewport visible. Mismo cap que pre-MGC-1188
  // (300dp compact / 560dp ancho) para que el botón Jugar quede arriba en
  // pantallas 1080x2400 (ZY22G728HN). Detección compact usa Math.min(w,h)
  // para cubrir portrait y landscape.
  const splashHeight = useMemo(() => {
    const shortestSide = Math.min(viewportWidth, viewportHeight);
    const isCompact = shortestSide < 600;
    const ratio = isCompact ? 0.42 : 0.62;
    const cap = isCompact ? 300 : 560;
    const capped = Math.min(Math.max(viewportHeight * ratio, 240), cap);
    return Math.round(capped);
  }, [viewportHeight, viewportWidth]);

  // Imagen de referencia bundleada en Expo. Si require falla (web sin
  // bundle), fallback a superficie accentDeep para mantener contraste WCAG
  // AA del título blanco.
  const splashSource = useMemo(() => {
    try {
      // require lazy para no romper SSR / web bundle si la imagen no existe.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('../../assets/splash.png');
    } catch {
      return null;
    }
  }, []);

  const titleSize = viewportWidth < 600 ? fontSize['2xl'] : fontSize['3xl'];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={[styles.container, { gap: spacing[5] }]}
        testID="home-screen"
      >
        {/* ── Splash hero ──────────────────────────────────────────── */}
        <View
          testID="home-splash"
          style={{
            height: splashHeight,
            borderRadius: radii.xl,
            overflow: 'hidden',
            backgroundColor: colors.accentDeep,
            borderWidth: 1,
            borderColor: colors.border,
            alignSelf: 'stretch',
          }}
          accessibilityRole="header"
          accessibilityLabel="Splash del simulador de carrera Copero"
        >
          {splashSource ? (
            <ImageBackground
              source={splashSource}
              resizeMode="cover"
              style={StyleSheet.absoluteFill}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              <View
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(126, 34, 206, 0.55)',
                  paddingHorizontal: spacing[5],
                  paddingVertical: spacing[6],
                  justifyContent: 'flex-end',
                  gap: spacing[3],
                }}
              >
                <SplashCopy
                  titleSize={titleSize}
                  fontFamily={fontFamily}
                  fontSize={fontSize}
                  fontWeight={fontWeight}
                  lineHeight={lineHeight}
                  textOnAccent={colors.textOnAccent}
                />
              </View>
            </ImageBackground>
          ) : (
            <View
              style={{
                flex: 1,
                backgroundColor: colors.accentDeep,
                paddingHorizontal: spacing[5],
                paddingVertical: spacing[6],
                justifyContent: 'flex-end',
                gap: spacing[3],
              }}
            >
              <SplashCopy
                titleSize={titleSize}
                fontFamily={fontFamily}
                fontSize={fontSize}
                fontWeight={fontWeight}
                lineHeight={lineHeight}
                textOnAccent={colors.textOnAccent}
              />
            </View>
          )}
        </View>

        {/* ── CTA Jugar (primario) ──────────────────────────────────
            AC7.1 (.maestro/ac7-force-stop.yaml): assertVisible text:"Jugar"
            → tapOn text:"Jugar" navega a /simulador-carrera/identity. */}
        <Button
          label="Jugar"
          onPress={goPlay}
          variant="primary"
          size="lg"
          fullWidth
          testID="btn-career"
          accessibilityLabel="Iniciar carrera"
          accessibilityHint="Abre el formulario de identidad para empezar una nueva carrera"
          hitSlop={{ top: 16, bottom: 100, left: 16, right: 16 }}
        />

        {/* ── CTA secundario: Continuar carrera si hay sesión ──────── */}
        {hasCareer ? (
          <Button
            label={resumeLabelForStage(careerStage)}
            onPress={goResume}
            variant="ghost"
            size="md"
            fullWidth
            testID="btn-home-resume-career"
            accessibilityLabel={`Continuar carrera de ${careerProfileName} en etapa ${careerStage}`}
            accessibilityHint="Restaura la sesión guardada y reanuda el loop de carrera"
          />
        ) : null}

        {/* ── Pie minimal: sólo copyright. Sin links externos. ─────── */}
        <Text
          accessibilityRole="text"
          style={{
            color: colors.textMuted,
            fontSize: fontSize.xs,
            textAlign: 'center',
            letterSpacing: 1,
            marginTop: spacing[4],
            fontFamily: fontFamily.body,
          }}
        >
          © {new Date().getFullYear()} Copero · Proyecto independiente
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SplashCopy({
  titleSize,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  textOnAccent,
}: {
  titleSize: number;
  fontFamily: ReturnType<typeof useTheme>['fontFamily'];
  fontSize: ReturnType<typeof useTheme>['fontSize'];
  fontWeight: ReturnType<typeof useTheme>['fontWeight'];
  lineHeight: ReturnType<typeof useTheme>['lineHeight'];
  textOnAccent: string;
}) {
  return (
    <>
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={{
          color: textOnAccent,
          letterSpacing: 4,
          fontSize: fontSize.sm,
          fontWeight: fontWeight.bold,
        }}
      >
        COPERO · SIMULADOR DE CARRERA
      </Text>
      <Text
        accessibilityRole="header"
        numberOfLines={2}
        style={{
          color: textOnAccent,
          fontSize: titleSize,
          fontFamily: fontFamily.display,
          fontWeight: fontWeight.bold,
          lineHeight: titleSize * lineHeight.tight,
          letterSpacing: -0.5,
        }}
      >
        Convertite en leyenda
      </Text>
      <Text
        style={{
          color: textOnAccent,
          fontSize: fontSize.base,
          lineHeight: fontSize.base * lineHeight.base,
        }}
      >
        Tomá decisiones, asumí consecuencias y construí tu carrera futbolística paso a paso.
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: 16, flexGrow: 1 },
});
