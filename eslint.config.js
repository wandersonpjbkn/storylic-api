import js from '@eslint/js'
import globals from 'globals'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'
import importPlugin from 'eslint-plugin-import'
import sonarjs, { configs as sonarjsConfigs } from 'eslint-plugin-sonarjs'

export default defineConfig([
  {
    files: ['src/**/*.ts'],

    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
      parser: tseslint.parser,
      parserOptions: {
        project: true,
      },
    },

    plugins: {
      '@typescript-eslint': tseslint.plugin,
      import: importPlugin,
      sonarjs,
    },

    extends: [js.configs.recommended, ...tseslint.configs.recommended],

    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
        },
      },
    },

    rules: {
      ...sonarjsConfigs.recommended.rules,

      // helmet roda com CSP desativada de propósito (a política vem do host/CDN
      // do frontend, não desta API de socket) — decisão pré-existente, ver app.ts.
      'sonarjs/content-security-policy': 'off',

      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',

      'no-console': 'off',

      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal'],
          alphabetize: { order: 'asc' },
        },
      ],
    },
  },

  globalIgnores(['**/dist/**']),
])
