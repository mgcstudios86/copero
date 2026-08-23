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
  },
};
