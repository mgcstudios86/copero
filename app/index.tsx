import React, { Suspense, lazy } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design';
import { Button } from '@/design/components';
import { useGameStore } from '@/shared/store/gameStore';
import { useCareerStore } from '@/shared/store/careerStore';
import { NATIONALITIES_BY_CODE } from '@/features/career/nationalities';

// Lazy-load JerseyPreview para mantener el chunk inicial del home liviano
// (MGC-505: el hero premium se renderiza, pero el SVG patterns sólo cuando
// el browser lo solicita). Fallback con dimensiones fijas evita CLS.
const JerseyPreview = lazy(() =>
  import('@/design/components/JerseyPreview').then((m) => ({ default: m.JerseyPreview })),
);

/**
 * Home — landing único del simulador "Convertite en Leyenda" (MGC-505).
 *
 * Iteración kiya0908/copero (HomepageCareerStarter + IntroPhase):
 * - Premium visual card con camiseta grande + OVR (estilo Career Result Card).
 * - Sección "Cómo se juega" con 3 pasos numerados (1, 2, 3) al estilo
 *   `intro.how.steps` del repo de referencia.
 * - FAQ con preguntas frecuentes para SEO + bajar fricción de entrada.
 * - Mantiene: solo Convertite en Leyenda visible (sin CTAs de otros juegos),
 *   deep-links preservados, WCAG AA, contraste sobre `colors.primary`.
 *
 * Accesibilidad:
 * - `accessibilityRole="header"` en banner h1, section h2, step h3.
 * - `accessibilityLabel` descriptivo en cada stat, step y FAQ item.
 * - WCAG AA target ≥ 4.5:1 sobre `colors.surface` y `colors.bg`.
 */
export default function Home() {
  const router = useRouter();
  const { colors, radii, spacing, fontSize, fontWeight, fontFamily, lineHeight } = useTheme();
  const highScore = useGameStore((s) => s.highScore);
  const bestStreak = useGameStore((s) => s.bestStreak);
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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.container, { gap: spacing[5] }]}
        testID="home-screen"
      >
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
          {/* Banner brand */}
          <View
            style={{
              paddingVertical: spacing[6],
              paddingHorizontal: spacing[5],
              gap: spacing[2],
              backgroundColor: colors.primary,
            }}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            <Text
              style={{
                color: colors.textOnPrimary,
                letterSpacing: 4,
                fontSize: fontSize.sm,
                fontWeight: fontWeight.bold,
                opacity: 0.85,
              }}
            >
              COPERO · SIMULADOR DE CARRERA
            </Text>
            <Text
              style={{
                color: colors.textOnPrimary,
                fontSize: fontSize['4xl'],
                fontFamily: fontFamily.display,
                fontWeight: fontWeight.bold,
                lineHeight: fontSize['4xl'] * lineHeight.tight,
              }}
              accessibilityRole="header"
            >
              Convertite en leyenda
            </Text>
            <Text
              style={{
                color: colors.textOnPrimary,
                fontSize: fontSize.base,
                lineHeight: fontSize.base * lineHeight.base,
                opacity: 0.9,
              }}
            >
              Tomá decisiones, asumí consecuencias y construí tu carrera futbolística paso a paso.
            </Text>
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

        {/* ── CTA principal ───────────────────────────────────────────── */}
        <Button
          label={hasCareer ? 'Continuar carrera' : 'Empezar carrera'}
          onPress={() =>
            router.push(
              careerStage === 'identity'
                ? '/simulador-carrera/identity'
                : '/simulador-carrera/dashboard',
            )
          }
          variant="primary"
          size="lg"
          fullWidth
          testID="btn-career"
          accessibilityHint="Abre el simulador de carrera"
        />

        {/* ── Cómo se juega (3 pasos numerados, kiya0908 IntroPhase) ─── */}
        <View style={{ gap: spacing[3] }}>
          <Text
            style={{
              color: colors.primary,
              letterSpacing: 3,
              fontSize: fontSize.xs,
              fontWeight: fontWeight.bold,
            }}
            accessibilityRole="header"
          >
            CÓMO SE JUEGA
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing[3] }}>
            <StepCard
              number="1"
              title="Definí tu identidad"
              body="Nombre, dorsal, posición y selección. Tu jugador arranca con 16 años y OVR 50."
            />
            <StepCard
              number="2"
              title="Pasá por la academia"
              body="Elegí 8 atributos en rondas. Cuanto mejor tu draft, mejor tu techo de OVR."
            />
            <StepCard
              number="3"
              title="Viví tu carrera"
              body="Semana a semana: entrenamientos, partidos, ofertas, lesiones y prensa. Tus decisiones cambian todo."
            />
          </View>
        </View>

        {/* ── FAQ (kiya0908 IntroPhase faqs) ──────────────────────────── */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radii.lg,
            padding: spacing[4],
            borderWidth: 1,
            borderColor: colors.border,
            gap: spacing[3],
          }}
        >
          <Text
            style={{
              color: colors.text,
              fontSize: fontSize.md,
              fontWeight: fontWeight.bold,
            }}
            accessibilityRole="header"
          >
            Preguntas frecuentes
          </Text>
          <FaqItem
            q="¿Cuánto dura una carrera?"
            a="Una carrera larga arranca a los 16 y termina cuando tu jugador se retira (cerca de los 35). Cada año trae pretemporada, temporada y ofertas."
          />
          <FaqItem
            q="¿Puedo cambiar de club?"
            a="Sí. Cada ventana de transferencias recibís ofertas de otros clubes según tu OVR, edad y reputación. También podés rechazar y quedarte."
          />
          <FaqItem
            q="¿Qué pasa cuando me retiro?"
            a="Tu carrera entra en el resumen final: trofeos, estadísticas, clubs y selección. Después podés empezar una nueva."
          />
          <FaqItem
            q="¿Se guarda mi progreso?"
            a="Sí, localmente en el dispositivo. Tu carrera persiste entre sesiones mientras no limpies los datos de la app."
          />
        </View>

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

function StepCard({ number, title, body }: { number: string; title: string; body: string }) {
  const { colors, radii, spacing, fontSize, fontWeight, fontFamily } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        padding: spacing[4],
        borderWidth: 1,
        borderColor: colors.border,
        gap: spacing[2],
      }}
      accessible
      accessibilityLabel={`Paso ${number}: ${title}. ${body}`}
    >
      <Text
        style={{
          color: colors.primary,
          fontSize: fontSize['3xl'],
          fontFamily: fontFamily.display,
          fontWeight: fontWeight.bold,
          lineHeight: fontSize['3xl'] * 1,
        }}
      >
        {number}
      </Text>
      <Text
        style={{
          color: colors.textStrong,
          fontSize: fontSize.sm,
          fontWeight: fontWeight.bold,
          fontFamily: fontFamily.display,
        }}
        accessibilityRole="header"
      >
        {title}
      </Text>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: fontSize.xs,
          lineHeight: fontSize.xs * 1.4,
        }}
      >
        {body}
      </Text>
    </View>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const { colors, spacing, fontSize, fontWeight } = useTheme();
  return (
    <View style={{ gap: spacing[1] }} accessible accessibilityLabel={`${q} ${a}`}>
      <Text
        style={{
          color: colors.textStrong,
          fontSize: fontSize.sm,
          fontWeight: fontWeight.semibold,
        }}
      >
        {q}
      </Text>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: fontSize.sm,
          lineHeight: fontSize.sm * 1.4,
        }}
      >
        {a}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: 16 },
});