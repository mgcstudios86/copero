import React, { Suspense, lazy } from 'react';
import {
  AccessibilityInfo,
  Platform,
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
// MGC-782: stats del juego vienen del store persistente sin engine. Antes
// `useGameStore` arrastraba el FSM al entry chunk del home (~25-40 KB gz).
import { useGameStatsStore } from '@/shared/store/gameStatsStore';
import { useCareerStore } from '@/shared/store/careerStore';
import { useDraftModeStore } from '@/shared/store/draftModeStore';
import { NATIONALITIES_BY_CODE } from '@/features/career/nationalities';
// MGC-718: wire-up del form de identidad. PR #93 (MGC-655 SHA a6579a5) portó
// el componente pero nunca integró el render en este archivo. Reemplaza el
// Button legacy por el form kiya0908 con FIFA nationalities y draft modes.
// MGC-768: lazy() para sacar del entry chunk el catálogo `NATIONALITIES_FIFA`
// (~12 KB raw, 193 países) + `POSITIONS` + `useCareerStore` que
// HomepageCareerStarter importa estáticamente. El user sólo interactúa con
// el form al scrollear, no en el primer paint.
const HomepageCareerStarter = lazy(() =>
  import('@/components/home/HomepageCareerStarter').then((m) => ({
    default: m.HomepageCareerStarter,
  })),
);

// Lazy-load JerseyPreview para mantener el chunk inicial del home liviano
// (MGC-505: el hero premium se renderiza, pero el SVG patterns sólo cuando
// el browser lo solicita). Fallback con dimensiones fijas evita CLS.
const JerseyPreview = lazy(() =>
  import('@/design/components/JerseyPreview').then((m) => ({ default: m.JerseyPreview })),
);

// MGC-782: tres secciones del fold (cómo se juega, comparador, FAQ) viven
// ahora en archivos separados y se cargan como chunks asincrónicos. Estiman
// -15 a -30 KB gz del entry chunk cada uno. Fallback null: como están
// debajo del fold, el Suspense vacío no genera CLS perceptible — el
// viewport ya pintó el hero antes de que el usuario llegue a scroll.
const HowToPlaySteps = lazy(() =>
  import('@/components/home/HowToPlaySteps').then((m) => ({
    default: m.HowToPlaySteps,
  })),
);
const ComparadorClassicPurist = lazy(() =>
  import('@/components/home/ComparadorClassicPurist').then((m) => ({
    default: m.ComparadorClassicPurist,
  })),
);
const FAQList = lazy(() =>
  import('@/components/home/FAQList').then((m) => ({
    default: m.FAQList,
  })),
);

/**
 * Home — landing único del simulador "Convertite en Leyenda" (MGC-505).
 *
 * Iteración kiya0908/copero (HomepageCareerStarter + IntroPhase):
 * - Premium visual card con camiseta grande + OVR (estilo Career Result Card).
 * - Sección "Cómo se juega" con 4 pasos numerados (1–4) al estilo
 *   `intro.how.steps` del repo de referencia (MGC-658: 3 → 4).
 * - Comparador Classic vs Purist (MGC-658): bloque descriptivo, no
 *   interactivo. La elección real del modo vive en
 *   /simulador-carrera/identity (decisión MGC-646 §3.3 Opción B).
 * - FAQ con 6 items (MGC-658: +2 sobre `internet` y `costo`).
 * - Mantiene: solo Convertite en Leyenda visible (sin CTAs de otros juegos),
 *   deep-links preservados, WCAG AA, contraste sobre `colors.primary`.
 *
 * Accesibilidad:
 * - `accessibilityRole="header"` en banner h1, section h2, step h3.
 * - `accessibilityLabel` descriptivo en cada stat, step, compare-card y FAQ item.
 * - WCAG AA target ≥ 4.5:1 sobre `colors.surface` y `colors.bg`.
 */
// MGC-251 — Mapa stage → ruta. Cuando hay carrera persistida y el usuario
// pulsa "Continuar carrera" en el home, debe retomar en la pantalla
// correspondiente a su `stage` actual. Esto ejercita la persistencia
// (saveCareerSave/loadCareerSave MGC-227): cerrar y reabrir la app retaura
// la sesión y reanuda sin perder stats ni posición.
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

// MGC-251 — Etiqueta del botón "Continuar carrera". Refleja la etapa y el
// progreso (edad + stats si están disponibles) para que el usuario sepa
// dónde retoma.
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
  // MGC-654: H1 multi-línea responsivo. Móvil (≤600) usa 2xl (30px) para que
  // "CREA TU PROPIA CARRERA DE FÚTBOL" quepa en 2 wraps cómodos sin overflow;
  // desktop usa 3xl (36px) con padding generoso. Sin esto, 4xl fijo revienta
  // el viewport mobile y rompe la promesa SEO del H1 multi-línea del audit.
  const { width: viewportWidth } = useWindowDimensions();
  const isCompact = viewportWidth < 600;
  const h1Size = isCompact ? fontSize['2xl'] : fontSize['3xl'];
  const highScore = useGameStatsStore((s) => s.highScore);
  const bestStreak = useGameStatsStore((s) => s.bestStreak);
  const careerStage = useCareerStore((s) => s.stage);
  const careerProfileName = useCareerStore((s) => s.profile.name);
  const careerProfileNumber = useCareerStore((s) => s.profile.number);
  const careerProfileOvr = useCareerStore((s) => s.profile.ovr);
  const careerProfilePosition = useCareerStore((s) => s.profile.position);
  const careerProfileClub = useCareerStore((s) => s.profile.club);
  const careerProfileNationality = useCareerStore((s) => s.profile.nationalityCode);

  const hasCareer = careerStage !== 'identity' && careerProfileName.length > 0;
  const nat = hasCareer ? NATIONALITIES_BY_CODE[careerProfileNationality || ''] : null;
  const countryCode = careerProfileNationality || 'AR';

  // MGC-654: scroll-into-view del anchor #how-to-play. Web usa scrollIntoView
  // (smooth, browser-native); native anuncia la sección con AccessibilityInfo
  // porque hash anchors no tienen equivalente cross-platform sin un ref +
  // measureLayout. El usuario en mobile scrollea manualmente; el announce le
  // confirma que la acción se registró (TalkBack/VoiceOver feedback).
  const scrollToHowToPlay = () => {
    if (Platform.OS === 'web') {
      if (typeof document !== 'undefined') {
        document
          .getElementById('how-to-play')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }
    AccessibilityInfo.announceForAccessibility('Sección Cómo se juega');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.container, { gap: spacing[5] }]}
        testID="home-screen"
      >
        {/* ── CTA principal: form de identidad (MGC-261, gateado por MGC-268) ──
            MGC-655 portó HomepageCareerStarter.tsx con FIFA nationalities y
            draft modes. Reemplaza el Button legacy que navegaba a
            /simulador-carrera/identity con un form persistido vía careerStore
            (commitIdentity). El submit interno (testID="btn-career") reemplaza
            la navegación legacy y mantiene compat con e2e/home.spec.ts.

            MGC-261 fix: el form ahora vive como PRIMER hijo del ScrollView.
            Antes era el segundo (debajo del hero card premium ~600-700 px de
            alto), lo que ubicaba el `btn-career` en y≈2237 sobre viewports
            1920x1080 → fuera del viewport visible (bound stop>bottom inválidos,
            visible=false en uiautomator dump de MGC-254). Reordenando, el
            botón queda dentro del fold inicial (~y=400-700) en mobile.

            MGC-268 gate: cuando hay una carrera persistida en stage terminal
            ('retirement'), el form ya no aplica — la carrera está cerrada.
            Renderizar el form vacío lo empuja a y≈3.4k y el CTA "Continuar
            carrera" a y≈6.2k, fuera del viewport. Ocultamos el form para
            stage=retirement; los demás stages (identity/draft/club/season)
            siguen mostrando el form porque el usuario aún puede abandonarla
            y empezar una nueva.

            MGC-768: envuelto en Suspense con fallback skeleton que respeta
            el alto aproximado del form (480 px) para evitar CLS durante el
            chunk fetch asincrónico. */}
        {careerStage !== 'retirement' ? (
          <Suspense
            fallback={
              <View
                testID="homecareer-starter-loading"
                accessible
                role="status"
                accessibilityLabel="Cargando formulario de identidad"
                style={{ minHeight: 480 }}
              />
            }
          >
            <HomepageCareerStarter />
          </Suspense>
        ) : null}

        {/* ── Premium visual card (kiya0908 CareerCard inspired) ─────── */}
        <View
          style={{
            borderRadius: radii.xl,
            overflow: 'hidden',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          {/* Banner brand — MGC-556: usa `colors.accent` (purple #A855F7 en
              copero) en lugar de `colors.primary` (#FAFAFA white pill) para
              matchear la paleta copero.com.ar §6.2 (hero con tinte de acento).
              MGC-658 (axe QA WCAG AA): el banner sostiene texto blanco y debe
              pasar 4.5:1. `colors.accent` (#A855F7 purple-500) da 4.05:1 con
              blanco — falla AA. `colors.accentDeep` (purple-700 #7E22CE en
              copero) da 6.36:1 → PASS. La identidad morada se mantiene; sólo
              se intensifica el tono para superficies que cargan texto. */}
          <View
            style={{
              paddingVertical: spacing[6],
              paddingHorizontal: spacing[5],
              gap: spacing[2],
              backgroundColor: colors.accentDeep,
            }}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            <Text
              style={{
                color: colors.textOnAccent,
                letterSpacing: 4,
                fontSize: fontSize.sm,
                fontWeight: fontWeight.bold,
              }}
            >
              COPERO · SIMULADOR DE CARRERA
            </Text>
            {/* MGC-654 P0 #3 — H1 multi-línea. Reemplaza "Convertite en leyenda"
                por el SEO title del referente kiya0908. El `\n` fuerza el salto
                entre "COPERO JUEGO:" y el resto en ambos viewports; fontSize
                responsivo (2xl mobile / 3xl desktop) mantiene jerarquía sin
                overflow. numberOfLines={3} protege contra wraps accidentales
                en viewports ultra-anchos. */}
            <Text
              accessibilityRole="header"
              numberOfLines={3}
              style={{
                color: colors.textOnAccent,
                fontSize: h1Size,
                fontFamily: fontFamily.display,
                fontWeight: fontWeight.bold,
                lineHeight: h1Size * lineHeight.tight,
                letterSpacing: -0.5,
              }}
            >
              {'COPERO JUEGO:\nCREA TU PROPIA CARRERA DE FÚTBOL'}
            </Text>
            <Text
              style={{
                color: colors.textOnAccent,
                fontSize: fontSize.base,
                lineHeight: fontSize.base * lineHeight.base,
              }}
            >
              Tomá decisiones, asumí consecuencias y construí tu carrera futbolística paso a paso.
            </Text>

            {/* MGC-654 P0 #2 — Tag-list con 4 chips. Wrapper con role="text" +
                label combinado (MGC-501 TalkBack pattern: cada chip se oculta
                al a11y individual y el grupo expone la lista como una sola
                unidad semántica). Chips semitransparentes para no competir
                con el CTA verde primario que viene después. */}
            <View
              testID="home-tag-list"
              accessibilityRole="text"
              accessibilityLabel="Características del juego: juego online, draft de ocho atributos, modo carrera, guardado local"
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: spacing[2],
                marginTop: spacing[3],
              }}
            >
              <TagPill label="Juego online" />
              <TagPill label="Draft 8 atributos" />
              <TagPill label="Modo carrera" />
              <TagPill label="Guardado local" />
            </View>
          </View>

          {/* Visual centerpiece: camiseta + OVR (estilo kiya0908 CareerCard) */}
          <View
            style={{
              alignItems: 'center',
              paddingVertical: spacing[6],
              paddingHorizontal: spacing[5],
              gap: spacing[4],
              backgroundColor: colors.surface,
            }}
          >
            <Suspense
              fallback={
                <View
                  accessibilityElementsHidden
                  style={{ width: 240, height: 320, borderRadius: 18, backgroundColor: colors.surface2 }}
                />
              }
            >
              <JerseyPreview
                countryCode={countryCode}
                number={hasCareer ? careerProfileNumber : '—'}
                name={hasCareer ? careerProfileName : 'Tu jugador'}
                size="lg"
                testID="home-jersey"
              />
            </Suspense>

            {/* OVR chip flotante (cumple AA en light y dark sobre primary) */}
            <View
              style={{
                paddingHorizontal: spacing[5],
                paddingVertical: spacing[2],
                borderRadius: radii.pill,
                backgroundColor: colors.primary,
              }}
              accessibilityLabel={`Overall rating ${hasCareer ? careerProfileOvr : 'sin carrera iniciada'}`}
            >
              <Text
                style={{
                  color: colors.textOnPrimary,
                  fontSize: fontSize.md,
                  fontWeight: fontWeight.bold,
                  letterSpacing: 1,
                }}
              >
                OVR {hasCareer ? careerProfileOvr : '—'}
              </Text>
            </View>

            {/* Meta: posición + país + club */}
            <Text
              style={{
                color: colors.textMuted,
                fontSize: fontSize.sm,
                textAlign: 'center',
                letterSpacing: 0.5,
              }}
              accessibilityLabel={
                hasCareer
                  ? `${careerProfilePosition} ${nat ? nat.name : ''} ${careerProfileClub ? careerProfileClub.name : 'sin club'}`
                  : 'Esperando identidad'
              }
            >
              {hasCareer
                ? `${careerProfilePosition}${nat ? ` · ${nat.flag} ${nat.name}` : ''}${
                    careerProfileClub ? ` · ${careerProfileClub.name}` : ''
                  }`
                : 'Definí tu identidad para empezar'}
            </Text>

            {/* MGC-664 — Draft track preview (MGC-656 spec): 8 markers + hint
                + modo badge reactivo al store compartido con MGC-655. */}
            <DraftModePreview />
          </View>

          {/* Mini-stats footer (Mejor puntaje / Mejor racha / OVR) */}
          <View
            style={{
              flexDirection: 'row',
              paddingHorizontal: spacing[5],
              paddingVertical: spacing[4],
              gap: spacing[5],
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.surface2,
            }}
          >
            <MiniStat
              label="Mejor puntaje"
              value={highScore > 0 ? highScore : '—'}
              accessibilityLabel={`Mejor puntaje ${highScore}`}
            />
            <MiniStat
              label="Mejor racha"
              value={bestStreak > 0 ? bestStreak : '—'}
              accessibilityLabel={`Mejor racha ${bestStreak}`}
            />
            <MiniStat
              label="OVR actual"
              value={hasCareer ? careerProfileOvr : '—'}
              accessibilityLabel={`Overall actual ${careerProfileOvr}`}
            />
          </View>
        </View>

        {/* ── MGC-268 — CTA "Continuar carrera" reubicado a la cabeza ─────
            Bug MGC-268: con d80b2b7 + MGC-768, el form de identidad creció
            ~2.6k px y empujó este CTA a y≈6.2k (logcat: `btn-home-resume-
            career visible=false boundsInScreen: Rect(40, 6216 - 1040, 1990)`),
            fuera del viewport. Tras relaunch con stage=retirement, el home
            mostraba la hero card + jersey TESTQA #99 pero ningún usuario
            llegaba al CTA sin scrollear >6k px. MGC-251 lo había puesto
            debajo de "Ver cómo se juega" + 3 secciones lazy. Lo movemos a
            inmediatamente después de la hero card para que esté dentro del
            primer fold y el tap navegue a /simulador-carrera/fin-carrera
            (o la ruta correspondiente a `stage`). Cumple el AC de MGC-262. */}
        {hasCareer ? (
          <Button
            label={resumeLabelForStage(careerStage)}
            onPress={() => router.push(resumeRouteForStage(careerStage))}
            variant="primary"
            size="lg"
            fullWidth
            testID="btn-home-resume-career"
            accessibilityLabel={`Continuar carrera de ${careerProfileName} en etapa ${careerStage}`}
            accessibilityHint="Restaura la sesión guardada y reanuda el loop de carrera"
          />
        ) : null}

{/* ── CTA secundario (MGC-654 P0 #4) ────────────────────────────
            Ghost variant sobre `colors.bg` lee en `colors.text` (sigue
            cumpliendo AA porque Button ghost usa texto del theme, no literal).
            Ancla a #how-to-play via scrollIntoView; en native es no-op. */}
        <Button
          label="Ver cómo se juega"
          onPress={scrollToHowToPlay}
          variant="ghost"
          size="md"
          fullWidth
          testID="btn-how-to-play"
          accessibilityHint="Salta a la sección Cómo se juega"
        />

        {/* ── Cómo se juega (lazy-load MGC-782) ──────────────────────── */}
        {/* Sección extraída a `src/components/home/HowToPlaySteps.tsx`. Ver
            bloque arriba. Anchor scrollIntoView + testID preservados. */}
        <Suspense fallback={null}>
          <HowToPlaySteps />
        </Suspense>

        {/* ── Comparador Classic vs Purist (lazy-load MGC-782) ────────── */}
        {/* Bloque descriptivo NO interactivo extraído a
            `src/components/home/ComparadorClassicPurist.tsx`. La elección
            real del modo se mantiene en /simulador-carrera/identity. */}
        <Suspense fallback={null}>
          <ComparadorClassicPurist />
        </Suspense>

        {/* ── FAQ (lazy-load MGC-782) ─────────────────────────────────── */}
        {/* 6 items extraídos a `src/components/home/FAQList.tsx`. */}
        <Suspense fallback={null}>
          <FAQList />
        </Suspense>

        {/* ── Hint de dorsal si hay carrera ──────────────────────────── */}
        {hasCareer ? (
          <Text
            style={{
              color: colors.textMuted,
              fontSize: fontSize.xs,
              textAlign: 'center',
              letterSpacing: 1,
            }}
            accessibilityLabel={`Dorsal número ${careerProfileNumber}, jugador ${careerProfileName}`}
          >
            DORSAL #{careerProfileNumber} · {careerProfileName}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function MiniStat({
  label,
  value,
  accessibilityLabel,
}: {
  label: string;
  value: string | number;
  accessibilityLabel: string;
}) {
  const { colors, fontSize, fontWeight, fontFamily, spacing } = useTheme();
  return (
    <View
      style={{ flex: 1, gap: spacing[1] }}
      accessible
      accessibilityLabel={accessibilityLabel}
    >
      <Text
        style={{
          color: colors.textMuted,
          fontSize: fontSize.xs,
          letterSpacing: 1,
          fontWeight: fontWeight.medium,
        }}
      >
        {label.toUpperCase()}
      </Text>
      <Text
        style={{
          color: colors.textStrong,
          fontSize: fontSize['2xl'],
          fontFamily: fontFamily.display,
          fontWeight: fontWeight.bold,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * DraftModePreview — MGC-664 (spec MGC-656).
 *
 * Bloque preview-only que muestra:
 *   1. 8 markers (cuadrícula 23% cada uno, aspectRatio 1:1) con el primero
 *      activo. Marca el "track" de los 8 atributos del draft (MGC-655).
 *   2. Hint copy literal: 'El siguiente paso es el draft de ocho atributos
 *      con leyendas.' (AC del ticket).
 *   3. Badge dinámico que refleja el `draftMode` actual del store
 *      compartido (MGC-655 lo conecta vía setDraftMode).
 *
 * Accesibilidad:
 *   - Contenedor con `accessibilityRole='text'` y label consolidado que
 *     combina markers + hint + modo (MGC-501 TalkBack pattern).
 *   - Markers individuales con `accessibilityElementsHidden` para evitar
 *     lectura repetitiva (8 anuncios consecutivos).
 *   - Badge con su propio `accessibilityLabel` para foco específico.
 *
 * Visualmente:
 *   - Markers usan `colors.surface2` sobre `colors.surface` (cumple AA).
 *   - Badge usa `colors.primary` + `colors.textOnPrimary` (validado MGC-462).
 *   - Sin CLS: aspectRatio 1:1 + width fijo 23% garantiza dimensiones
 *     estables cuando el form setea el modo.
 */
function DraftModePreview() {
  const { colors, radii, spacing, fontSize, fontWeight, fontFamily } = useTheme();
  const draftMode = useDraftModeStore((s) => s.draftMode);
  const isClassic = draftMode === 'classic';
  const modeLabel = isClassic ? 'MODO CLASSIC' : 'MODO PURIST';

  return (
    <View
      testID="home-draft-preview"
      accessibilityRole="text"
      accessibilityLabel={
        'Draft de ocho atributos con leyendas. ' +
        modeLabel +
        '. El siguiente paso es el draft de ocho atributos con leyendas.'
      }
      style={{ alignSelf: 'stretch', gap: spacing[2] }}
    >
      <View
        testID="home-draft-track"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}
      >
        {Array.from({ length: 8 }, (_, idx) => {
          const isActive = idx === 0;
          return (
            <View
              key={'marker-' + (idx + 1)}
              testID={'home-draft-marker-' + (idx + 1)}
              style={{
                width: '23%',
                aspectRatio: 1,
                minWidth: 28,
                borderRadius: radii.sm,
                borderWidth: 1,
                borderColor: isActive ? colors.primary : colors.border,
                backgroundColor: isActive ? colors.primary : colors.surface2,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              <Text
                style={{
                  color: isActive ? colors.textOnPrimary : colors.textMuted,
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.bold,
                  fontFamily: fontFamily.mono,
                }}
              >
                {idx + 1}
              </Text>
            </View>
          );
        })}
      </View>
      <Text
        testID="home-draft-hint"
        style={{
          color: colors.textMuted,
          fontSize: fontSize.xs,
          textAlign: 'center',
          lineHeight: fontSize.xs * 1.4,
        }}
      >
        El siguiente paso es el draft de ocho atributos con leyendas.
      </Text>
      <View
        testID="home-draft-badge"
        accessibilityRole="text"
        accessibilityLabel={'Modo de draft seleccionado: ' + modeLabel + '.'}
        style={{
          alignSelf: 'center',
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[1],
          borderRadius: radii.pill,
          borderWidth: 1,
          borderColor: colors.primary,
          backgroundColor: colors.primary,
        }}
      >
        <Text
          style={{
            color: colors.textOnPrimary,
            fontSize: fontSize.xs,
            fontWeight: fontWeight.bold,
            fontFamily: fontFamily.display,
            letterSpacing: 2,
          }}
        >
          {modeLabel}
        </Text>
      </View>
    </View>
  );
}

/**
 * TagPill — MGC-654 P0 #2.
 *
 * Chip estático (no interactivo) para el tag-list del hero. Diferencia
 * intencional respecto a `CategoryChip`:
 *   - Sin `onPress` ni `selected` — aquí los tags son descriptivos, no filtros.
 *   - `accessibilityElementsHidden` para que TalkBack/VoiceOver NO los lea
 *     individualmente; el wrapper `<View accessibilityRole="text">` del
 *     tag-list expone la lista completa como una unidad (MGC-501).
 *   - Fondo translúcido blanco sobre `colors.accentDeep` (purple-700 en
 *     copero) para legibilidad AA sin competir visualmente con el CTA
 *     verde primario.
 *
 * MGC-697 WCAG AA fix: bg 50% blanco sobre accent #A855F7 (purple-500)
 * daba 2.49:1 con texto blanco. PR #111 (c79ac34 MGC-760) movió el banner
 * a `colors.accentDeep` (#7E22CE purple-700) y subió α a 0.50 esperando
 * que el texto blanco mantuviera contraste.
 *
 * MGC-770 regresión WCAG AA: sobre el banner #7E22CE (PR #111), 50% blanco
 * compone a #BF90E6 (light purple) y el texto blanco (textOnAccent #FFF)
 * mide **2.49:1 → FAIL AA 4.5:1** en axe-core r2 de MGC-762 (4 nodos
 * afectados: 'Juego online' / 'Draft 8 atributos' / 'Modo carrera' /
 * 'Guardado local'). Subir α empeora el ratio (más blanco = más claro =
 * texto blanco se acerca → baja contraste; ver [[copero-mgc-695-wcag-alpha-direction]]).
 *
 * Fix MGC-770: invertir el polarity del chip. Texto oscuro
 * (`colors.textOnPrimary` = zinc-950 #09090B en copero/dark themes)
 * sobre el pill translúcido #BF90E6 = **7.92:1 → PASS AA** (recalculado
 * con la fórmula WCAG sRGB). El border 0.70 blanco se mantiene para
 * preservar el contorno glass sobre el banner morado.
 */
function TagPill({ label }: { label: string }) {
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{
        paddingVertical: spacing[2],
        paddingHorizontal: spacing[4],
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.70)',
        backgroundColor: 'rgba(255, 255, 255, 0.50)',
      }}
    >
      <Text
        style={{
          color: colors.textOnPrimary,
          fontSize: fontSize.sm,
          fontWeight: fontWeight.semibold,
          letterSpacing: 0.3,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: 16 },
});