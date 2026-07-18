import tseslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';
export default [
  {
    ignores: [
      'node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser },
    plugins: { '@typescript-eslint': tseslint },
    rules: { '@typescript-eslint/no-unused-vars': 'error' },
  },
];
