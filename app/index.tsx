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

/**
 * Home — splash minimal (MGC-394).
 *
 * Limpieza de la pantalla principal: solo splash con título/descripción +
 * botón "Jugar" → /simulador-carrera/identity. Si hay carrera persistida
 * muestra un botón secundario "Continuar carrera" que respeta el `stage`.
 *
 * Eliminado en este pase:
 * - Form de identidad (HomepageCareerStarter lazy) — el form vive ahora
 *   en /simulador-carrera/identity.
 * - Hero card premium con camiseta + OVR + mini-stats.
 * - Cómo se juega / Comparador Classic-Purist / FAQ (lazy sections).
 * - SiteFooter global con links GitHub/Terms/Privacidad/Contacto (se quitó
 *   del root layout para no contaminar la pantalla principal).
 *
 * Accesibilidad:
 * - h1 con accessibilityRole="header".
 * - Botones con accessibilityHint explícito.
 * - WCAG AA sobre `colors.primary` (texto blanco).
 * - ScrollView envuelve para soportar pantallas chicas (SafeArea + teclado).
 */

// MGC-251 — Mapa stage → ruta. Se conserva para el CTA "Continuar carrera"
// que sigue siendo útil cuando hay sesión persistida (MGC-394 no elimina
// este flujo, sólo limpia la composición visual del home).
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

  // MGC-394: el splash ocupa el viewport visible. Cap por aspect ratio
  // para que en tablets/landscape no quede una franja gigante de imagen;
  // piso mínimo 240 px garantiza legibilidad del título en 320x568.
  // MGC-425 fix: en mobile angosto (≤600 dp en su lado menor) bajamos el
  // cap a 300 para que el botón Jugar quede más arriba en pantallas
  // 1080x2400 (ZY22G728HN). MGC-453 fix: el cap previo de 360 dejaba el
  // btn en y≈1100 y el usuario seguía tapeando cerca del ad-banner; el
  // nuevo cap de 300 + hitSlop bottom=100 en el btn garantiza que un tap
  // intencional sobre el btn (o su hit-area extendida) registre el Pressable
  // sin caer en el gap inferior. Detección compact usa Math.min(width,height)
  // para cubrir portrait y landscape; antes usaba sólo width y el dispositivo
  // 1080x2400 (432 dp) quedaba correctamente compacto pero la altura del
  // splash seguía alta por la combinación ratio 0.48 + cap 360.
  const splashHeight = useMemo(() => {
    const shortestSide = Math.min(viewportWidth, viewportHeight);
    const isCompact = shortestSide < 600;
    const ratio = isCompact ? 0.42 : 0.62;
    const cap = isCompact ? 300 : 560;
    const capped = Math.min(Math.max(viewportHeight * ratio, 240), cap);
    return Math.round(capped);
  }, [viewportHeight, viewportWidth]);

  // MGC-394: la imagen de referencia usa `assets/splash.png` bundleado en
  // Expo. Si require falla (web sin bundle), fallback a superficie accentDeep
  // para mantener contraste WCAG AA del título blanco.
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
            MGC-394: el botón reemplaza al legacy `btn-career` del form
            HomepageCareerStarter (MGC-718). Conservamos el testID legacy
            para que los e2e (home.spec, mgc-317-qa, mgc-462-contrast)
            sigan funcionando sin tocarlos. Label visible = "Jugar";
            accessibilityLabel = "Iniciar carrera" para usuarios de
            TalkBack/VoiceOver.
            MGC-425: `hitSlop` extiende el área tocable más allá de los
            bounds visuales para que un tap descentrado por 1-2 cm (típico
            en thumb-reach en pantallas 1080x2400) siga registrando el
            Pressable en lugar de caer en el gap inferior hacia el
            ad-banner.
            MGC-453: hitSlop de 16 px en cada lado era insuficiente — el gap
            entre el borde inferior real del btn y el tap histórico era de
            84 px en ZY22G728HN. Aumentamos bottom a 100 para garantizar
            captura incluso cuando el usuario tapea entre el btn y el
            ad-banner (lugar intuitivo si la splash quedó alta). top/left/right
            se mantienen en 16 para no invadir UI adyacente. */}
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

        {/* ── Pie minimal: sólo copyright. Sin links externos. ───────
            MGC-394: el SiteFooter con GitHub/Terms/Privacidad/Contacto
            se quitó del root layout; este pie minimal mantiene el crédito
            del proyecto sin distraer del splash. */}
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
