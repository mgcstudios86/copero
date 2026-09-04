/**
 * VersionLabel — MGC-1498
 *
 * Muestra `Versión X.Y.Z (N)` en la UI leyendo del build instalado.
 *
 * Fuente de verdad (en orden de preferencia):
 *   1. `Constants.expoConfig` (version + android.versionCode): confiables
 *      cuando `appVersionSource: remote` en eas.json está alineado.
 *   2. Fallback a `Constants.nativeAppVersion` / `Constants.nativeBuildVersion`
 *      si el config no expone los valores (dev client sin sync).
 *
 * Uso:
 *   - Home (`app/index.tsx`) — bajo el `© YYYY Copero`, accesible
 *     al abrir la app para diagnóstico rápido.
 *
 * No se monta en el splash nativo: el splash es comportamiento del OS
 * pre-JS; agregar texto JS requeriría demorar el `SplashScreen.hideAsync`,
 * peor UX. La versión queda visible apenas el JS bundle hidrata (home).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
// eslint-disable-next-line import/no-named-as-default
import Constants from 'expo-constants';
import { useTheme } from '@/design';

type Props = {
  /** "subtle" = xs + muted (footer). "prominent" = sm + onAccent (hero). */
  tone?: 'subtle' | 'prominent';
  testID?: string;
};

export function VersionLabel({ tone = 'subtle', testID = 'app-version-label' }: Props) {
  const { colors, fontSize, fontWeight, fontFamily } = useTheme();

  const cfg = Constants.expoConfig;
  const versionName =
    cfg?.version ?? Constants.nativeAppVersion ?? '0.0.1';
  const versionCode =
    cfg?.android?.versionCode ?? Constants.nativeBuildVersion ?? 15;

  const palette =
    tone === 'prominent'
      ? { color: colors.textOnAccent, size: fontSize.sm, weight: fontWeight.medium }
      : { color: colors.textMuted, size: fontSize.xs, weight: fontWeight.regular };

  return (
    <View
      style={styles.wrap}
      accessibilityRole="text"
      accessibilityLabel={`Versión ${versionName} build ${versionCode}`}
    >
      <Text
        testID={testID}
        style={{
          color: palette.color,
          fontSize: palette.size,
          fontWeight: palette.weight,
          fontFamily: fontFamily.body,
          letterSpacing: tone === 'prominent' ? 1.2 : 0.8,
        }}
      >
        Versión {versionName} ({versionCode})
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default VersionLabel;
