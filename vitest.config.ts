import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}', '__tests__/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/', 'dist/', '.expo/'],
    reporters: process.env.CI ? ['basic', 'github'] : ['default'],
  },
});
