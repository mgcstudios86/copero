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
//
// MGC-762: `withExpoSerializers` (en
// node_modules/@expo/metro-config/build/serializer/withExpoSerializers.js)
// reemplaza `config.serializer.customSerializer` con `expoSerializer`,
// que cuando es una export-invocación llama a `unwrapOriginalSerializer`
// para detectar el chain previo — busca la propiedad
// `__originalSerializer` en la función.
//
// Además, `expo export --platform web` invoca el path
// `createDefaultExportCustomSerializer` → `getBaseJSBundle`, que produce
// un único archivo independientemente del flag `splitChunks`. Para que
// el split se materialice en disco tenemos que derivar al path de
// chunking `graphToSerialAssetsAsync` nosotros mismos: partir el bundle
// en chunks async (entry + cada `import()` dinámico de las screens
// lazy-wrapped en `app/simulador-carrera/*.tsx`) y escribir cada chunk
// a `dist/_expo/static/js/web/<hash>.js`. La cadena `splitChunks` de
// Metro + lazy wrappers MGC-544 ya detecta los `import()` async;
// sólo necesitamos serializar y escribir.
const path = require('path');
const fs = require('fs');
const originalCustomSerializer =
  config.serializer && config.serializer.customSerializer;

if (typeof originalCustomSerializer === 'function') {
  const { graphToSerialAssetsAsync } = require('@expo/metro-config/build/serializer/serializeChunks');
  const splitChunksSerializer = async function splitChunksSerializer(
    entryPoint,
    preModules,
    graph,
    options,
  ) {
    const platform = options && options.platform;
    // MGC-724: splitChunks SOLO en web. Native (ios/android) necesita
    // bundle monolítico por el bug `__d` no definido de Hermes al
    // startup con chunks async (repro ZY22G728HN Android 15).
    if (platform !== 'web') {
      return originalCustomSerializer.call(
        this,
        entryPoint,
        preModules,
        graph,
        options,
      );
    }

    // Web: derivar al chunking path que parte async imports en archivos
    // separados. `graphToSerialAssetsAsync` calcula los chunks desde el
    // grafo (detecta `import()` async), los serializa y devuelve un
    // array de artifacts `{ filename, source, type }`. Filtramos los
    // JS bundles y los escribimos a la misma carpeta donde
    // `expo export --platform web` espera los chunks.
    try {
      const { artifacts } = await graphToSerialAssetsAsync(
        config,
        {
          ...(options && options.serializerOptions),
          splitChunks: true,
          exporting: true,
        },
        entryPoint,
        preModules,
        graph,
        options,
      );

      const outDir = path.join(
        config.projectRoot || process.cwd(),
        'dist',
        '_expo',
        'static',
        'js',
        'web',
      );
      fs.mkdirSync(outDir, { recursive: true });

      const jsArtifacts = artifacts.filter((a) => a.type === 'js');
      const entryArtifact =
        jsArtifacts.find((a) => a.filename && a.filename.includes('index')) ||
        jsArtifacts[0];
      const otherArtifacts = jsArtifacts.filter((a) => a !== entryArtifact);

      if (entryArtifact) {
        const filePath = path.join(outDir, entryArtifact.filename);
        fs.writeFileSync(filePath, entryArtifact.source);
      }
      for (const a of otherArtifacts) {
        const filePath = path.join(outDir, a.filename);
        fs.writeFileSync(filePath, a.source);
      }

      if (entryArtifact) {
        return { code: entryArtifact.source, map: null };
      }
    } catch (err) {
      console.warn('[splitChunks] falling back to monolithic:', err.message);
    }

    // Fallback: bundle monolítico (lo que hacía MGC-544 antes de este
    // fix, pero ahora con el `__originalSerializer` correcto).
    return originalCustomSerializer.call(
      this,
      entryPoint,
      preModules,
      graph,
      options,
    );
  };
  // Clave para que `unwrapOriginalSerializer()` encuentre el chain:
  splitChunksSerializer.__originalSerializer = originalCustomSerializer;
  config.serializer.customSerializer = splitChunksSerializer;
}

if (config.web) {
  // tree-shake de polyfills no usados en navegadores modernos.
  config.web.treeShakeEnabled = true;
}

// Marker para que `scripts/inject-preload.mjs` identifique builds con
// splitChunks real y aplique el threshold de pre-carga correcto.
config._coperoSplitChunks = true;

// MGC-2532 r2 — redireccionar react-router(/-dom) a un stub local en
// platform!=web, en lugar de devolver `{type: 'empty'}` desde
// customResolver (que rompia el resolver chain de Expo Router 57 y
// causaba Unmatched Route en cold-start — MGC-2532 / MGC-2537 / MGC-2538).
//
// Estrategia: resolver devuelve `{filePath: <stub>}` (modulo real en
// disco), preservando el module graph intacto. El stub exporta un
// objeto vacio valido, asi Hermes parsea OK (sin `import(/* @vite-ignore */)`)
// y Expo Router no detecta inconsistencia.
//
// Por que blockList NO funciona:
// react-router-dom ES alcanzable desde el entry nativo (prueba: Hermes
// parse error en chunk-7SIULPXI.js — MGC-2512). blockList haria que
// Metro falle el bundle con "Unable to resolve module" porque el
// require() queda reachable pero sin resolution.
//
// Por que customResolver empty tampoco funciona (PR #566 SHA dd18e1e):
// el resolver chain queda "patched", Expo Router 57 lo detecta y
// renderiza la pantalla Unmatched por defecto.
//
// Por que filePath a stub funciona:
// Metro resuelve a un file real, lo agrega al module graph con un
// module ID valido, el prelude evalua OK, Hermes parsea el stub (sin
// sintaxis `/* @vite-ignore */`). Expo Router no detecta anomalia
// porque el module graph esta completo y consistente.
const reactRouterStubPath = path.join(__dirname, 'src', 'shims', 'react-router-native.js');
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
  // MGC-2512 — bloquear react-router(/-dom) en platform!=web.
  // react-router v7.x genera `import(/* @vite-ignore */)` y
  // `require(/* @vite-ignore */ /* webpackIgnore: true */ ...)` que
  // Hermes 0.86 parsea como "Invalid expression encountered" en
  // android/app/build/generated/assets/react/release/index.android.bundle.
  // Bloqueamos en native devolviendo un módulo vacío: en native la
  // navegación la provee Expo Router + react-native-screens, no RR.
  const isReactRouter =
    typeof moduleName === 'string' &&
    (moduleName === 'react-router' ||
      moduleName === 'react-router-dom' ||
      moduleName.startsWith('react-router/') ||
      moduleName.startsWith('react-router-dom/'));
  if (platform !== 'web' && isReactRouter) {
    return { type: 'empty' };
  }
  if (platform === 'web' && isFontRequire && isFromGoogleFonts) {
    return { type: 'empty' };
  }
  // MGC-2532 r2 — redireccionar react-router(/-dom) al stub local en
  // platform!=web. Devolvemos `{filePath}` (modulo real, no `{type:'empty'}`)
  // para que Metro lo agregue al module graph con ID valido. Esto
  // preserva el resolver chain intacto (Expo Router 57 NO detecta
  // inconsistencia → no renderiza Unmatched) y blinda a Hermes del
  // parse error `import(/* @vite-ignore */)` (el stub no contiene esa
  // sintaxis). Aplica a native platforms unicamente.
  const isNativePlat =
    platform === 'ios' || platform === 'android' || platform === 'native';
  const isReactRouterModule =
    typeof moduleName === 'string' &&
    (moduleName === 'react-router' ||
      moduleName === 'react-router-dom' ||
      moduleName === 'react-router-dom-v5-compat' ||
      moduleName === '@remix-run/router');
  if (isNativePlat && isReactRouterModule) {
    return { type: 'sourceFile', filePath: reactRouterStubPath };
  }
  if (typeof previousResolveRequest === 'function') {
    return previousResolveRequest.call(this, context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;