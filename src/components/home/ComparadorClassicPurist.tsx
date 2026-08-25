import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '@/design';

/**
 * MGC-782: Comparador Classic vs Purist — extraído como chunk asincrónico.
 *
 * Bloque descriptivo no interactivo. La elección real del modo se mantiene
 * en `/simulador-carrera/identity` (decisión MGC-646 §3.3 Opción B). Acá
 * se comparan ambos modos para bajar la barrera de entrada antes del
 * primer partido.
 *
 * WCAG AA: cada columna expone `accessibilityLabel` consolidado (título +
 * bullets + footer en una sola lectura).
 */

export function ComparadorClassicPurist() {
  const { colors, radii, spacing, fontSize, fontWeight, fontFamily } = useTheme();
  return (
    <View
      testID="draft-mode-comparator"
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
          fontFamily: fontFamily.display,
        }}
        accessibilityRole="header"
      >
        Modos de draft: Classic y Purist
      </Text>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: fontSize.sm,
          lineHeight: fontSize.sm * 1.4,
        }}
      >
        Antes del primer partido elegís cómo querés que sea el draft de 8
        atributos. Dos modos, mismo techo de OVR, distinta dificultad.
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] }}>
        <CompareCard
          eyebrow="MODO CLASSIC"
          title="Ideal para arrancar"
          bullets={[
            '8 rondas con palabras y plantillas de apoyo.',
            'Cada acierto sube un atributo fijo.',
            'Ritmo tranquilo, menos riesgo de lesión mental.',
          ]}
          footer="Recomendado si es tu primera carrera."
          testID="compare-classic"
        />
        <CompareCard
          eyebrow="MODO PURIST"
          title="Para los que saben"
          bullets={[
            '8 rondas con letras crudas, sin plantillas.',
            'Cada acierto da más OVR pero sin red.',
            'Ritmo rápido: más lesiones, más premios.',
          ]}
          footer="Recomendado para carreras con replay."
          testID="compare-purist"
        />
      </View>
    </View>
  );
}

/**
 * CompareCard — columna del comparador Classic vs Purist (MGC-658).
 *
 * Renderiza una tarjeta con eyebrow, título, bullets y footer.
 * `flexBasis: '48%'` en el padre hace que en desktop se vea 2-up
 * y en mobile (< 480 px) colapse a una columna. WCAG AA: el View
 * raíz combina título + bullets + footer en un único
 * `accessibilityLabel` para lectores de pantalla.
 */
function CompareCard({
  eyebrow,
  title,
  bullets,
  footer,
  testID,
}: {
  eyebrow: string;
  title: string;
  bullets: string[];
  footer: string;
  testID?: string;
}) {
  const { colors, radii, spacing, fontSize, fontWeight, fontFamily } = useTheme();
  return (
    <View
      testID={testID}
      style={{
        flexBasis: '48%',
        flexGrow: 1,
        minWidth: 220,
        backgroundColor: colors.surface2,
        borderRadius: radii.md,
        padding: spacing[4],
        borderWidth: 1,
        borderColor: colors.border,
        gap: spacing[2],
      }}
      accessible
      accessibilityLabel={`${eyebrow}: ${title}. ${bullets.join(' ')} ${footer}`}
    >
      <Text
        style={{
          color: colors.primary,
          letterSpacing: 2,
          fontSize: fontSize.xs,
          fontWeight: fontWeight.bold,
          fontFamily: fontFamily.display,
        }}
      >
        {eyebrow}
      </Text>
      <Text
        style={{
          color: colors.textStrong,
          fontSize: fontSize.md,
          fontWeight: fontWeight.bold,
          fontFamily: fontFamily.display,
        }}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {bullets.map((line, idx) => (
        <Text
          key={`${eyebrow}-${idx}`}
          style={{
            color: colors.text,
            fontSize: fontSize.sm,
            lineHeight: fontSize.sm * 1.4,
          }}
        >
          · {line}
        </Text>
      ))}
      <Text
        style={{
          color: colors.textMuted,
          fontSize: fontSize.xs,
          letterSpacing: 0.5,
          marginTop: spacing[1],
        }}
      >
        {footer}
      </Text>
    </View>
  );
}
