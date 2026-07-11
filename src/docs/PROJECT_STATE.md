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

## Pendências / dívidas conhecidas ⏳

- **Reordenação no rejoin ⏳ (baixo impacto):** o jogador reconectado é
  re-inserido no fim do `Map` de `players`, o que pode reordenar os turnos
  seguintes. Preservar a ordem de entrada é a melhoria natural.
- **`config-game` sem dono ⛔ (de propósito, por ora):** qualquer membro da sala
  pode reconfigurar timers/turnos. Restringir ao criador depende de a ordem de
  entrada ser estável (acima).
- **Estado só em memória, instância única ⏳:** redeploy/spindown do Render apaga
  as salas e mata os timers de reserva. Mitigações: keep-warm (`/health`) e modo
  LAN. Persistência real é fora de escopo hoje.
- **Escala horizontal ⛔:** o `Map` em memória e o watchdog local pressupõem uma
  instância única — não há adaptador de múltiplos nós (nem é meta do clube).

## Em andamento 🔬

- Nada aberto no momento.
