import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}', '__tests__/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/', 'dist/', '.expo/'],
    // CI usa reporter 'basic' (resumido). El reporter 'github' requiere
    // el paquete opcional @vitest/reporters en el lockfile — no lo agregamos
    // como dep para mantener el árbol chico.
    reporters: process.env.CI ? ['basic'] : ['default'],
  },
});
