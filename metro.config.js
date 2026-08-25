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

module.exports = config;