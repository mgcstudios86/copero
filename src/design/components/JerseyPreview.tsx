import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getCountryPalette, type CountryPalette } from '@/design/tokens';
import { deriveContrastDorsal } from './jersey-contrast';

/**
 * JerseyPreview — camiseta de espaldas con dorsal + apellido (MGC-466).
 *
 * Renderiza el patrón visual de país usando `countryPalette` (MGC-465).
 * Los assets SVG originales (`design/simulador-carrera/assets/jerseys/*.svg`)
 * sirven como referencia de diseño. Este componente reproduce el mismo patrón
 * (bandas vertical-thin / canarinho / block / azzurri / three-lions /
 * three-stripes / celeste) con Views nativos — sin requerir
 * `react-native-svg` — para mantener compatibilidad cross-platform
 * (iOS/Android/Web) y evitar agregar dependencias.
 *
 * Contraste dorsal/jersey: cada dorsal se renderiza con `palette.dorsal`,
 * color verificado AA WCAG 2.x (≥ 4.5:1) por el diseñador en MGC-465.
 *
 * Props:
 *  - countryCode: código ISO-2 (AR, BR, ES, …). Si no está en el set top-12,
 *    cae a `unknown` (gris oscuro con dorsal claro).
 *  - number: dorsal numérico (1–99). Vacío → muestra "—".
 *  - name: apellido o nombre corto. Vacío → muestra "Tu nombre".
 *  - size: 'sm' (96×128) | 'md' (160×200, default) | 'lg' (240×320).
 *
 * Mantiene testID y roles a11y para compatibilidad con e2e/mgc-462-*.spec.ts.
 */
export type JerseyPreviewSize = 'sm' | 'md' | 'lg';

export interface JerseyPreviewProps {
  /**
   * MGC-1802 P1-1 + cleanup — código ISO-2 (AR, BR, ES, …) opcional.
   * Si se pasa `paletteOverride`, `countryCode` se ignora (no se manda
   * sentinel `'unknown'` para forzar la rama neutra — antes el dashboard
   * hackeaba `countryCode='unknown'` cuando había club override y la
   * dependencia entre ambos props quedó implícita). Ahora basta con
   * omitir `countryCode` para que el componente caiga al palette
   * override sin contaminar el type con sentinels string-typed.
   */
  countryCode?: string;
  number: number | string;
  name: string;
  size?: JerseyPreviewSize;
  testID?: string;
  /**
   * MGC-1802 P1-1 — paleta custom (colores club). Si está presente,
   * sobreescribe `countryCode`. Usado por dashboard cuando el jugador
   * fichó por un club: el jersey muestra los colores del club
   * (`crestColor` + `crestAccent`) en vez de la bandera del país.
   *
   * MGC-1950 (PR #464 cleanup CTO): todas las claves son OPCIONALES.
   * `dorsal` se deriva del contraste WCAG contra `primary` cuando se
   * omite; `pattern` siempre cae al del `countryCode` (jerseys club
   * son block-style). El shape `Partial<...>` evita que el dashboard
   * tenga que mandar dorsales sentinel cuando el contrato del club no
   * lo provee — antes esto rompía `tsc --noEmit` con TS2322.
   */
  paletteOverride?: Partial<
    Pick<CountryPalette, 'primary' | 'secondary' | 'accent' | 'dorsal' | 'name'>
  >;
}

const SIZES: Record<JerseyPreviewSize, { w: number; h: number; numSize: number; nameSize: number }> = {
  sm: { w: 96, h: 128, numSize: 40, nameSize: 11 },
  md: { w: 160, h: 200, numSize: 64, nameSize: 13 },
  lg: { w: 240, h: 320, numSize: 96, nameSize: 18 },
};

/**
 * MGC-1950 (PR #464 cleanup CTO) — el algoritmo de derivación del
 * contraste WCAG vive en `./jersey-contrast` (exportado y testeado de
 * forma independiente). Aquí sólo invocamos `deriveContrastDorsal`
 * cuando el override omite `dorsal`.
 */

function renderPattern(palette: CountryPalette, w: number, h: number): React.ReactNode {
  const { primary, secondary, accent, pattern } = palette;
  // Cuerpo de la camiseta: clip básico rectangular con esquinas suaves.
  const bodyStyle = {
    position: 'absolute' as const,
    top: 6,
    left: 6,
    right: 6,
    bottom: 6,
    borderRadius: 14,
    backgroundColor: secondary,
    overflow: 'hidden' as const,
  };

  switch (pattern) {
    case 'vertical-thin':
      // AR / UY: 3 franjas verticales claras sobre fondo blanco.
      return (
        <View style={bodyStyle}>
          <View style={[styles.fill, { backgroundColor: primary, width: w * 0.21 }]} />
          <View style={[styles.fill, { backgroundColor: primary, width: w * 0.21, left: w * 0.395 }]} />
          <View style={[styles.fill, { backgroundColor: primary, width: w * 0.21, left: w * 0.79 }]} />
          <View style={[styles.fill, { backgroundColor: accent, height: 4, top: 4 }]} />
        </View>
      );
    case 'canarinho':
      // BR: cuerpo amarillo con banda diagonal verde y cuello azul.
      return (
        <View style={bodyStyle}>
          <View style={[styles.fill, { backgroundColor: primary }]} />
          <View
            style={[
              styles.fill,
              {
                backgroundColor: secondary,
                height: h * 0.35,
                top: h * 0.45,
                transform: [{ rotate: '-12deg' }],
              },
            ]}
          />
          <View style={[styles.fill, { backgroundColor: accent, height: 6, top: 0 }]} />
        </View>
      );
    case 'azzurri':
      // IT: azul liso con detalle blanco al costado.
      return (
        <View style={bodyStyle}>
          <View style={[styles.fill, { backgroundColor: primary }]} />
          <View
            style={[
              styles.fill,
              { backgroundColor: secondary, width: w * 0.08, left: w * 0.25 },
            ]}
          />
          <View
            style={[
              styles.fill,
              { backgroundColor: secondary, width: w * 0.08, left: w * 0.66 },
            ]}
          />
          <View style={[styles.fill, { backgroundColor: accent, height: 6, top: 0 }]} />
        </View>
      );
    case 'three-lions':
      // EN: blanco con dos bandas rojas (hombros) y cuello oscuro.
      return (
        <View style={bodyStyle}>
          <View style={[styles.fill, { backgroundColor: primary }]} />
          <View
            style={[
              styles.fill,
              { backgroundColor: secondary, height: h * 0.18, top: h * 0.06 },
            ]}
          />
          <View
            style={[
              styles.fill,
              {
                backgroundColor: secondary,
                height: h * 0.18,
                top: h * 0.06,
                left: w * 0.6,
                right: 0,
              },
            ]}
          />
          <View style={[styles.fill, { backgroundColor: accent, height: 6, top: 0 }]} />
        </View>
      );
    case 'three-stripes':
      // DE: blanco con tres bandas verticales negras.
      return (
        <View style={bodyStyle}>
          <View style={[styles.fill, { backgroundColor: primary }]} />
          <View
            style={[
              styles.fill,
              { backgroundColor: secondary, width: w * 0.12, left: w * 0.3 },
            ]}
          />
          <View
            style={[
              styles.fill,
              { backgroundColor: secondary, width: w * 0.12, left: w * 0.58 },
            ]}
          />
          <View style={[styles.fill, { backgroundColor: accent, height: 6, top: 0 }]} />
        </View>
      );
    case 'celeste':
      // UY: celeste liso con franja blanca angosta central.
      return (
        <View style={bodyStyle}>
          <View style={[styles.fill, { backgroundColor: primary }]} />
          <View
            style={[
              styles.fill,
              { backgroundColor: secondary, width: w * 0.06, left: w * 0.47 },
            ]}
          />
          <View style={[styles.fill, { backgroundColor: accent, height: 6, top: 0 }]} />
        </View>
      );
    case 'block':
    default:
      // ES / FR / MX / PT / CO / CL / unknown: cuerpo con bloque de color (mitad).
      return (
        <View style={bodyStyle}>
          <View style={[styles.fill, { backgroundColor: secondary }]} />
          <View
            style={[
              styles.fill,
              {
                backgroundColor: primary,
                height: h * 0.55,
                top: h * 0.45,
              },
            ]}
          />
          <View
            style={[
              styles.fill,
              {
                backgroundColor: accent,
                width: w * 0.08,
                left: w * 0.46,
                top: 0,
                bottom: 0,
              },
            ]}
          />
        </View>
      );
  }
}

export function JerseyPreview({
  countryCode,
  number,
  name,
  size = 'md',
  testID = 'jersey-preview',
  paletteOverride,
}: JerseyPreviewProps): React.ReactElement {
  // MGC-1802 cleanup — fallback explícito cuando NO hay countryCode
  // (caso club override). Antes el dashboard hackeaba con sentinel
  // string `'unknown'`; ahora la ausencia del prop cae a `unknown`
  // palette de forma type-safe sin contaminar el contrato.
  const countryPalette = useMemo(
    () => getCountryPalette(countryCode ?? 'unknown'),
    [countryCode],
  );
  // MGC-1950 (PR #464 cleanup CTO) — si hay paletteOverride, ganamos sobre
  // el país. Mantenemos `pattern` del countryPalette (overrides proveen
  // solo colores, no pattern — jerseys club son siempre block-style).
  // Si el override NO incluye `dorsal`, lo derivamos maximizando el
  // contraste WCAG contra las 3 capas renderizadas (primary + secondary
  // + accent). Esto evita el bug de PR #459 donde dorsal=crestAccent
  // quedaba invisible cuando crestColor≈crestAccent.
  // MGC-1950: paletteOverride es `Partial<...>`, así que cualquier clave
  // puede faltar. Resolvemos defaults seguros antes de derivar el dorsal
  // y aplicamos el override contra countryPalette con spread.
  let palette: CountryPalette = countryPalette;
  if (paletteOverride) {
    const resolvedPrimary = paletteOverride.primary ?? countryPalette.primary;
    const resolvedSecondary = paletteOverride.secondary ?? countryPalette.secondary;
    const resolvedAccent = paletteOverride.accent ?? countryPalette.accent;
    const resolvedDorsal =
      paletteOverride.dorsal ??
      deriveContrastDorsal({
        primary: resolvedPrimary,
        secondary: resolvedSecondary,
        accent: resolvedAccent,
      }).color;
    const resolvedName = paletteOverride.name ?? countryPalette.name;
    palette = {
      ...countryPalette,
      primary: resolvedPrimary,
      secondary: resolvedSecondary,
      accent: resolvedAccent,
      dorsal: resolvedDorsal,
      name: resolvedName,
      pattern: countryPalette.pattern,
    };
  }
  const dim = SIZES[size];
  const displayNumber = number === '' || number === null || number === undefined ? '—' : String(number);
  const displayName = (name ?? '').trim() || 'Tu nombre';

  return (
    <View
      testID={testID}
      accessibilityRole="image"
      accessibilityLabel={`Camiseta de ${palette.name}, dorsal ${displayNumber}, ${displayName}`}
      style={[
        styles.container,
        {
          width: dim.w,
          height: dim.h,
          borderColor: palette.accent,
        },
      ]}
    >
      {/* Cuello (curva superior simulada con dos Views) */}
      <View
        style={[
          styles.neck,
          {
            borderBottomColor: palette.dorsal,
            borderBottomWidth: 2,
          },
        ]}
      />
      {/* Cuerpo de la camiseta con el patrón del país */}
      <View
        style={[styles.body, { width: dim.w, height: dim.h }]}
        accessibilityElementsHidden
      >
        {renderPattern(palette, dim.w, dim.h)}
      </View>
      {/* Apellido */}
      <Text
        testID="jersey-name"
        numberOfLines={1}
        style={[
          styles.name,
          {
            color: palette.dorsal,
            fontSize: dim.nameSize,
            top: dim.h * 0.32,
          },
        ]}
      >
        {displayName.toUpperCase()}
      </Text>
      {/* Dorsal */}
      <Text
        testID="jersey-number"
        numberOfLines={1}
        style={[
          styles.number,
          {
            color: palette.dorsal,
            fontSize: dim.numSize,
            top: dim.h * 0.55,
          },
        ]}
      >
        {displayNumber}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
  },
  neck: {
    position: 'absolute',
    top: 0,
    left: '30%',
    right: '30%',
    height: 12,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    zIndex: 2,
  },
  body: {
    position: 'relative',
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  name: {
    position: 'absolute',
    left: 8,
    right: 8,
    textAlign: 'center',
    fontWeight: '700',
    letterSpacing: 2,
    zIndex: 3,
  },
  number: {
    position: 'absolute',
    left: 8,
    right: 8,
    textAlign: 'center',
    fontWeight: '700',
    zIndex: 3,
  },
});
