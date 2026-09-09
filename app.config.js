/**
 * app.config.js — Copero (MGC-323 / C3)
 *
 * Migración desde app.json para poder consumir secretos en runtime via
 * `process.env.EXPO_PUBLIC_*`. Los valores se inyectan desde Infisical
 * (path=/copero) en CI / EAS; en dev local se leen del `.env` si existe.
 *
 * Política §8.3: builds --local. El Dev Client se activa en `eas.json`
 * perfil `development`. AdMob nativo se monta solo si
 * `EXPO_PUBLIC_ADMOB_ENABLED === 'true'` (TestIds por default).
 *
 * Variables consumidas:
 *   - EXPO_PUBLIC_ADMOB_ENABLED           ('true' | 'false')
 *   - EXPO_PUBLIC_ADMOB_APP_ID_BANNER     (ca-app-pub-... o TestId)
 *   - EXPO_PUBLIC_ADMOB_APP_ID_INTERSTITIAL (ca-app-pub-... o TestId)
 *
 * Política §10 (POLICIES): NO se commitean secretos. Si una variable
 * falta, caemos a TestIds oficiales de Google — la app sigue funcionando
 * y AdMob no muestra tráfico real.
 */

const TEST_IDS = {
  banner: 'ca-app-pub-3940256099942544/6300978111',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
};

const readEnv = (key, fallback) => {
  const v = process.env[key];
  if (v == null || v === '') return fallback;
  return v;
};

const admobEnabled = readEnv('EXPO_PUBLIC_ADMOB_ENABLED', 'false') === 'true';
const admobBannerId = readEnv(
  'EXPO_PUBLIC_ADMOB_APP_ID_BANNER',
  TEST_IDS.banner,
);
const admobInterstitialId = readEnv(
  'EXPO_PUBLIC_ADMOB_APP_ID_INTERSTITIAL',
  TEST_IDS.interstitial,
);

// Plugin `react-native-google-mobile-ads` solo si el paquete está
// instalado en node_modules. Evita romper `expo prebuild` / `expo export`
// en CI web cuando el módulo nativo aún no se agregó al lockfile.
// Para activarlo: `npm install react-native-google-mobile-ads` (ver docs/ads.md).
const admobPlugin = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require.resolve('react-native-google-mobile-ads');
    return [
      [
        'react-native-google-mobile-ads',
        {
          androidAppId: admobEnabled
            ? admobInterstitialId.split('/')[0] || TEST_IDS.interstitial.split('/')[0]
            : TEST_IDS.interstitial.split('/')[0],
          iosAppId: admobEnabled
            ? admobInterstitialId.split('/')[0] || TEST_IDS.interstitial.split('/')[0]
            : TEST_IDS.interstitial.split('/')[0],
        },
      ],
    ];
  } catch {
    return [];
  }
})();

module.exports = ({ config } = {}) => ({
  ...(config ?? {}),
  name: 'Copero',
  slug: 'copero',
  owner: 'mgcstudios',
  scheme: 'copero',
  version: '0.0.1',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  experiments: {
    newArchEnabled: true,
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.mgcstudios.copero',
    infoPlist: {
      // Export compliance: Copero no usa encriptación no-exempt (solo HTTPS estándar).
      // Evita self-classification anual ante Apple BIS.
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.mgcstudios.copero',
    // MGC-1498: versionCode explícito para alinear con app.json. Con
    // `cli.appVersionSource: remote` en eas.json, el server EAS es la
    // fuente de verdad al build; mantener ambos sincronizados evita drift
    // entre `Constants.expoConfig` y `expo-application` en runtime.
    versionCode: 16,
    // MGC-839: NO declarar AD_ID. Per MGC-4919 rootcause, play-services-ads-*
    // AARs autolinkeados la inyectan transitivamente y declarar el permiso
    // no la remueve. Copero no usa ads → Play Console warning se resuelve
    // bloqueando el permiso con `tools:node="remove"` (Expo genera el
    // manifest entry automáticamente desde `blockedPermissions`).
    permissions: [],
    blockedPermissions: ['com.google.android.gms.permission.AD_ID'],
    adaptiveIcon: {
      backgroundColor: '#0B1320',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/splash.png',
        resizeMode: 'contain',
        backgroundColor: '#0B1320',
      },
    ],
    ...admobPlugin,
  ],
  // Variables `extra` quedan accesibles via `expo-constants` en runtime.
  // Los IDs concretos por unidad se leen directo desde process.env
  // en el provider nativo.
  extra: {
    // ProjectId de Expo (MGC-388). Requerido por `eas build --local`
    // para resolver el proyecto antes de invocar builders nativos.
    // Generado vía `eas init --account mgcstudios --non-interactive`
    // contra el proyecto `copero` (slug = `mgcstudios/copero`).
    eas: {
      projectId: '27354a3b-2ab8-46c1-8ed2-2d5448b0e71a',
    },
    admob: {
      enabled: admobEnabled,
      bannerUnitId: admobBannerId,
      interstitialUnitId: admobInterstitialId,
      // TestIds de fallback por si el secret queda vacío en runtime.
      testBannerUnitId: TEST_IDS.banner,
      testInterstitialUnitId: TEST_IDS.interstitial,
    },
    // MGC-1506 — SHA del commit que produjo el build. EAS Build
    // setea `EAS_BUILD_GIT_COMMIT_HASH` automáticamente; en local
    // (`eas build --local`) el operador puede exportar la variable
    // manualmente antes del build, o queda como null y la UI muestra
    // "dev" como fallback. Solo lectura — la fuente de verdad sigue
    // siendo `git rev-parse HEAD` en CI / Mac del developer.
    buildSha: process.env.EAS_BUILD_GIT_COMMIT_HASH || null,
  },
});
