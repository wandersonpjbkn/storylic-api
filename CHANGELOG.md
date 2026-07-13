# Changelog — Storylic API

Histórico de mudanças concluídas. Os docs em `src/docs/` descrevem só o **estado
atual**; o que **mudou** e por quê mora aqui.

## 2026-07-12 — CSP explícita, persistência via Redis, diretriz SOLID/DRY

- **Fix crítico:** a expiração de reserva de vaga (`disconnect.ts`) reimplementava
  a rotação de turno por conta própria e ignorava o avanço de rodada/fim de jogo
  que `advanceTurn` já trata — se a reserva do último jogador online expirasse na
  última rodada, a sala nunca emitia `game-ended`. Corrigido extraindo
  `removeOfflinePlayer` (`utils/turns.ts`) como funil único de "jogador sai para
  sempre", reusado por `leave-game`, `kick-player` e a expiração de reserva —
  também elimina a duplicação quase idêntica que existia entre os três.
- **CSP explícita:** `helmet()` trocou os defaults por uma política sem
  `unsafe-inline` em nenhuma diretiva. Ver `ARCHITECTURE.md#guardas`.
- **Persistência via Redis (opcional, `REDIS_URL`):** `src/utils/persistence/`
  — snapshot por sala, rehidratação na subida com re-arme de watchdog/reserva a
  partir de timestamps absolutos. `REDIS_URL` vazio mantém o comportamento
  100% em memória de antes. Ver `ARCHITECTURE.md#persistência-redis-opcional`.
- **Limpeza de convenções:** comentários em português fora de `__tests__/`
  traduzidos para inglês; `RESERVATION_TTL_MS`/`TURN_GRACE_MS`/`ROOM_TTL_MS`
  centralizados em `src/config.ts` (antes espalhados/redeclarados); nova
  `clearReservationTimer` (paralela à `clearTurnTimer` já existente);
  `StartGamePayload`/`FinishStorytellingPayload` perderam campos que o handler
  nunca lia.
- **Docs:** novas seções `## Sem duplicação (DRY)` e `## SOLID` em
  `CONVENTIONS.md`, traduzindo os cinco princípios para este código sem
  classes (handlers/utils). `ARCHITECTURE.md` corrigido (a claim de que
  `advanceTurn` já era usado pela expiração de reserva era falsa antes deste
  fix — agora é via `removeOfflinePlayer`).

## 2026-07-12 — Dono da sala, remoção de jogador, reconexão sem reordenar

- **Fix crítico:** `CORS_ORIGIN=""` (string vazia) no `.env` fazia `?? LOCAL_CORS_ORIGIN`
  nunca cair no fallback (`??` só considera `null`/`undefined`) — `allowedOrigins`
  virava `['']` e bloqueava toda conexão real do frontend. Corrigido normalizando
  para `undefined` na leitura do env.
- **`Game.owner` (novo):** referência estável ao `Player` que criou a sala, fixada em
  `join-game` e nunca recalculada — sobrevive a reconexão e a "jogar de novo" porque
  `rejoin-game` muta o mesmo objeto `Player` em vez de substituí-lo.
- **`config-game` agora exige dono** e só funciona com `gameState === 'lobby'`
  (antes: qualquer jogador, em qualquer estado).
- **`kick-player` (novo handler):** dono remove qualquer jogador, lobby ou mid-jogo;
  remoção definitiva (sem token guardado, sem rejoin possível), igual ao leave
  voluntário. Jogador removido recebe `kicked` diretamente.
- **Fix:** `leave-game`/`kick-player` apagavam o jogador do `Map` **antes** de
  chamar `advanceTurn`, quebrando o cálculo de "próximo jogador" quando quem saía
  era o da vez (o algoritmo caía de volta pro primeiro da lista). Corrigido
  marcando como offline antes de avançar o turno, só então apagando — reaproveita
  o caminho já testado de "pular desconectado".
- **Reconexão preserva a ordem de turnos:** `rejoin-game` reconstrói o `Map` de
  `players` trocando só a chave na mesma posição, em vez de `delete`+`set` (que
  jogava o jogador reconectado pro fim da fila).
- **Reconexão reinicia o cronômetro pela duração cheia:** se quem reconecta é o
  jogador da vez, `turnStartedAt` é resetado e o watchdog rearmado — antes, o
  cliente recebia o tempo real restante (podendo ser quase zero).
- **Limpeza de convenções:** imports de tipo usando `@/types/index.ts` (extensão
  literal) trocados para `.js` (padrão NodeNext do `CONVENTIONS.md`, 13 arquivos);
  `SocketEvents.STATE_CONFIG`/`STATE_ROOMS` e os ramos STORYTELLING/WAITING de
  `isGameActive` ganharam comentário `// keep:` justificando por que continuam
  no código mesmo sem uso direto neste servidor.

## 2026-07 — Suíte de segurança local

- **`yarn security`** (rápido): auditoria de CVEs de deps de produção
  (`yarn audit --groups dependencies`, gate em ≥ moderate) + `eslint-plugin-security`
  no `yarn lint`.
- **`yarn security:deep`** (`scripts/codeql-scan.sh`): CodeQL local — mesmo motor e
  suite `security-extended` do check do GitHub, na máquina do dev. Sem CI.
- **CVEs de dependência corrigidos via `resolutions`:** `qs`, `ws`,
  `path-to-regexp`, `socket.io-parser` → auditoria de produção zerada. Testes de
  integração (socket.io real) seguem verdes com as versões novas.

## 2026-07 — CodeQL: rate limit HTTP no modo LAN

- `express-rate-limit` nas rotas de arquivo servidas quando `PUBLIC_DIR` está
  ativo (modo LAN), fechando o alerta CodeQL de "missing rate limiting". Janela
  60s / teto 1000 por IP — generoso para ~12 jogadores no mesmo Wi-Fi. Não afeta
  socket.io nem `/health`.
- CSP do helmet **habilitada** (`helmet()` com a política padrão) via autofix do
  CodeQL, fechando o alerta "Insecure configuration of Helmet". ⚠️ No **modo LAN**
  (servindo o SPA), a CSP padrão `default-src 'self'` bloqueia fontes/GTM/estilos
  inline do frontend — se usar LAN, é preciso uma CSP compatível para as rotas
  estáticas (ver `PROJECT_STATE`).

## 2026-07 — Watchdog de turno, modo LAN e testes

### Resiliência de turno

- **Watchdog autoritativo** (`utils/turns.ts` — novo): `advanceTurn` +
  `armTurnWatchdog`. O servidor avança o turno sozinho se o jogador da vez travar/
  minimizar o app/cair; `TURN_GRACE_MS` configurável.
- **Rotação pula jogadores offline** em `finishStorytelling`, `leaveGame` e na
  expiração de reserva — a sala não trava mais esperando um desconectado.
- `disconnect.ts` refatorado (helpers `expireReservation`/`pickNextOnlinePlayer`)
  para reduzir aninhamento; `RESERVATION_TTL_MS` configurável por env.
- Endurecimento: `cards-selected` só do jogador da vez (id do servidor);
  `start-game` deriva `numPlayers`; `join-game` normaliza o `gameId`.

### Modo LAN / servidor testável

- `createGameServer()` extraído para `app.ts` (sem `listen`); `server.ts` só sobe.
- `PUBLIC_DIR` serve o frontend buildado (jogo offline em rede local).

### Qualidade

- Suíte **Vitest**: unit (`validate`, `tokens`, `rateLimiter`, `turns`) +
  **integração multi-cliente** (`createGameServer` + `socket.io-client`, 9
  cenários), inspirada no padrão do `purple-website`.
- `eslint-plugin-sonarjs` (`recommended`) no `eslint.config.js`, com relaxamento
  justificado (`content-security-policy`). `resolutions` de `typescript` para
  deduplicar e destravar o SonarJS.
- Sistema de docs vivas (`CLAUDE.md` + `src/docs/`).
