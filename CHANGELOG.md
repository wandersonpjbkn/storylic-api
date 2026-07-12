# Changelog — Storylic API

Histórico de mudanças concluídas. Os docs em `src/docs/` descrevem só o **estado
atual**; o que **mudou** e por quê mora aqui.

## 2026-07 — CodeQL: rate limit HTTP no modo LAN

- `express-rate-limit` nas rotas de arquivo servidas quando `PUBLIC_DIR` está
  ativo (modo LAN), fechando o alerta CodeQL de "missing rate limiting". Janela
  60s / teto 1000 por IP — generoso para ~12 jogadores no mesmo Wi-Fi. Não afeta
  socket.io nem `/health`.
- CSP do helmet segue desativada por decisão documentada (a API é socket/JSON; a
  política vem do host do frontend) — alerta CodeQL tratado como risco aceito.

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
