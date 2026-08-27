import { defineConfig } from 'vite'
import type { UserConfig as VitestUserConfig } from 'vitest'

const config: VitestUserConfig = {
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['./tests/setup.ts'],
  },
}

export default defineConfig(config)
