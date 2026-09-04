/**
 * VersionLabel — MGC-1498 / MGC-1586
 *
 * Muestra `Versión X.Y.Z (N)` en la UI leyendo del build instalado.
 *
 * Fuente de verdad (en orden de preferencia):
 *   1. `Constants.nativeAppVersion` / `Constants.nativeBuildVersion` —
 *      leídos directamente del build nativo instalado (Info.plist
 *      `CFBundleVersion` / `BuildConfig.VERSION_CODE` en Android).
 *      Estos reflejan la versión real del APK en el device.
 *   2. Fallback a `Constants.expoConfig` (version + android.versionCode)
 *      si los valores nativos no están disponibles (dev client sin
 *      sync). Antes era el primario; ver MGC-1586: con
 *      `cli.appVersionSource: remote` en eas.json el embedded
 *      expoConfig queda stale (app.config.js versionCode: 15)
 *      mientras que el APK real lleva el versionCode remoto.
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

  // MGC-1586: priorizar lectura nativa (real APK) sobre expoConfig (stale).
  // Con `cli.appVersionSource: remote` el server EAS inyecta el versionCode
  // en el binario nativo, pero `Constants.expoConfig` queda pineado al
  // app.config.js original (drift). El device muestra 15 cuando el APK es 56.
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
