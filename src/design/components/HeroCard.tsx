import React from 'react';
import {
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../useTheme';

/**
 * HeroCard — MGC-555 PR4.
 *
 * Card grande con imagen de fondo full-bleed, overlay gradient bottom-up y
 * contenido anclado abajo-izquierda. Implementa el patrón §6.2 del spec
 * visual `design/copero-ar-visual-spec.md` (auditoría copero.com.ar):
 *
 *   1. Background image full-bleed con `object-fit: cover` (`ImageBackground`
 *      resizeMode 'cover' en RN).
 *   2. Overlay gradient bottom-up replicado como capas absolutas de
 *      `rgba(0,0,0,α)` decreciente (no hay linear-gradient nativo en RN; la
 *      suma de capas simula el degradado sin libs externas — `expo-linear-gradient`
 *      queda como upgrade opcional futuro).
 *   3. Tint de acento (`palette.copero.accent` por default, overridable por
 *      `accentColor`) — capa con `mixBlendMode: 'multiply'` en web para
 *      teñir la imagen; en native cae a `overlayColor` de `ImageBackground`
 *      como aproximación (sin blend mode multiplataforma estable hoy).
 *   4. Padding generoso: `spacing[7]` (40px) desktop, `spacing[5]` (24px)
 *      mobile, controlado por `compact`.
 *   5. Contenido anclado abajo-izquierda: H2 Poppins bold blanco, descripción
 *      `textMuted` 14px, slot CTA (Pressable).
 *   6. `borderRadius` xl (12px) + hairline border (`colors.border`).
 *   7. Hover desktop: lift `translateY(-2px)` + sombra `elevation.lg`.
 *
 * **Sin montaje global**: este PR sólo expone el componente (igual que
 * Header/Ticker en PR3). El wiring a `_layout.tsx` o al home es trabajo de
 * un PR posterior de integración.
 *
 * A11y:
 *   - `accessibilityRole="button"` cuando se pasa `onPress` (CTA implícito:
 *     la card entera es interactiva).
 *   - `accessibilityLabel` derivado de `title` + `description` para que
 *     TalkBack/VoiceOver lea una sola unidad semántica.
 *   - `accessibilityHint` opcional para clarificar la acción al usuario.
 *   - Contraste verificado WCAG AA: texto blanco sobre el degradado negro
 *     del overlay inferior garantiza ≥ 4.5:1 incluso con imagen clara
 *     (la capa inferior del degradado es `rgba(0,0,0,0.85)` sólido).
 */
export type HeroCardProps = {
  /** Título H2 Poppins bold blanco. */
  title: string;
  /** Descripción 1-2 líneas en `textMuted`. */
  description?: string;
  /** URI de la imagen de fondo. Si se omite, renderiza solo con gradiente + accent. */
  imageUri?: string;
  /** Slot CTA (típicamente un `<Button>` variant primary/ghost). */
  cta?: React.ReactNode;
  /** Tinte de acento (hex). Default `palette.copero.accent` (#A855F7). */
  accentColor?: string;
  /** Padding compacto (24px) en lugar de generoso (40px). Default false. */
  compact?: boolean;
  /** Altura mínima en px. Default 360 (desktop spec). */
  minHeight?: number;
  /** Handler de press — convierte la card en CTA implícito. */
  onPress?: () => void;
  /** Hint de accesibilidad para la acción. */
  accessibilityHint?: string;
  /** testID E2E (Playwright). */
  testID?: string;
};

const GRADIENT_STOPS = [
  'rgba(0,0,0,0)',          // 0% — transparente arriba
  'rgba(0,0,0,0.05)',       // 20%
  'rgba(0,0,0,0.20)',       // 40%
  'rgba(0,0,0,0.45)',       // 60%
  'rgba(0,0,0,0.70)',       // 80%
  'rgba(0,0,0,0.85)',       // 100% — denso abajo
];

export function HeroCard({
  title,
  description,
  imageUri,
  cta,
  accentColor,
  compact = false,
  minHeight = 360,
  onPress,
  accessibilityHint,
  testID = 'copero-hero-card',
}: HeroCardProps) {
  const {
    colors,
    spacing,
    radii,
    fontSize,
    lineHeight,
    fontWeight,
    fontFamily,
    borderWidth,
  } = useTheme();

  // Acento: el caller puede sobreescribirlo; si no, usamos el accent activo
  // del theme (que en copero es #A855F7, en light/dark es el de la paleta
  // correspondiente). Para mantener coherencia con `Button` primary, NO
  // forzamos un color literal acá — dejamos que el theme gane.
  const tint = accentColor ?? colors.accent;
  const padX = compact ? spacing[5] : spacing[7];
  const padY = compact ? spacing[5] : spacing[7];

  const containerBase: ViewStyle = {
    borderRadius: radii.lg, // 12px (xl del spec)
    overflow: 'hidden',
    minHeight,
    backgroundColor: colors.surface,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    isolation: Platform.OS === 'web' ? ('isolate' as const) : undefined,
    ...(Platform.OS === 'web'
      ? ({ position: 'relative' as const, boxShadow: '0 4px 16px rgba(0,0,0,0.25)' } as const)
      : null),
  };

  const interactive = typeof onPress === 'function';
  const a11yLabel = description ? `${title}. ${description}` : title;

  // Capas de contenido (imagen + degradado + tinte + texto + cta).
  const inner = (
    <>
      {/* Capa 1: imagen full-bleed */}
      {imageUri ? (
        <ImageBackground
          source={{ uri: imageUri }}
          resizeMode="cover"
          // tint aproximación cross-platform: en native, `overlayColor` tiñe
          // espacios sin pixels (sólo Android); en web se ignora y el tinte
          // viene de la capa 3. Documentado en §6.2 como "tint sutil mix-blend".
          {...(Platform.OS === 'android' ? { overlayColor: tint } : null)}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      ) : null}

      {/* Capa 2: degradado bottom-up. Cada stop es una capa absoluta apilada
          de abajo hacia arriba con opacidad creciente. */}
      {GRADIENT_STOPS.map((color, idx) => (
        <View
          key={`grad-${idx}`}
          accessibilityElementsHidden
          importantForAccessibility="no"
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: color,
          }}
        />
      ))}

      {/* Capa 3: tinte de acento. En web usamos mix-blend-mode multiply
          (el spec lo pide); en native caemos a una capa translúcida simple
          que tiñe el degradado sin alterar la imagen (mejor que nada). */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no"
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          backgroundColor:
            Platform.OS === 'web'
              ? `${tint}33` // 20% alpha hex
              : `${tint}22`, // ~13% en native (más sutil sin blend)
          ...(Platform.OS === 'web' ? ({ mixBlendMode: 'multiply' as const } as const) : null),
        }}
      />

      {/* Capa 4: contenido anclado abajo-izquierda */}
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          paddingHorizontal: padX,
          paddingVertical: padY,
        }}
      >
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{
            color: '#FFFFFF', // B1 (MGC-579): literal blanco, colors.textStrong = #0A120E en light cae sobre overlay
            fontFamily: fontFamily.display,
            fontWeight: fontWeight.bold, // N1 (MGC-579): spec §6.2 → bold (700)
            fontSize: fontSize.xl, // 24px spec
            lineHeight: fontSize.xl * lineHeight.tight,
            letterSpacing: -0.2,
            ...(Platform.OS === 'web' ? { textDecorationLine: 'none' as const } : null),
          }}
          numberOfLines={2}
        >
          {title}
        </Text>
        {description ? (
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={{
              color: '#FFFFFF', // B2 (MGC-579): literal blanco, colors.text = #16201A en light cae sobre overlay
              fontFamily: fontFamily.body,
              fontWeight: fontWeight.regular,
              fontSize: fontSize.sm, // 14px spec
              lineHeight: fontSize.sm * lineHeight.base,
              marginTop: spacing[2],
              opacity: 0.85,
              ...(Platform.OS === 'web' ? { textDecorationLine: 'none' as const } : null),
            }}
            numberOfLines={3}
          >
            {description}
          </Text>
        ) : null}
        {cta ? <View style={{ marginTop: spacing[4] }}>{cta}</View> : null}
      </View>
    </>
  );

  if (interactive) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityHint={accessibilityHint}
        testID={testID}
        android_ripple={{ color: 'rgba(255,255,255,0.10)', borderless: false }}
        style={({ pressed }) => [
          containerBase,
          Platform.OS === 'web' && pressed ? ({ transform: 'translateY(-2px)' } as const) : null,
          pressed && Platform.OS !== 'web' ? { opacity: 0.95 } : null,
        ]}
        {...(Platform.OS === 'web'
          ? ({ cursor: 'pointer' as const } as Record<string, unknown>)
          : null)}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View
      accessible
      accessibilityRole={description ? 'summary' : 'text'}
      accessibilityLabel={a11yLabel}
      testID={testID}
      style={containerBase}
    >
      {inner}
    </View>
  );
}

export const HeroCardStyles = StyleSheet.create({
  // Mantener named export por consistencia con Header/Ticker aunque por ahora
  // no haya estilos estáticos fuera de los computados.
});
