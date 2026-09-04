/**
 * VersionLabel — MGC-1498 / MGC-1586 / MGC-1602
 *
 * Muestra `Versión X.Y.Z (N)` en la UI leyendo del build instalado.
 *
 * Fuente de verdad (en orden de preferencia):
 *   1. `Application.nativeApplicationVersion` /
 *      `Application.nativeBuildVersion` (`expo-application`) — leídos
 *      directamente del `PackageManager` nativo (Android) o `Info.plist`
 *      (iOS). Reflejan la versión real del binario instalado en el
 *      device.
 *   2. Fallback a `Constants.expoConfig` (version + android.versionCode)
 *      si los nativos no están disponibles (dev client sin sync). Antes
 *      era el primario; ver MGC-1586: con `cli.appVersionSource: remote`
 *      en eas.json el embedded expoConfig queda stale
 *      (app.config.js versionCode: 15) mientras que el APK real lleva
 *      el versionCode remoto.
 *
 * MGC-1602: el intento previo (PR-396) intentó leer
 * `Constants.nativeBuildVersion` directamente, pero `expo-constants` 57
 * ya NO expone `nativeBuildVersion` desde el módulo nativo
 * (ConstantsService.kt retorna solo sessionId / executionEnvironment /
 * statusBarHeight / deviceName / systemFonts / systemVersion / manifest
 * / platform). Por eso siempre retornaba `null` y caía al fallback
 * stale de `expoConfig.android.versionCode` (=15 pineado en
 * app.config.js). El reemplazo canónico es
 * `expo-application.Application.nativeBuildVersion`, que sí lee
 * `info.versionCode.toLong()` desde `PackageManager.getPackageInfo()`
 * — el valor REAL del APK instalado.
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
import * as Application from 'expo-application';
import { useTheme } from '@/design';

type Props = {
  /** "subtle" = xs + muted (footer). "prominent" = sm + onAccent (hero). */
  tone?: 'subtle' | 'prominent';
  testID?: string;
};

export function VersionLabel({ tone = 'subtle', testID = 'app-version-label' }: Props) {
  const { colors, fontSize, fontWeight, fontFamily } = useTheme();

  // MGC-1586 / MGC-1602: priorizar lectura nativa (real APK) sobre
  // expoConfig (stale). Con `cli.appVersionSource: remote` el server EAS
  // inyecta el versionCode en el binario nativo, pero `Constants.expoConfig`
  // queda pineado al app.config.js original (drift).
  //
  // MGC-1602: usar `expo-application` directamente. `Constants.nativeBuildVersion`
  // quedó deprecated y `expo-constants` 57 ya no lo expone desde nativo
  // (ConstantsService.kt), por lo que siempre retornaba null y caía al
  // fallback stale (=15). `Application.nativeBuildVersion` lee
  // `info.versionCode.toLong()` desde PackageManager — el valor REAL.
  const versionName =
    Application.nativeApplicationVersion ??
    Constants.nativeAppVersion ??
    Constants.expoConfig?.version ??
    '0.0.1';
  const versionCode = (() => {
    const native = Application.nativeBuildVersion;
    if (native != null) {
      const n = Number(native);
      if (Number.isFinite(n)) return n;
    }
    const fallbackNative = Constants.nativeBuildVersion;
    if (fallbackNative != null) {
      const n = Number(fallbackNative);
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
