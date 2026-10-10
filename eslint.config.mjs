import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

const sourceFiles = ['**/*.{js,mjs,cjs,jsx,ts,tsx}'];
const frontendFiles = ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'];

export default defineConfig([
  globalIgnores([
    'node_modules/**', '.next/**', 'dist/**', 'out/**', 'build/**',
    'backend/dist/**', 'backend/public/**', 'public/**', 'reports/**',
    '.semgrep/tests/**', 'next-env.d.ts', '**/*.tsbuildinfo',
  ]),
  {
    ...js.configs.recommended,
    files: sourceFiles,
    languageOptions: { ecmaVersion: 2022, globals: globals.node },
    rules: {
      ...js.configs.recommended.rules,
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-new-wrappers': 'error',
      'no-constructor-return': 'error',
      'no-prototype-builtins': 'error',
      eqeqeq: ['error', 'smart'],
    },
  },
  ...tseslint.configs.recommended.map((configuration) => ({
    ...configuration,
    files: ['**/*.{ts,tsx}'],
  })),
  { ...reactHooks.configs.flat.recommended, files: frontendFiles },
  { files: frontendFiles, languageOptions: { globals: globals.browser } },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
  {
    files: ['backend/src/**/*.ts'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
]);
