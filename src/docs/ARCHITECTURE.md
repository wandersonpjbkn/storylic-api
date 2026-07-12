# Architecture — Storylic API

> Estado real do repositório. Histórico: [`CHANGELOG`](../../CHANGELOG.md).

## Stack ✅

- **Node ≥ 20**, **TypeScript** (NodeNext, imports com `.js`), **Express** +
  **Socket.io**, **helmet** + **cors**. Estado **em memória** (sem banco).
- Dev: `tsx watch` (`yarn dev`); build: `tsc && tsc-alias` → `dist/`.

## Composição ✅

- **`src/app.ts` → `createGameServer()`** monta Express + Socket.io e registra
  todos os handlers, **sem** dar `listen` (permite subir em porta efêmera nos
  testes). Serve `/health` e, se `PUBLIC_DIR` estiver setado, o build do frontend
  (modo LAN).
- **`src/server.ts`** é só o entrypoint: chama `createGameServer()` e dá `listen`.
- **`src/handlers/*`** — **um arquivo por evento** de socket. Assinatura
  `(io, socket) => socket.on(EVENT, handler)`.

## Store em memória ✅

`src/utils/games.ts` — um `Map<gameId, Game>`. `Game` guarda `players`
(`Map<socketId, Player>` na ordem de entrada), `currentPlayer`, `currentTurn`,
`turns`, `gameState`, `turnStartedAt`, `turnDurationMs`, `timerTurn/Story` e o
`turnTimer` (watchdog). Limites: **12 salas**, **12 jogadores**/sala.
`cleanupInactiveRooms` remove salas sem jogadores online após 1h.

## Máquina de estados (servidor) ✅

O servidor só distingue **`lobby | playing | ended`** (as fases waiting/
storytelling são distinções locais do cliente). `start-game` → `playing`;
`finish-storytelling`/watchdog avançam o turno; ao fim → `ended`; `reset-game` →
`lobby`.

## Autoridade do turno — watchdog ✅

`src/utils/turns.ts` centraliza a rotação:

- **`advanceTurn(io, gameId, game)`** passa a vez ao **próximo jogador online**
  (pula vagas reservadas/desconectadas), vira a rodada ou encerra. Usado por
  `finish-storytelling`, `leave-game` e pela expiração de reserva.
- **`armTurnWatchdog`** agenda um timeout autoritativo
  (`turnDurationMs + timerStory + TURN_GRACE_MS`): se o jogador da vez travar,
  minimizar o app ou cair, o servidor avança sozinho. O cliente é só o mostrador.

## Reconexão e reserva de vaga ✅

- No `disconnect`, a vaga do jogador fica **reservada** por `RESERVATION_TTL_MS`
  (60s, configurável). `rejoin-game` valida o **token** (comparação
  timing-safe, `utils/tokens.ts`), reassocia o novo `socket.id`, **rotaciona o
  token** e devolve o estado + `remainingTurnMs`.
- Se a reserva expira, `expireReservation` remove o jogador e, se era a vez dele,
  passa o turno (`pickNextOnlinePlayer`).

## Guardas ✅

- **Validação** de todo payload (`utils/validate.ts`): `gameId` minúsculo seguro,
  nome, timers, turnos, formato do token.
- **Rate limit** por socket e evento (`utils/rateLimiter.ts`); e **rate limit
  HTTP** (`express-rate-limit`) nas rotas de arquivo do modo LAN (teto generoso
  para o Wi-Fi do clube).
- **CORS** por origem (obrigatório em produção via `CORS_ORIGIN`).
- `cards-selected` só é aceito do jogador da vez, com id vindo do servidor.

## Modo LAN ✅

`PUBLIC_DIR=../storylic/dist yarn start` faz esta API servir o frontend buildado —
jogo 100% offline num notebook. `TURN_GRACE_MS` e `RESERVATION_TTL_MS` são
configuráveis por env. Ver `PROJECT_STATE`.
