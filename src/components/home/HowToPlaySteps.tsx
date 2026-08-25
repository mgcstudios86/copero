import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '@/design';

/**
 * MGC-782: Cómo se juega — extraído como chunk asincrónico.
 *
 * El bloque vive debajo del fold (después del hero, stats, jersey preview,
 * HomepageCareerStarter y comparador). El usuario debe scrollear para verlo,
 * por eso es seguro lazy-load: la red no compite con el LCP del hero.
 *
 * Patrón idéntico a MGC-768 / MGC-771: `React.lazy()` + Suspense fallback
 * mínimo en `app/index.tsx`. El chunk asincrónico `HowToPlaySteps-*.js` se
 * descarga sólo cuando el browser resuelve la dynamic import (scroll a la
 * zona o fallback timer de Suspense).
 */

const STEPS = [
  {
    number: '1',
    title: 'Crea tu jugador',
    body: 'Nombre, dorsal, posición y selección. Tu jugador arranca con 16 años y OVR 50.',
  },
  {
    number: '2',
    title: 'Completa el draft de 8 atributos',
    body: 'Elegí 8 estadísticas en rondas. Cuanto mejor tu draft, mejor tu techo de OVR.',
  },
  {
    number: '3',
    title: 'Elegí dónde empieza tu carrera',
    body: 'Fichá por un club inicial según tu posición. Empezás en inferiores o primera división.',
  },
  {
    number: '4',
    title: 'Vive temporadas, fichajes y decisiones',
    body: 'Semana a semana: entrenamientos, partidos, ofertas, lesiones y prensa. Tus decisiones cambian todo.',
  },
] as const;

export function HowToPlaySteps() {
  const { colors, spacing, fontSize, fontWeight, fontFamily } = useTheme();
  return (
    <View testID="how-to-play" nativeID="how-to-play" style={{ gap: spacing[3] }}>
      <Text
        style={{
          color: colors.textMuted,
          letterSpacing: 3,
          fontSize: fontSize.xs,
          fontWeight: fontWeight.bold,
          fontFamily: fontFamily.display,
        }}
        accessibilityRole="header"
      >
        CÓMO SE JUEGA
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] }}>
        {STEPS.map((step) => (
          <StepCard key={step.number} {...step} />
        ))}
      </View>
    </View>
  );
}

function StepCard({ number, title, body }: { number: string; title: string; body: string }) {
  const { colors, radii, spacing, fontSize, fontWeight, fontFamily } = useTheme();
  return (
    <View
      style={{
        // MGC-658: 4 pasos en layout 2×2 con `flexBasis: '48%'`. En mobile
        // angosto (`minWidth: 200` no entra en 1 fila) colapsa a 1 columna
        // sin media queries. Antes era `flex: 1` para 3 pasos en 1 fila.
        flexBasis: '48%',
        flexGrow: 1,
        minWidth: 200,
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
