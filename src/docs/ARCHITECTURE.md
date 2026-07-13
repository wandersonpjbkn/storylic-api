# Architecture — Storylic API

> Estado real do repositório. Histórico: [`CHANGELOG`](../../CHANGELOG.md).

## Stack ✅

- **Node ≥ 20**, **TypeScript** (NodeNext, imports com `.js`), **Express** +
  **Socket.io**, **helmet** + **cors**. Estado **em memória** é a fonte da
  verdade em runtime; Redis (**opcional**, via `REDIS_URL`) só espelha um
  snapshot para sobreviver a redeploy/spindown — ver **Persistência**, abaixo.
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
(`Map<socketId, Player>` na ordem de entrada), `owner` (referência estável ao
`Player` que criou a sala — ver seção **Dono da sala**), `currentPlayer`,
`currentTurn`, `turns`, `gameState`, `turnStartedAt`, `turnDurationMs`,
`timerTurn/Story` e o `turnTimer` (watchdog). Limites: **12 salas**, **12
jogadores**/sala — soft cap de **um único processo** (ver **Escala
horizontal**, abaixo). `cleanupInactiveRooms` remove salas sem jogadores
online após 1h.

## Dono da sala ✅

- `Game.owner` é fixado em `join-game` (a primeira pessoa a entrar na sala) e
  **nunca recalculado** — nem por reconexão, nem por "jogar de novo"
  (`reset-game`). Como `rejoin-game` muta o mesmo objeto `Player` (só troca
  `.id` para o socket.id novo, nunca substitui a referência), `game.owner`
  continua válido automaticamente após reconectar.
- Permissões checam `game.owner?.id === socket.id`. Hoje isso governa:
  `config-game` (só dono, e só com `gameState === 'lobby'`) e `kick-player`
  (só dono, permitido em qualquer `gameState`).
- O cliente aprende se é dono via `isCreator` (`join-ack`) e `isOwner`
  (`rejoin-ack`) — não há mais lógica de "primeiro do Map" no cliente nem no
  servidor.

## Máquina de estados (servidor) ✅

O servidor só distingue **`lobby | playing | ended`** (as fases waiting/
storytelling são distinções locais do cliente). `start-game` → `playing`;
`finish-storytelling`/watchdog avançam o turno; ao fim → `ended`; `reset-game` →
`lobby`.

## Autoridade do turno — watchdog ✅

`src/utils/turns.ts` centraliza a rotação:

- **`advanceTurn(io, gameId, game)`** passa a vez ao **próximo jogador online**
  (pula vagas reservadas/desconectadas), vira a rodada ou encerra. Chamado
  diretamente por `finish-storytelling` e pelo próprio watchdog; `leave-game`,
  `kick-player` e a expiração de reserva chegam nele indiretamente, via
  **`removeOfflinePlayer(io, gameId, game, playerId)`** (mesmo `utils/turns.ts`)
  — o funil único de "jogador sai para sempre": marca offline
  (`disconnectedAt`) **antes** de chamar `advanceTurn` (se era a vez dele) e só
  então apaga do Map. Apagar antes quebraria o cálculo do índice de "próximo"
  (o jogador que saiu não seria mais encontrado no Map).
- **`armTurnWatchdog`** agenda um timeout autoritativo
  (`turnDurationMs + timerStory + TURN_GRACE_MS`): se o jogador da vez travar,
  minimizar o app ou cair, o servidor avança sozinho. O cliente é só o mostrador.

## Reconexão e reserva de vaga ✅

- No `disconnect`, a vaga do jogador fica **reservada** por `RESERVATION_TTL_MS`
  (60s, configurável). `rejoin-game` valida o **token** (comparação
  timing-safe, `utils/tokens.ts`), reassocia o novo `socket.id`, **rotaciona o
  token** e devolve o estado + `remainingTurnMs` + `isOwner`.
- **Ordem de turno preservada:** `rejoin-game` reconstrói o `Map` de
  `players` trocando só a chave (`oldSocketId` → `socket.id` novo) na mesma
  posição, em vez de `delete`+`set` (que jogaria o jogador pro fim da ordem
  de entrada). Reconectar nunca reordena a fila.
- **Cronômetro reinicia pela duração cheia:** se quem reconecta é o jogador
  da vez, o servidor reseta `turnStartedAt` e rearma o watchdog
  (`armTurnWatchdog`) — o `remainingTurnMs` devolvido ao cliente é sempre
  `turnDurationMs` (cheio), nunca o tempo real restante. Sem isso, reconectar
  sob estresse (rede caiu faltando poucos segundos) devolveria o jogador com
  o turno prestes a expirar.
- Se a reserva expira, `expireReservation` (`handlers/disconnect.ts`) chama
  `removeOfflinePlayer`, o mesmo caminho de `leave-game`/`kick-player` —
  passa o turno se era a vez do jogador cuja reserva expirou.

## Remover jogador (kick) ✅

`src/handlers/kickPlayer.ts` — só o **dono** (`game.owner`) pode remover outro
jogador (`kick-player`, payload `{ gameId, targetPlayerId }`), em qualquer
`gameState`. Reaproveita `removeOfflinePlayer`, o mesmo caminho de remoção
definitiva do `leave-game` (marca offline → `advanceTurn` se era a vez dele →
apaga do Map): sem token
guardado em lugar nenhum, um `rejoin-game` subsequente falha por "token
inválido", igual a quem saiu por vontade própria. O jogador removido recebe
`kicked` diretamente (evento no seu próprio socket) antes de sair da room do
Socket.io.

## Guardas ✅

- **Validação** de todo payload (`utils/validate.ts`): `gameId` minúsculo seguro,
  nome, timers, turnos, formato do token.
- **Rate limit** por socket e evento (`utils/rateLimiter.ts`); e **rate limit
  HTTP** (`express-rate-limit`) nas rotas de arquivo do modo LAN (teto generoso
  para o Wi-Fi do clube).
- **CORS** por origem (obrigatório em produção via `CORS_ORIGIN`).
- **CSP explícita** (`helmet()` em `src/app.ts`): `default-src`/`script-src`/
  `style-src`/`font-src`/`connect-src` `'self'`, `img-src` `'self' data:`,
  sem `'unsafe-inline'` em nenhuma diretiva. Uma única política cobre tanto o
  modo API-only (só decora `/health`) quanto o modo LAN (protege o frontend
  estático servido por `PUBLIC_DIR`).
- `cards-selected` só é aceito do jogador da vez, com id vindo do servidor.

## Persistência (Redis, opcional) ✅

`src/utils/persistence/` espelha o `Map` de `games` num Redis, para o estado
sobreviver a um redeploy/spindown (ex.: Render free tier) — **não** é o mesmo
Redis de "escala horizontal" (ver seção abaixo); aqui é só um snapshot store,
sem pub/sub nem adapter do Socket.io.

- **`client.ts`** — `getRedisClient()`: singleton lazy a partir de
  `REDIS_URL`; `null` se a env var não estiver setada. Esse é o único ponto
  que importa `ioredis` — todo o resto depende só de `gameStore.ts`, alheio a
  Redis existir ou não (inversão de dependência, ver `CONVENTIONS.md`).
- **`serialize.ts`** — `Game`/`Player` não serializam direto (`players` é um
  `Map`, `turnTimer`/`reservationTimer` são `Timeout` opacos). A forma
  persistida troca `players` por um array (preserva a ordem de entrada,
  determinante pra rotação de turno), `owner` por `ownerId` (relinkado no
  load), e nunca guarda "tempo restante" — só os timestamps absolutos já
  existentes (`turnStartedAt`, `disconnectedAt`), dos quais o deadline é
  recomputado.
- **`gameStore.ts`** — `persistGame`/`removeGame` (chave `game:{gameId}`,
  `EX` = `ROOM_TTL_MS`) e `loadAllGames` (via `SCAN`, nunca `KEYS`). Chamado
  a partir dos pontos de mutação (`createGame`/`deleteGame` em `games.ts`,
  `advanceTurn`/`removeOfflinePlayer` em `turns.ts`, e o fim de cada
  handler que muda estado persistido) — sempre *fire-and-forget*
  (`void persistGame(...)`), nunca bloqueia o caminho do socket.
- **`rehydrate.ts`** — chamado uma vez, na subida de `createGameServer()`
  (antes de `listen`): carrega todo o Redis pro `Map` em memória e, para
  cada watchdog/reserva pendente, recomputa o deadline a partir do timestamp
  persistido — se já passou (processo ficou fora do ar além do prazo),
  dispara `advanceTurn`/`expireReservation` na hora; senão, reagenda o
  `setTimeout` pelo tempo restante real.

## Escala: muitas salas × múltiplos processos ✅

O limite de **12 salas** é um teto por **processo** — hoje a API roda como
**uma única instância**, então "12 salas simultâneas" já funciona plenamente
(é só 12 entradas no mesmo `Map`). Isso é diferente de **escala horizontal**
(rodar 2+ processos/instâncias atrás de um load balancer): o `Server` do
Socket.io é criado sem adapter (`new Server(httpServer, {...})`, sem
`redis-adapter`/`cluster-adapter`), então um cliente conectado à instância B
nunca veria uma sala que só existe na memória da instância A, e
`io.to(gameId).emit(...)` só alcança sockets da mesma instância. Rodar mais
de um processo exigiria um adapter compartilhado (ex.:
`@socket.io/redis-adapter`) — fora de escopo hoje, não confundir com o limite
de salas por processo. **Não confundir também com o Redis de Persistência**
(seção acima): aquele é só um snapshot store para sobreviver a redeploy de
uma única instância, não um adapter de Socket.io — ter `REDIS_URL` setado
**não** habilita escala horizontal.

## Modo LAN ✅

`PUBLIC_DIR=../storylic/dist yarn start` faz esta API servir o frontend buildado —
jogo 100% offline num notebook. `TURN_GRACE_MS` e `RESERVATION_TTL_MS` são
configuráveis por env. Ver `PROJECT_STATE`.
