import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// `@shared-i18n` apunta al módulo de copy compartido con la app Expo
// (`src/i18n/`), que es TS plano sin dependencias nativas. Evita duplicar
// las traducciones entre web y mobile (MGC-232).
const SHARED_I18N = path.resolve(__dirname, '../../src/i18n');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared-i18n': SHARED_I18N,
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    fs: {
      allow: [__dirname, SHARED_I18N],
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
});
