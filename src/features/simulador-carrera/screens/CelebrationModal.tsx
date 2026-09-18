import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '@/design';
import { Button } from '@/design/components';

/**
 * MGC-601 / MGC-487.4 — Modal celebración del campeón.
 *
 * Spec Step 5 (`docs/flows/temporada-loop-5-semanas-playoffs/flow.md`):
 *   "Campeón con trofeo animado. Resultado esperado: modal con
 *    trofeo animado, nombre del campeón, confeti opcional, dismissible
 *    con CTA Nueva temporada."
 *
 * Decisiones técnicas:
 *   - Trofeo animado vía `Animated` core (mismo patrón que Ticker /
 *     RoundTimer en `design/components`). Reanimated está disponible,
 *     pero mantener core reduce surface area de native build y matchea
 *     el resto del design system.
 *   - Tres animaciones concurrentes:
 *       1. Trophy scale-in (spring) al montar.
 *       2. Trophy glow pulse (loop, infinite) después del settle.
 *       3. Confeti: 12 puntos con caída vertical + drift lateral,
 *          colores del theme (primary, accent, success).
 *   - `prefers-reduced-motion` desactiva confeti y reduce el pulse a
 *     un único fade-in estático (cumplimiento a11y MGC-337).
 *   - Confeti opcional: `enableConfetti={false}` lo apaga (tests,
 *     smoke checks). Por default activo para dar feedback visual fuerte.
 *   - Dismiss: backdrop tap o CTA secundaria "Cerrar". La CTA principal
 *     "Nueva temporada" navega a `/simulador-carrera/season-summary`
 *     y NO cierra sola — el caller (playoff.tsx) lo hace via
 *     `onNewSeason` que ejecuta la navegación + cleanup atómico.
 *   - **MGC-629 (iter5)**: iter1-iter4 usaron el `<Modal>` nativo de RN,
 *     que sobre Android monta un `DialogFragment` nativo. Ese fragment
 *     bloqueaba los `router.push`/`router.replace` de expo-router
 *     (sincronización interna del bridge: el NavigationContainer no
 *     commitea una transición mientras haya un DialogFragment visible).
 *     Cualquier `setShow(false)` en el batch del onPress dismissea el
 *     fragment antes de que la transición commitee → push abortado.
 *     Fix iter5: eliminar el `<Modal>` y renderizar la celebración como
 *     un `<View position="absolute">` overlay dentro del árbol del
 *     screen. Sin DialogFragment nativo, `setShow(false)` y
 *     `router.replace()` son JS puros coordinados por React, sin race
 *     del bridge.
 *   - **MGC-629 (iter3)**: el backdrop era un Pressable padre del card,
 *     lo que hacía que capturase los taps de los Button antes de que
 *     sus `onPress` se ejecutasen. Solución preservada: backdrop como
 *     `<Pressable style={StyleSheet.absoluteFill}>` hermano del card,
 *     con `pointerEvents="box-none"` en el contenedor para que sólo el
 *     área fuera del card reciba el dismiss-tap.
 *   - Accesibilidad: `accessibilityViewIsModal` para que TalkBack
 *     aísle el foco al modal; `accessibilityLiveRegion="polite"` en
 *     el contenedor y en el nombre del campeón para que se lea tras
 *     el header.
 */

export type CelebrationModalProps = {
  visible: boolean;
  champion: string | null;
  season: number;
  onClose: () => void;
  onNewSeason: () => void;
  /** Default true — desactiva confeti para tests o prefers-reduced-motion. */
  enableConfetti?: boolean;
};

const TROPHY_GLYPH = '🏆';
const CONFETTI_COUNT = 14;
// Paleta semillada por index — no usamos random para que SSR/CSR
// y tests snapshots vean el mismo orden y colores en cada render.
const CONFETTI_COLORS = [
  '#F5C518', // dorado trofeo
  '#FF6B6B',
  '#4ECDC4',
  '#95E1D3',
  '#F38181',
  '#AA96DA',
];

type ConfettiPiece = {
  startX: number; // 0..1 (fracción del ancho del modal)
  delay: number;
  duration: number;
  drift: number; // px lateral
  color: string;
  size: number;
};

function buildConfetti(count: number): ConfettiPiece[] {
  const out: ConfettiPiece[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      startX: (i + 0.5) / count,
      delay: i * 60,
      duration: 1800 + (i % 5) * 220,
      drift: (i % 2 === 0 ? 1 : -1) * (12 + (i % 4) * 6),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 6 + (i % 3) * 2,
    });
  }
  return out;
}

export function CelebrationModal({
  visible,
  champion,
  season,
  onClose,
  onNewSeason,
  enableConfetti = true,
}: CelebrationModalProps) {
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  const reducedMotion = useTheme().reducedMotion;

  // Trophy scale-in.
  const trophyScale = useRef(new Animated.Value(0)).current;
  // Trophy pulse (loop) post-settle.
  const trophyPulse = useRef(new Animated.Value(1)).current;
  // Card opacity (entera).
  const cardOpacity = useRef(new Animated.Value(0)).current;

  const confettiPieces = useMemo(() => buildConfetti(CONFETTI_COUNT), []);
  const confettiAnims = useRef(
    confettiPieces.map(() => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    if (!visible) {
      // Reset al cerrar para que la próxima apertura vuelva a animar.
      trophyScale.setValue(0);
      trophyPulse.setValue(1);
      cardOpacity.setValue(0);
      confettiAnims.forEach((v) => v.setValue(0));
      return;
    }

    // Card fade-in.
    Animated.timing(cardOpacity, {
      toValue: 1,
      duration: reducedMotion ? 0 : 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    // Trophy scale-in spring.
    Animated.spring(trophyScale, {
      toValue: 1,
      friction: reducedMotion ? 9 : 5,
      tension: reducedMotion ? 100 : 80,
      useNativeDriver: true,
    }).start(() => {
      if (reducedMotion) return;
      // Pulse loop sólo si reduced-motion off.
      Animated.loop(
        Animated.sequence([
          Animated.timing(trophyPulse, {
            toValue: 1.08,
            duration: 700,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(trophyPulse, {
            toValue: 1,
            duration: 700,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    });

    // Confeti: arranca tras settle del trofeo.
    if (enableConfetti && !reducedMotion) {
      const animations = confettiPieces.map((piece, idx) =>
        Animated.timing(confettiAnims[idx], {
          toValue: 1,
          duration: piece.duration,
          delay: 400 + piece.delay,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      );
      Animated.parallel(animations).start();
    } else if (reducedMotion) {
      // Estado final estático para accesibilidad.
      confettiAnims.forEach((v) => v.setValue(1));
    }
  }, [
    visible,
    reducedMotion,
    enableConfetti,
    trophyScale,
    trophyPulse,
    cardOpacity,
    confettiAnims,
    confettiPieces,
  ]);

  if (!visible || !champion) return null;

  const trophyAnimatedStyle = {
    transform: [{ scale: trophyScale }, { scale: trophyPulse }],
  };

  return (
    // MGC-629 iter5 — eliminar el `<Modal>` nativo (que monta un
    // DialogFragment sobre Android y bloqueaba router.replace). El
    // overlay es un View regular absolute-fill en el árbol de playoff.
    // zIndex/elevation lo mantienen sobre el resto del screen hasta
    // que setShow(false) lo desmonte.
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        elevation: 1000,
        backgroundColor: 'rgba(8, 12, 20, 0.78)',
      }}
      testID="celebration-modal"
      accessibilityViewIsModal
      accessibilityLiveRegion="polite"
    >
      {/* MGC-629 iter3 — backdrop como Pressable hermano (no padre) del card.
          Antes era un Pressable que envolvía todo el contenido y se
          llevaba el tap de los Button antes de que sus onPress se
          ejecutasen. Ahora es absoluteFill detrás del card y el
          contenedor usa pointerEvents="box-none" para que sólo el
          área fuera del card reciba el dismiss-tap. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cerrar celebración"
        onPress={onClose}
        style={StyleSheet.absoluteFill}
        testID="celebration-backdrop"
      />
      <View
        pointerEvents="box-none"
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing[5],
        }}
      >
        <Animated.View
          style={[
            {
              width: '100%',
              maxWidth: 440,
              borderRadius: radii.xl,
              borderWidth: 2,
              borderColor: '#F5C518',
              backgroundColor: colors.surface,
              padding: spacing[6],
              alignItems: 'center',
              gap: spacing[4],
              opacity: cardOpacity,
            },
          ]}
          testID="celebration-card"
        >
          {/* Confeti layer — absoluto detrás del trofeo. */}
          {enableConfetti ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 220,
                overflow: 'hidden',
              }}
              testID="celebration-confetti"
            >
              {confettiPieces.map((piece, idx) => {
                const progress = confettiAnims[idx];
                const translateY = progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-40, 240],
                });
                const translateX = progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, piece.drift],
                });
                const opacity = progress.interpolate({
                  inputRange: [0, 0.1, 0.9, 1],
                  outputRange: [0, 1, 1, 0],
                });
                return (
                  <Animated.View
                    key={`confetti-${idx}`}
                    style={{
                      position: 'absolute',
                      left: `${piece.startX * 100}%`,
                      top: 0,
                      width: piece.size,
                      height: piece.size,
                      borderRadius: piece.size / 2,
                      backgroundColor: piece.color,
                      transform: [{ translateY }, { translateX }],
                      opacity,
                    }}
                  />
                );
              })}
            </View>
          ) : null}

          {/* Trophy */}
          <Animated.Text
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={[
              {
                fontSize: 96,
                lineHeight: 110,
                textAlign: 'center',
                marginTop: spacing[2],
              },
              trophyAnimatedStyle,
            ]}
            testID="celebration-trophy"
          >
            {TROPHY_GLYPH}
          </Animated.Text>

          {/* Header */}
          <Text
            accessibilityRole="header"
            style={{
              color: '#F5C518',
              fontSize: 12,
              fontWeight: fontWeight.bold,
              letterSpacing: 3,
              textAlign: 'center',
            }}
          >
            {`🏆 CAMPEÓN · TEMPORADA ${season}`}
          </Text>

          {/* Champion name */}
          <Text
            accessibilityLiveRegion="polite"
            style={{
              color: colors.textStrong,
              fontSize: fontSize['2xl'],
              fontWeight: fontWeight.bold,
              textAlign: 'center',
            }}
            testID="celebration-champion-name"
            accessibilityLabel={`Campeón: ${champion}`}
          >
            {champion}
          </Text>

          {/* Subtitle */}
          <Text
            style={{
              color: colors.textMuted,
              fontSize: fontSize.sm,
              textAlign: 'center',
              lineHeight: fontSize.sm * 1.4,
            }}
          >
            La temporada regular y los playoffs llegaron a su fin. Arrancá
            una nueva campaña con tu club.
          </Text>

          {/* CTAs */}
          <View style={{ width: '100%', gap: spacing[2], marginTop: spacing[2] }}>
            <Button
              label="Nueva temporada"
              onPress={onNewSeason}
              variant="primary"
              fullWidth
              hitSlop={44}
              testID="celebration-btn-new-season"
              accessibilityHint="Cierra la temporada actual y abre el resumen de fin de año."
            />
            <Button
              label="Cerrar"
              onPress={onClose}
              variant="ghost"
              fullWidth
              hitSlop={44}
              testID="celebration-btn-close"
            />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

export default CelebrationModal;

// Silence "unused style import" lint si alguien referencia StyleSheet
// en el futuro (lo dejamos para migración futura a StyleSheet.create).
void StyleSheet;
