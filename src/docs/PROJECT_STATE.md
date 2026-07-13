# Project State — Storylic API

> Decisões, pendências e o que está em andamento. Histórico do que **mudou** vai
> no [`CHANGELOG`](../../CHANGELOG.md); aqui é o **estado atual**.

## Decisões tomadas ✅

- **Watchdog autoritativo de turno** (`utils/turns.ts`): o servidor avança sozinho
  se o jogador da vez não concluir a tempo. Elimina o travamento por app
  minimizado/queda.
- **Rotação pula jogadores offline** em todos os caminhos (finish, leave,
  expiração de reserva) — a sala nunca fica presa num "fantasma".
- **Servidor testável:** `createGameServer()` em `app.ts` sem `listen`.
- **Modo LAN ✅:** `PUBLIC_DIR` serve o frontend; `TURN_GRACE_MS` /
  `RESERVATION_TTL_MS` configuráveis por env.
- **Suíte de testes ✅:** Vitest (unit + integração multi-cliente). Ver
  [`TESTING`](TESTING.md).
- **Lint com SonarJS ✅** (regras `recommended`, relaxamentos justificados).
- **Dono da sala ✅:** `Game.owner` fixado em `join-game`, estável através de
  reconexão e "jogar de novo" (nunca recalculado). Governa `config-game`
  (só dono, só no lobby) e `kick-player`. Ver `ARCHITECTURE.md#dono-da-sala`.
- **Remover jogador (kick) ✅:** dono remove qualquer jogador, lobby ou
  mid-jogo; remoção definitiva, sem rejoin possível. Ver
  `ARCHITECTURE.md#remover-jogador-kick`.
- **Reordenação no rejoin ✅ (resolvido):** reconectar preserva a posição
  original na ordem de turnos (antes ia pro fim do `Map`).
- **Cronômetro reinicia pela duração cheia no rejoin ✅:** reconectar em
  pleno turno já não devolve o jogador com o tempo quase esgotado; o
  watchdog do servidor é rearmado junto.
- **CSP explícita ✅:** `helmet()` (`src/app.ts`) usa uma
  `contentSecurityPolicy` explícita — `default-src`/`script-src`/
  `style-src`/`font-src`/`connect-src` `'self'`, `img-src` `'self' data:`,
  sem `'unsafe-inline'` em nenhuma diretiva. Vale tanto para o modo API-only
  quanto para o LAN (o frontend self-hospeda fontes e desliga o GTM em modo
  LAN — ver `PROJECT_STATE.md` do `storylic`), então a mesma política serve
  os dois sem branch condicional.
- **Persistência via Redis ✅:** `src/utils/persistence/` —
  `persistGame`/`removeGame`/`loadAllGames` (`gameStore.ts`) gravam cada sala
  numa chave própria (`game:{gameId}`, TTL = `ROOM_TTL_MS`). **Opt-in** via
  `REDIS_URL`: vazio ⇒ comportamento idêntico a antes (100% em memória).
  Timers do watchdog/reserva não são persistidos diretamente (não
  serializáveis) — a serialização guarda só timestamps absolutos
  (`turnStartedAt`, `disconnectedAt`); na subida, `rehydrate.ts` recomputa o
  deadline de cada timer a partir desses timestamps e do tempo real
  decorrido, disparando na hora quem já devia ter avançado/expirado enquanto
  o processo estava fora do ar, e reagendando os demais.

## Pendências / dívidas conhecidas

- **Backlog de poderes/features do frontend (2026-07-13):** ver
  `PROJECT_STATE.md` do `storylic` — vários itens vão precisar de mudanças
  aqui também (reset de jogo em qualquer fase, abandonar a qualquer momento,
  filtro de categorias por sala, cartas de evento, desafio secreto). Ainda
  não desenhado; detalhar é trabalho de uma sessão de planejamento futura.
- **Escala horizontal ⛔:** ver `ARCHITECTURE.md#escala-muitas-salas--múltiplos-processos`
  — item de **documentação**, não de código: "12 salas" já é um limite por
  processo que já suporta múltiplas salas simultâneas hoje; escala horizontal
  seria rodar 2+ processos, o que exigiria um adapter compartilhado do
  Socket.io (fora de escopo, não é meta do clube).
