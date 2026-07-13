# Code Conventions — Storylic API

> As-built. Histórico: [`CHANGELOG`](../../CHANGELOG.md).

## Idioma ✅

- **Inglês:** nomes de variáveis/funções/arquivos, chaves de JSON, mensagens de
  commit, nomes de branch, identificadores em geral e **os comentários de
  código**.
- **Exceção — testes:** comentários em `__tests__/` podem ser pt-BR, no estilo
  Given/When/Then (Dado/Quando/Então).
- **Não ter comentários com o óbvio:** comentários são uma forma de 
explicar pontos pouco intuitivos na leitura. Não devem ser a fonte 
de registro sobre alterações - isso vive no Changelog - ou repetir
o óbvio que pode ser entendido lendo o código.

## Comentários ✅

Priorizar **código legível** > comentário. Comentar o **porquê** (decisão,
contexto não óbvio, armadilha), não o **o quê** (que o código já diz). E
mesmo neste casos os comentários **não devem** registrar passado (eles
devem explicar a situação atual). Informações que expliquem revisões,
alterações ou decisões passadas devem preferir o [`CHANGELOG`](../../CHANGELOG.md).
Em testes, comentar só quando ajuda. Idioma: inglês (ver [Idioma](#idioma-)) —
**exceto em `__tests__/` e `e2e/`**, onde o comentário pode ser em português
(bypass documentado em [Idioma](#idioma-)).

## Código morto ✅

Código, dado ou trecho de documentação sem uso é **removido ao ser encontrado**
— não se mantém "só porque pode ser útil depois". Só permanece se houver um
comentário explícito justificando por que precisa ficar (ex.: `// keep: ...`).

## TypeScript ✅

- **Arrow functions por padrão**; `const`; tipar o público.
- **Imports NodeNext com `.js`** (o `tsc-alias` resolve `@/*` no build; o
  `vitest.config.ts` reescreve `@/algo.js` → `src/algo.ts` nos testes).
- Tipos compartilhados em `src/types/index.ts`.

## Sem duplicação (DRY) ✅

Lógica repetida vira função compartilhada em `src/utils/`, nunca cópia-e-cola
entre handlers. Exemplo já seguido: `removeOfflinePlayer` (`utils/turns.ts`) é
o funil único de "jogador sai para sempre" — `leave-game`, `kick-player` e a
expiração de reserva (`disconnect.ts`) chamam essa mesma função (marca
offline → `advanceTurn` se era a vez dele → apaga do Map) em vez de cada um
reimplementar o trio. O mesmo vale para constantes de timing:
`TURN_GRACE_MS`/`RESERVATION_TTL_MS`/`ROOM_TTL_MS` moram uma vez em
`src/config.ts`, nunca redeclaradas no arquivo que as usa.

## SOLID ✅

Não há classes neste código (funções simples, um handler por evento). Os
cinco princípios ainda se aplicam, traduzidos para handlers/utils/types:

- **S — Responsabilidade única:** um handler em `src/handlers/*` trata
  **um** evento de socket; política compartilhada (rotação de turno, remoção
  de jogador, persistência) vive em `src/utils/*`, nunca inline num handler.
- **O — Aberto/fechado:** um evento novo = um handler novo registrado em
  `app.ts` (`io.on('connection', ...)`) — nunca editar o corpo de um
  `socket.on` existente para acrescentar uma preocupação alheia ao evento.
- **L — Substituição de Liskov:** pouco aplicável aqui (sem variantes
  polimórficas nem herança neste código) — citado por completude, não
  imposto ativamente.
- **I — Segregação de interface:** um campo de payload que o handler nunca
  destrutura é código morto (ver [Código morto](#código-morto-)) — ex.:
  `StartGamePayload`/`FinishStorytellingPayload` só declaram `gameId`,
  porque o servidor deriva o resto sozinho e nunca confia em estado de jogo
  vindo do cliente.
- **D — Inversão de dependência:** um handler nunca toca API de baixo nível
  (timer, Redis) diretamente. `armTurnWatchdog`/`clearTurnTimer`
  (`utils/turns.ts`/`utils/games.ts`) abstraem o `setTimeout` do watchdog;
  `utils/persistence/client.ts`'s `getRedisClient()` é o único lugar que
  importa `ioredis` — `persistGame`/`removeGame`/`loadAllGames`
  (`gameStore.ts`) são o que todo o resto chama, alheio a se o Redis existe
  (`REDIS_URL` vazio ⇒ toda chamada de persistência é um no-op).

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
