/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        copero: {
          bg: '#09090B',
          surface: '#101012',
          surface2: '#131316',
          border: '#1C1C20',
          borderStrong: '#27272A',
          text: '#FAFAFA',
          muted: '#A1A1AA',
          accent: '#00E676',
          accentDeep: '#00B85A',
          amber: '#FBBF24',
          amberDeep: '#F59E0B',
          yellow: '#FFD500',
          rose: '#FF5470',
        },
      },
      fontFamily: {
        display: ['"Archivo Black"', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        copero: '14px',
      },
      boxShadow: {
        glow: '0 0 24px rgba(0, 230, 118, 0.35)',
      },
    },
  },
  plugins: [],
};