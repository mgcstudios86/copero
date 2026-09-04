/**
 * VersionBadge — MGC-1506 / MGC-1586
 *
 * Etiqueta compacta `vX.Y.Z (N)` para usar como slot global de versión.
 * Lée del build instalado con la misma fuente de verdad que
 * `src/components/VersionLabel.tsx` (MGC-1498 / PR #378, fix MGC-1586):
 *
 *   1. `Constants.nativeAppVersion` / `Constants.nativeBuildVersion` —
 *      lectura directa del binario nativo (Info.plist / BuildConfig).
 *   2. Fallback a `Constants.expoConfig` (version + android.versionCode)
 *      si los nativos no están disponibles (dev client sin sync).
 *   3. Hard fallback "0.0.1" / 0 cuando nada está disponible.
 *
 * Variantes:
 * - `corner`  → posicionado absolute (usado en pantallas sin SiteHeader global).
 * - `inline`  → fluye dentro del contenedor padre (usado en SiteHeader).
 *
 * Estilo fijo (audit UX MGC-1500 hallazgo UX-002 P0):
 *   fontSize.xs · colors.textMuted · letterSpacing 1 · no interactivo.
 *
 * A11y:
 *   - `accessibilityRole="text"` con label localizado que incluye
 *     `version` + `build` para TalkBack / VoiceOver.
 */
import React from 'react';
import { Text, View, type ViewStyle, type TextStyle } from 'react-native';
// eslint-disable-next-line import/no-named-as-default
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../useTheme';

export type VersionBadgeVariant = 'corner' | 'inline';

export type VersionBadgeProps = {
  /** "corner" = absolute top-right (over header). "inline" = fluye normal (SiteHeader). */
  variant?: VersionBadgeVariant;
  /** Offset horizontal para variant="corner". Default spacing[3]. */
  rightOffset?: number;
  /** Offset vertical adicional para variant="corner". Default 4. */
  topOffset?: number;
  testID?: string;
};

export function VersionBadge({
  variant = 'inline',
  rightOffset,
  topOffset = 4,
  testID = 'app-version-badge',
}: VersionBadgeProps) {
  const { colors, fontSize, fontWeight, fontFamily, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  // MGC-1586: priorizar lectura nativa (real APK) sobre expoConfig (stale).
  const versionName =
    Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? '0.0.1';
  const versionCode = (() => {
    const native = Constants.nativeBuildVersion;
    if (native != null) {
      const n = Number(native);
      if (Number.isFinite(n)) return n;
    }
    const cfgCode = Constants.expoConfig?.android?.versionCode;
    if (cfgCode != null) return cfgCode;
    return 0;
  })();

  const a11yLabel = `Versión ${versionName} build ${versionCode}`;

  const textStyle: TextStyle = {
    color: colors.textMuted,
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.regular,
    letterSpacing: 1,
    lineHeight: Math.round(fontSize.xs * 1.2),
  };

  if (variant === 'corner') {
    const cornerStyle: ViewStyle = {
      position: 'absolute',
      top: insets.top + topOffset,
      right: rightOffset ?? spacing[3],
      zIndex: 30,
      // El badge NO debe capturar taps — patrón equivalente al slot
      // bottom-right del SiteHeader. TalkBack lo lee como texto via
      // accessibilityRole="text", no como botón.
      pointerEvents: 'none',
    };
    return (
      <View
        style={cornerStyle}
        testID={testID}
        accessibilityRole="text"
        accessibilityLabel={a11yLabel}
        pointerEvents="none"
      >
        <Text style={textStyle}>v{versionName} ({versionCode})</Text>
      </View>
    );
  }

  // inline → usado dentro de SiteHeader (esquina inferior derecha del header).
  const inlineWrap: ViewStyle = {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  };
  return (
    <View
      style={inlineWrap}
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={a11yLabel}
    >
      <Text style={textStyle}>v{versionName} ({versionCode})</Text>
    </View>
  );
}

export default VersionBadge;
