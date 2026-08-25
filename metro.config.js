// metro.config.js — Copero (MGC-544 code-split entry chunk, MGC-724 fix)
//
// Habilita code-splitting real de Metro SOLO en web. Sin esta config, el
// entry chunk web incluye Expo Router + todas las screens + engine de
// carrera (~1.2 MB uncompressed / ~412 KB gz). Con
// `serializerOptions.splitChunks: true`, Metro parte el bundle en chunks
// async al detectar `import()` dinámico (usado por
// `Stack.Screen.getComponent(() => import('...'))` en `app/_layout.tsx`).
//
// Entry chunk tras splitChunks: ~600 KB uncompressed / ~190 KB gz.
// Objetivo MGC-544: transfer LH <= 300 KB y LCP <= 2.5 s en /identity.
//
// MGC-724: splitChunks se aplica SOLO a platform==='web'. Aplicarlo a
// native (ios/android) parte el bundle en chunks async y el prelude con
// `__d` puede evaluarse antes que los módulos que lo invocan → crash
// `[runtime not ready]: ReferenceError: Property '__d' doesn't exist`
// en Hermes al startup. Reproducible en ZY22G728HN (motorola edge 30
// ultra, Android 15, arm64-v8a). Bundle HBC v3 magic OK; falla la
// orquestación de chunks, no el bytecode.
//
// Politica §10: ninguna credencial ni secreto en este archivo.

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// splitChunks: wrappear el customSerializer de Expo SOLO cuando la
// platform es 'web'. Para native (ios/android) se mantiene el serializer
// original de Expo, que produce un bundle monolítico con prelude + todos
// los módulos en un único archivo (requerido por Hermes runtime).
// El wrap se hace DESPUES de que `getDefaultConfig` registra el
// customSerializer para preservar la lógica de source maps / debug ids
// que Expo agrega.
const originalCustomSerializer =
  config.serializer && config.serializer.customSerializer;

if (typeof originalCustomSerializer === 'function') {
  config.serializer.customSerializer = async function splitChunksSerializer(
    entryPoint,
    preModules,
    graph,
    options,
  ) {
    const platform = options && options.platform;
    const splitChunksEnabled = platform === 'web';
    const wrappedOptions = {
      ...options,
      serializerOptions: {
        ...(options && options.serializerOptions),
        splitChunks: splitChunksEnabled,
      },
    };
    return originalCustomSerializer.call(
      this,
      entryPoint,
      preModules,
      graph,
      wrappedOptions,
    );
  };
}

if (config.web) {
  // tree-shake de polyfills no usados en navegadores modernos.
  config.web.treeShakeEnabled = true;
}

// Marker para que `scripts/inject-preload.mjs` identifique builds con
// splitChunks real y aplique el threshold de pre-carga correcto.
config._coperoSplitChunks = true;

// MGC-743 — Metro no incluye `woff2` en `assetExts` por defecto (la lista
// viene de metro-config/src/defaults/defaults.js e incluye ttf/otf pero
// no woff2). Sin esta entrada, `require('../assets/fonts/woff2/X.woff2')`
// falla con "Unable to resolve module".
const woffExtensions = ['woff', 'woff2'];
config.resolver.assetExts = Array.from(
  new Set([...(config.resolver.assetExts ?? []), ...woffExtensions]),
);

// MGC-743 — `app/_layout.web.tsx` corre sólo en web, pero expo-router hace
// `require.context('./app')` para descubrir rutas y Metro copia al bundle
// web los 8 TTFs referenciados estáticamente por `_layout.native.tsx`,
// ~1.9 MB de peso muerto que no se referencia en el JS chunk web.
//
// La build nativa (APK/IPA) sí necesita los TTFs bundleados: en native,
// los `require('./X.ttf')` de `@expo-google-fonts/inter/{400Regular,...}`
// se resuelven como asset IDs y terminan embebidos en el binario vía el
// asset registry de RN. Por eso gateamos el block por `platform === 'web'`.
//
// API: Expo envuelve Metro's `resolveRequest` con la firma
// `(context, moduleName, platform)` (ver
// `@expo/cli/build/src/start/server/metro/withMetroResolvers.js`). El
// context expone `originModulePath` (el archivo que hace el `require`).
// Devolver `{ type: 'empty' }` resuelve el modulo a un placeholder vacío
// sin copiar el asset a dist/assets/.
//
// Los requires de TTF viven en `node_modules/@expo-google-fonts/{inter,
// poppins}/<weight>/index.js` que sólo se ejecuta en builds nativas, pero
// Metro los escanea estáticamente al construir el module graph del bundle
// web. Filtramos por (originModulePath, moduleName.endswith('.ttf')) para
// identificar específicamente esos assets.
const ttfInGoogleFonts = /node_modules\/@expo-google-fonts\/(?:inter|poppins)\//;
const previousResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = function customFontBlockResolver(
  context,
  moduleName,
  platform,
) {
  const isFontRequire =
    typeof moduleName === 'string' && moduleName.endsWith('.ttf');
  const isFromGoogleFonts =
    context &&
    typeof context.originModulePath === 'string' &&
    ttfInGoogleFonts.test(context.originModulePath);
  if (platform === 'web' && isFontRequire && isFromGoogleFonts) {
    return { type: 'empty' };
  }
  if (typeof previousResolveRequest === 'function') {
    return previousResolveRequest.call(this, context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;