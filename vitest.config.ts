import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // MGC-363 — mock react-native para que vitest SSR no parsee los
      // archivos .js con Flow types (Rollup SSR transform emite parse
      // error "Expected 'from', got 'typeOf'" al cruzar la barrera de
      // tipos cuando se importa `AppState` directamente desde el entry
      // `react-native/index.js`). El mock expone solo lo que usa el
      // código bajo test.
      'react-native': path.resolve(__dirname, 'tests/mocks/react-native.ts'),
    },
  },
  // MGC-1523 — define `__DEV__` para que expo-modules-core, arrastrado por
  // expo-constants al importarse VersionBadge (re-export en
  // src/design/components/index.ts:37) desde el barrel de tests, no falle
  // con `ReferenceError: __DEV__ is not defined` en environment:node.
  // El runtime de Expo lo inyecta en bundle/web/native; vitest no.
  define: {
    __DEV__: 'true',
  },
  test: {
    globals: false,
    // MGC-2512 — tests/engine-decisions.test.ts usa `window.localStorage`,
    // setDebugMode y otras APIs del DOM. Con `environment: 'node'` falla
    // con `ReferenceError: window is not defined`. Cambiar a `jsdom` para
    // que las pruebas del motor de simulación tengan DOM real (los demás
    // tests siguen pasando porque jsdom no rompe APIs de node).
    environment: 'jsdom',
    // MGC-2548 — jsdom 25 no expone `window.localStorage` (opaque origin en
    // Node 22+); el polyfill vive en tests/setup.ts y debe correr antes de
    // los tests para que `beforeEach` no falle con `Cannot read properties
    // of undefined (reading 'clear')`.
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', '__tests__/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/', 'dist/', '.expo/'],
    // CI usa reporter 'basic' (resumido). El reporter 'github' requiere
    // el paquete opcional @vitest/reporters en el lockfile — no lo agregamos
    // como dep para mantener el árbol chico.
    reporters: process.env.CI ? ['basic'] : ['default'],
  },
});
