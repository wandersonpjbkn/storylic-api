import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const srcDir = fileURLToPath(new URL('./src', import.meta.url))

// The code uses NodeNext-style imports (`@/foo.js`) pointing at `.ts` files.
// The first alias rewrites `@/algo.js` → `src/algo.ts`; the second covers
// extension-less imports (e.g. `@/constants/socketEvents`).
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/(.*)\.js$/, replacement: `${srcDir}/$1.ts` },
      { find: '@', replacement: srcDir },
    ],
  },
  test: {
    environment: 'node',
    globals: true,
    // Timers curtos para os testes de integração exercitarem watchdog e reserva
    // sem esperar os defaults de produção.
    env: {
      TURN_GRACE_MS: '0',
      RESERVATION_TTL_MS: '1500',
    },
    exclude: ['dist/**', 'node_modules/**'],
  },
})
