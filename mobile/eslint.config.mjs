import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { FlatCompat } from '@eslint/eslintrc';

// eslint-plugin-react-hooks no es dependencia del APK a proposito: EAS corre
// `npm ci` contra el lockfile de mobile/ y agregarla ahi ya rompio builds. Se
// toma la copia que trae eslint-config-next en la raiz del monorepo.
const requireFromNext = createRequire(
  createRequire(import.meta.url).resolve('eslint-config-next'),
);
const reactHooks = requireFromNext('eslint-plugin-react-hooks');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: ['node_modules/', '.next/', 'dist/', 'build/', '*.config.js'],
  },
  ...compat.extends('prettier'),
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        __DEV__: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      // General code quality rules
      'no-console': 'warn',
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',

      // React Native/React rules
      'react/display-name': 'off',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',

      // Hooks: las reglas de React que evitan bucles y cierres viejos
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  ...compat.extends('plugin:@typescript-eslint/recommended'),
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // TypeScript strict rules
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // Disable problematic TypeScript rules for React Native
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
];

export default eslintConfig;
