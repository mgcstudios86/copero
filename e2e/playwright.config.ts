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
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  outputDir: './.results',
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
    // En CI el workflow hace `npm run build:web` y sirve dist/ vía python3 http.server.
    // En local asume `npx expo start --web` corriendo en :8081.
    // cwd apunta a la raíz del proyecto: Playwright por default usa el dir
    // del config (e2e/), y desde ahí `dist/` no existe.
    command: process.env.CI
      ? `python3 -m http.server ${PORT} --bind 127.0.0.1 --directory "${resolve(__dirname, '..', 'dist')}"`
      : 'npx expo start --web --port 8081',
    url: BASE_URL,
    cwd: resolve(__dirname, '..'),
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
