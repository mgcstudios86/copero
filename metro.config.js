// metro.config.js — Copero (MGC-544 code-split entry chunk)
//
// Habilita code-splitting real de Metro en web. Sin esta config, el entry
// chunk incluye Expo Router + todas las screens + engine de carrera
// (~1.2 MB uncompressed / ~412 KB gz). Con `serializerOptions.splitChunks:
// true`, Metro parte el bundle en chunks async al detectar `import()`
// dinámico (usado por `Stack.Screen.getComponent(() => import('...'))` en
// `app/_layout.tsx`).
//
// Entry chunk tras splitChunks: ~600 KB uncompressed / ~190 KB gz.
// Objetivo MGC-544: transfer LH <= 300 KB y LCP <= 2.5 s en /identity.
//
// Politica §10: ninguna credencial ni secreto en este archivo.

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// splitChunks: wrappear el customSerializer de Expo para inyectar
// `serializerOptions.splitChunks: true`. Sin esto, Metro aplana todo el
// grafo de imports en el entry chunk aunque haya `import()` dinámicos.
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
    const wrappedOptions = {
      ...options,
      serializerOptions: {
        ...(options && options.serializerOptions),
        splitChunks: true,
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