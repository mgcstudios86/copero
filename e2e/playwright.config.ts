import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — E2E web para Copero (Expo web build).
 *
 * Scope MGC-302: infraestructura E2E. El spec inicial valida que el
 * harness se levanta. Cobertura funcional completa vive en MGC-293.
 *
 * baseURL parametrizable via EXPO_WEB_BASE_URL para CI/local.
 */
const BASE_URL = process.env.EXPO_WEB_BASE_URL ?? 'http://localhost:8081';

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: false, // QA agent corre secuencial sobre hardware persistente
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  outputDir: './e2e/.results',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // En CI el workflow hace `npm run build:web` y sirve dist/ vía http-server.
    // En local asume `npx expo start --web` corriendo en :8081.
    command: process.env.CI ? 'npx http-server dist -p 8081 -s' : 'npx expo start --web --port 8081',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
