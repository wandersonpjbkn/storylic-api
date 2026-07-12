import js from '@eslint/js'
import globals from 'globals'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'
import importPlugin from 'eslint-plugin-import'
import sonarjs, { configs as sonarjsConfigs } from 'eslint-plugin-sonarjs'
import security from 'eslint-plugin-security'

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
      security,
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
      ...security.configs.recommended.rules,

      // eslint-plugin-security — relaxamentos por regra e justificados:
      // ruído em qualquer acesso `obj[key]` (ex.: acesso a mapas de config).
      'security/detect-object-injection': 'off',
      // a API usa fs com caminho de env de propósito (existsSync(PUBLIC_DIR),
      // res.sendFile no modo LAN) — ver app.ts.
      'security/detect-non-literal-fs-filename': 'off',

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
