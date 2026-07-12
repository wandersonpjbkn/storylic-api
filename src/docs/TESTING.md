# Testing & BDD — Storylic API

> Estado real + diretrizes. Histórico: [`CHANGELOG`](../../CHANGELOG.md).
> Status: ✅ existe no repo · ⏳ proposto.

## Verdade hoje ✅

- **Runner: Vitest** (`vitest.config.ts`, ambiente `node`). Roda com
  **`yarn test`** (`vitest run`) ou `yarn test:watch`.
- **27 testes** em 5 arquivos `*.spec.ts` co-locados em `__tests__/`.
- O `vitest.config.ts` reescreve os imports NodeNext (`@/algo.js` → `src/algo.ts`)
  e injeta **timers curtos** (`TURN_GRACE_MS=0`, `RESERVATION_TTL_MS=1500`) para os
  testes de integração exercitarem watchdog e reserva sem esperar os defaults.
- **Portões:** `yarn test` · `yarn ts` (`tsc --noEmit`) · `yarn build` · `yarn lint`.

### Coberto hoje ✅

| Arquivo                                | O que valida                                                                                                          |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `utils/__tests__/validate.spec.ts`     | limites de `gameId`, nome, timers, turnos, token                                                                     |
| `utils/__tests__/tokens.spec.ts`       | `generateToken` (hex 48, único), `tokensAreEqual` (timing-safe, guarda de tamanho)                                    |
| `utils/__tests__/rateLimiter.spec.ts`  | libera no limite, bloqueia ao estourar, reabre após a janela, evento sem limite                                      |
| `utils/__tests__/turns.spec.ts`        | `advanceTurn`: pula offline, vira rodada, encerra no fim ou sem online (io falso)                                     |
| `__tests__/integration.spec.ts`        | **suíte multi-cliente** subindo o servidor real (`createGameServer`) em porta efêmera — 9 cenários (abaixo)           |

### Cenários de integração ✅

Partida completa (3 jogadores) → `game-ended`; **fim de turno pula desconectado
(A1)**; queda do jogador da vez libera pela reserva; **watchdog avança com app
minimizado (A2)**; reconexão com token; join recusado em partida em andamento;
reserva expira e o jogador some do elenco; **perda de estado → `rejoin-error`**
(degradação graciosa); reset pós-fim leva ao lobby.

## Right-size

Priorizar o que quebraria silenciosamente: rotação de turno, watchdog, reconexão,
validação. **Não** testar detalhes de log ou formatação. A verdade do protocolo
mora aqui (servidor real), não no cliente.

## Convenções ✅

- Co-localizar em `__tests__/`; `*.spec.ts`; descrições pt-BR de **comportamento**
  (Given/When/Then). Comentários de teste podem ser pt-BR.
- Integração: `beforeEach` sobe `createGameServer()` em porta `0`; `afterEach`
  fecha sockets, limpa o `Map` de jogos e os timers pendentes.

## Segurança (local, sem CI) ✅

Duas camadas que rodam via `yarn`, como os outros gates:

- **`yarn security`** (rápida, segundos): auditoria de **CVEs de dependência de
  produção** (`yarn audit --groups dependencies`, falha em severidade ≥ moderate)
  + `yarn lint` com **`eslint-plugin-security`** (anti-padrões de Node —
  `child_process`, `eval`, regex insegura; `detect-object-injection` e
  `detect-non-literal-fs-filename` desligados por regra, justificados).
- **`yarn security:deep`** (profunda): roda o **CodeQL** localmente
  (`scripts/codeql-scan.sh`) — mesmo motor e suite `security-extended` do check do
  GitHub. Baixa o bundle na 1ª vez (~500MB, cacheado) e constrói o banco (minutos).
  É o que reproduz achados de dataflow (ex.: "missing rate limiting") que a camada
  rápida **não** pega.

> As camadas se complementam: ESLint/SonarJS são baseados em AST; só o CodeQL faz
> dataflow interprocedural. O CodeQL do GitHub (default setup) segue ativo — o
> `security:deep` é o espelho local dele.

## Pendente ⏳

- `configGame`/`getRooms` ainda sem teste unitário dedicado (cobertos
  indiretamente pela integração).
- `security:deep` (CodeQL) roda na máquina do dev; não foi possível fazer o smoke
  completo no ambiente da auditoria (o proxy bloqueia o download do bundle — 403).
