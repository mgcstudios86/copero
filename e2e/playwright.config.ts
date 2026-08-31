import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

/**
 * Playwright config — E2E web para Copero (Expo web build).
 *
 * Scope MGC-302: infraestructura E2E. El spec inicial valida que el
 * harness se levanta. Cobertura funcional completa vive en MGC-293.
 *
 * baseURL parametrizable via EXPO_WEB_BASE_URL para CI/local.
 *
 * El archivo de config vive en `e2e/playwright.config.ts`. `testDir`
 * resuelve relativo al config file, así que usamos `'.'` (=> `e2e/`)
 * para descubrir `e2e/home.spec.ts`. Si se mueve el config a la raíz
 * del repo, ajustar a `./e2e`.
 */
const PORT = process.env.EXPO_WEB_PORT ?? '8081';
const BASE_URL =
  process.env.EXPO_WEB_BASE_URL ??
  (process.env.CI ? `http://127.0.0.1:${PORT}` : 'http://localhost:8081');

// MGC-377: anclar outputDir y HTML reporter a rutas absolutas (resolve(__dirname, ...))
// para que no dependan del cwd del proceso Playwright. Cuando se invoca con
// --config=e2e/playwright.config.ts, Playwright hace process.chdir(dirname(configFile))
// y cwd pasa a e2e/. Si outputDir es relativo, queda acoplado al cwd del runner y puede
// drift entre runners (Linux VPS vs macOS ARM64) o entre invocaciones desde repo root
// vs e2e/. Tambien permite que el upload-artifact del workflow apunte a un path estable
// desde repo root (e2e/.results, e2e/playwright-report).
const RESULTS_DIR = resolve(__dirname, '.results');
const HTML_REPORT_DIR = resolve(__dirname, 'playwright-report');

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: false, // QA agent corre secuencial sobre hardware persistente
  forbidOnly: !!process.env.CI,
  // MGC-459: 1 retry era insuficiente para flakes de carga del runner
  // copero-ci (RAM 954MB) tras 5+ specs pesados. 2 retries da margen
  // para que el dev server se recupere del swap-thrash entre specs.
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  // MGC-377: añadir HTML reporter en CI (siempre, no solo on-failure) para que el
  // artefacto playwright-report contenga index.html + resumen por spec en cada run.
  // open:'never' evita que Playwright intente abrir el browser en el runner headless.
  reporter: process.env.CI
    ? [['html', { outputFolder: HTML_REPORT_DIR, open: 'never' }], ['github'], ['list']]
    : [['html', { outputFolder: HTML_REPORT_DIR, open: 'never' }], 'list'],
  outputDir: RESULTS_DIR,
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    // MGC-459: 60s da holgura cuando el dev server queda bajo swap
    // después de specs visuales/axe/keyboard. Specs rápidos no se ven
    // afectados — page.goto retorna apenas DOM listo.
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // En CI: workflow hace `npm run build:web` y sirve dist/ vía scripts/serve-spa.py
    // (MGC-374). Necesitamos SPA fallback para rutas deep como
    // /simulador-carrera/identity que no existen como archivo en dist/.
    // `python3 -m http.server` devuelve 404 y rompe ~12 specs (MGC-399).
    // En local asume `npx expo start --web` corriendo en :8081 (SPA por
    // defecto).
    // cwd apunta a la raíz del proyecto: Playwright por default usa el dir
    // del config (e2e/), y desde ahí `dist/` no existe.
    command: process.env.CI
      ? `python3 ${resolve(__dirname, '..', 'scripts', 'serve-spa.py')} --port ${PORT} --root "${resolve(__dirname, '..', 'dist')}"`
      : 'npx expo start --web --port 8081',
    url: BASE_URL,
    cwd: resolve(__dirname, '..'),
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
