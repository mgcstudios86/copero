import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../useTheme';
import { useReducedMotion } from '../useReducedMotion';

/**
 * Ticker — MGC-555 PR3.
 *
 * Fila negra sólida con partidos en vivo que se desplaza horizontalmente de
 * forma continua. Spec visual copero.com.ar §6.1:
 *   - bg #000 sólido (no usa `colors.bg` para mantener contraste visual con
 *     el `colors.surface` del Header que va encima — la barra debe leerse
 *     como una "cinta" separada).
 *   - altura ~64px desktop / 80px mobile (auto-ajusta por items).
 *   - items ~120px ancho, separador 1px `colors.border` (en negro, semitraslúcido).
 *   - auto-scroll infinito via `Animated.loop` con `translateX` + reset.
 *   - pausa en hover (web) / press (native).
 *
 * A11y:
 *   - contenedor con `accessibilityRole="header"` no (no es header semántico);
 *     se marca `accessible` con label genérico "Resultados en vivo".
 *   - cada item es un `View` decorativo (`importantForAccessibility="no"` para
 *     no spammear TalkBack con N items en loop); el caller puede reemplazar
 *     por items interactivos via `renderItem`.
 *   - pausa de scroll respeta `prefers-reduced-motion` (MGC-337 LOW #5):
 *     cuando `useReducedMotion()` es true, el scroll se desactiva y los items
 *     se muestran estáticos dentro del viewport (sin overflow).
 *
 * Datos:
 *   - `items` mínimo 1; si se pasa vacío se renderiza placeholder "Sin
 *     resultados en vivo" (no rompe layout, evita bucle vacío).
 *   - el contenido se duplica 2× en runtime para crear el efecto de loop
 *     infinito sin gap visible entre fin e inicio.
 */

export type TickerMatch = {
  /** Identificador estable (key). */
  id: string;
  /** Abreviatura equipo local (3-4 chars, ej "BOC"). */
  homeAbbr: string;
  /** Abreviatura equipo visitante. */
  awayAbbr: string;
  /** Score local o null si no empezó. */
  homeScore: number | null;
  /** Score visitante o null si no empezó. */
  awayScore: number | null;
  /** Estado / hora a mostrar debajo. */
  status: string;
};

export type TickerProps = {
  items: TickerMatch[];
  /** Velocidad en píxeles/segundo del scroll. Default 30. */
  speedPxPerSec?: number;
  /** testID E2E. */
  testID?: string;
  /** Si true, no scrollea (override manual; reducido-motion también lo aplica). */
  paused?: boolean;
};

const TICKER_BG = '#000000';
const ITEM_WIDTH = 120;
const ITEM_GAP = 0;
const SEPARATOR = 'rgba(255, 255, 255, 0.12)';

export function Ticker({ items, speedPxPerSec = 30, testID = 'copero-ticker', paused }: TickerProps) {
  const { colors, spacing, fontSize, lineHeight, fontWeight, fontFamily, borderWidth } =
    useTheme();
  const reducedMotion = useReducedMotion();
  const isPaused = paused ?? reducedMotion;
  const styles = TickerStyles;

  // Duplicamos items para loop visual sin gap; la animación recorre el ancho
  // del primer set y resetea a 0 (módulo).
  const loopItems = useMemo(() => [...items, ...items], [items]);
  // Animated.Value mutable entre renders vía useState lazy initializer. Mismo
  // patrón que `RoundTimer.tsx` — `useRef(new X).current` viola
  // `react-hooks/refs` porque accede a `.current` durante render.
  const [translateX] = useState(() => new Animated.Value(0));
  const loopWidth = (ITEM_WIDTH + ITEM_GAP) * Math.max(items.length, 1);

  useEffect(() => {
    if (isPaused || items.length === 0) {
      translateX.setValue(0);
      return;
    }
    const durationMs = Math.max(2000, (loopWidth / Math.max(1, speedPxPerSec)) * 1000);
    const loop = Animated.loop(
      Animated.timing(translateX, {
        toValue: -loopWidth,
        duration: durationMs,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [isPaused, items.length, loopWidth, speedPxPerSec, translateX]);

  const containerStyle: ViewStyle = {
    backgroundColor: TICKER_BG,
    borderTopWidth: borderWidth.hairline,
    borderBottomWidth: borderWidth.hairline,
    borderColor: SEPARATOR,
    overflow: 'hidden',
  };

  if (items.length === 0) {
    return (
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel="Sin resultados en vivo"
        testID={testID}
        style={[containerStyle, styles.empty]}
      >
        <Text
          style={{
            color: 'rgba(255,255,255,0.6)',
            fontFamily: fontFamily.body,
            fontSize: fontSize.sm,
            lineHeight: fontSize.sm * lineHeight.snug,
            fontWeight: fontWeight.medium,
          }}
        >
          Sin resultados en vivo
        </Text>
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Resultados en vivo: ${items.length} partidos`}
      testID={testID}
      // En web, :hover pausa el scroll vía stylesheet inyectado en runtime.
      // En native, el Pressable interno de cada item pausa (no implementado
      // en este PR — los items son decorativos por contrato a11y).
      style={containerStyle}
    >
      <Animated.View
        style={{
          flexDirection: 'row',
          transform: [{ translateX }],
        }}
      >
        {loopItems.map((m, idx) => (
          <TickerItem
            key={`${m.id}-${idx}`}
            match={m}
            text={colors.text}
            textMuted={colors.textMuted}
            borderColor={SEPARATOR}
            spacing={spacing}
            fontSize={fontSize}
            lineHeight={lineHeight}
            fontWeight={fontWeight}
            fontFamily={fontFamily}
          />
        ))}
      </Animated.View>
    </View>
  );
}

type ItemTokens = {
  text: string;
  textMuted: string;
  borderColor: string;
  spacing: typeof import('../tokens').spacing;
  fontSize: typeof import('../tokens').fontSize;
  lineHeight: typeof import('../tokens').lineHeight;
  fontWeight: typeof import('../tokens').fontWeight;
  fontFamily: typeof import('../tokens').fontFamily;
};

function TickerItem({
  match,
  text,
  textMuted,
  borderColor,
  spacing,
  fontSize,
  lineHeight,
  fontWeight,
  fontFamily,
}: { match: TickerMatch } & ItemTokens) {
  return (
    <View
      importantForAccessibility="no"
      style={{
        width: ITEM_WIDTH,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
        borderRightWidth: 1,
        borderRightColor: borderColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
        <Text
          style={{
            color: text,
            fontFamily: fontFamily.body,
            fontSize: fontSize.sm,
            lineHeight: fontSize.sm * lineHeight.tight,
            fontWeight: fontWeight.semibold,
          }}
        >
          {match.homeAbbr}
        </Text>
        <Text
          style={{
            color: textMuted,
            fontFamily: fontFamily.body,
            fontSize: fontSize.sm,
            lineHeight: fontSize.sm * lineHeight.tight,
            fontWeight: fontWeight.regular,
          }}
        >
          {match.homeScore != null && match.awayScore != null
            ? `${match.homeScore}–${match.awayScore}`
            : '–'}
        </Text>
        <Text
          style={{
            color: text,
            fontFamily: fontFamily.body,
            fontSize: fontSize.sm,
            lineHeight: fontSize.sm * lineHeight.tight,
            fontWeight: fontWeight.semibold,
          }}
        >
          {match.awayAbbr}
        </Text>
      </View>
      <Text
        style={{
          color: textMuted,
          fontFamily: fontFamily.body,
          fontSize: fontSize.xs,
          lineHeight: fontSize.xs * lineHeight.snug,
          fontWeight: fontWeight.regular,
          marginTop: 2,
        }}
        numberOfLines={1}
      >
        {match.status}
      </Text>
    </View>
  );
}

export const TickerStyles = StyleSheet.create({
  empty: { paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
});
