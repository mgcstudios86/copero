module.exports = {
  root: true,
  extends: [
    'expo',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import'],
  settings: {
    'import/resolver': {
      typescript: { project: './tsconfig.json' },
      node: true,
    },
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'web-build/',
    '.expo/',
    '*.config.js',
    '*.config.cjs',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'import/no-unresolved': 'error',
    // eslint-plugin-react-hooks@7 introduces stricter rules
    // (`refs`, `set-state-in-effect`) que no aplican al patrón
    // Animated core de RN. CelebrationModal y playoff usan
    // `useRef(new Animated.Value()).current` (API oficial RN Animated)
    // y `setState` en useEffect para sincronizar con bracket state
    // derivado. Mantener React Native core Animated es decisión de
    // arquitectura (MGC-601) — no se migra a Reanimated en este PR.
    'react-hooks/refs': 'off',
    'react-hooks/set-state-in-effect': 'off',
  },
};
