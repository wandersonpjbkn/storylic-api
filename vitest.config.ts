import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const srcDir = fileURLToPath(new URL('./src', import.meta.url))

// O código usa imports estilo NodeNext (`@/foo.js`) que apontam para arquivos
// `.ts`. O primeiro alias reescreve `@/algo.js` → `src/algo.ts`; o segundo cobre
// os imports de tipo com `.ts` explícito e os sem extensão.
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
