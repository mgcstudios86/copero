import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '@/design';

/**
 * MGC-782: FAQ — extraído como chunk asincrónico.
 *
 * MGC-658 P1 #8: +2 items (`internet` + `costo`). Resto del contenido
 * preservado 1:1 contra MGC-605. WCAG AA: cada item expone
 * `accessibilityLabel` con pregunta + respuesta combinada.
 *
 * Bloque debajo del fold — vive después del comparador. Lazy-load seguro:
 * la red del chunk asincrónico no compite con el LCP del hero.
 */

const FAQS = [
  {
    q: '¿Cuánto dura una carrera?',
    a: 'Una carrera larga arranca a los 16 y termina cuando tu jugador se retira (cerca de los 35). Cada año trae pretemporada, temporada y ofertas.',
  },
  {
    q: '¿Puedo cambiar de club?',
    a: 'Sí. Cada ventana de transferencias recibís ofertas de otros clubes según tu OVR, edad y reputación. También podés rechazar y quedarte.',
  },
  {
    q: '¿Qué pasa cuando me retiro?',
    a: 'Tu carrera entra en el resumen final: trofeos, estadísticas, clubs y selección. Después podés empezar una nueva.',
  },
  {
    q: '¿Se guarda mi progreso?',
    a: 'Sí, localmente en el dispositivo. Tu carrera persiste entre sesiones mientras no limpies los datos de la app.',
  },
  {
    q: '¿Necesito internet para jugar?',
    a: 'No. La carrera corre 100% en tu dispositivo y se guarda localmente. Sólo necesitás conexión si activás sincronización opcional en la nube.',
  },
  {
    q: '¿Cuánto cuesta Copero?',
    a: 'La app es gratis, sin suscripción y sin compras dentro del juego. Hay un anuncio interstitial entre temporadas que financia el desarrollo.',
  },
] as const;

export function FAQList() {
  const { colors, radii, spacing, fontSize, fontWeight, fontFamily } = useTheme();
  return (
    <View
      testID="faq"
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
        Preguntas frecuentes
      </Text>
      {FAQS.map((item) => (
        <FaqItem key={item.q} q={item.q} a={item.a} />
      ))}
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
