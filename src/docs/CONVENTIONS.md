# Code Conventions — Storylic API

> As-built. Histórico: [`CHANGELOG`](../../CHANGELOG.md).

## Idioma ✅

- **Código em inglês**; **logs e mensagens de erro ao usuário em português**
  (ex.: `join-error` com `reason` legível). Comentários explicam o **porquê**.
- **Exceção — testes:** comentários em `__tests__/` podem ser pt-BR, no estilo
  Given/When/Then (Dado/Quando/Então).

## TypeScript ✅

- **Arrow functions por padrão**; `const`; tipar o público.
- **Imports NodeNext com `.js`** (o `tsc-alias` resolve `@/*` no build; o
  `vitest.config.ts` reescreve `@/algo.js` → `src/algo.ts` nos testes).
- Tipos compartilhados em `src/types/index.ts`.

## Estrutura ✅

- **Um handler por evento** em `src/handlers/`, assinatura `(io, socket)`.
- **Estado e helpers de jogo** em `src/utils/games.ts`; **rotação/watchdog** em
  `src/utils/turns.ts`; nunca duplicar a lógica de avanço de turno — reusar
  `advanceTurn`.
- **A criação do servidor** mora em `app.ts` (`createGameServer`), sem `listen`;
  `server.ts` só sobe. Isso mantém o servidor testável.

## Segurança / robustez (regra de projeto) ✅

- **Não confiar no cliente:** validar todo payload, derivar identidade do
  `socket.id`, não confiar em campos como `numPlayers`/`playerNumber`.
- **O jogo não pode travar:** todo caminho que mexe no jogador da vez
  (finish/leave/disconnect) tem de manter o turno avançando; o watchdog é a rede
  de segurança final.
- Segredos e timings (`TURN_GRACE_MS`, `RESERVATION_TTL_MS`, CORS) por env.

## Lint ✅

`eslint` (flat config em `eslint.config.js`, ESM) + typescript-eslint +
`eslint-plugin-sonarjs` + **`eslint-plugin-security`** (`recommended`).
Relaxamentos **por regra e justificados** (ex.: `security/detect-non-literal-fs-filename`
— fs por env no modo LAN; `security/detect-object-injection` — acesso a mapas de
config). `resolutions` de `typescript` deduplica a árvore (destrava o SonarJS) e
também **fixa versões corrigidas de deps transitivas** (CVEs de `qs`, `ws`,
`path-to-regexp`, `socket.io-parser`).

## Segurança ✅

Ver [`TESTING`](TESTING.md#segurança-local-sem-ci-): **`yarn security`** (deps +
anti-padrões, rápido) e **`yarn security:deep`** (CodeQL local, profundo). Sem CI.
