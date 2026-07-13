# CLAUDE.md

Instruções para o Claude Code neste repositório (API em tempo real do Storylic).

## Documentação como fonte de verdade

Antes de inspecionar código, propor um plano ou implementar qualquer mudança,
leia **sempre** a documentação em [`src/docs/*.md`](src/docs/):

- `README.md` — mapa dos documentos e legenda de status
- `ARCHITECTURE.md` — servidor, handler por evento, store em memória, watchdog, reserva
- `CONVENTIONS.md` — convenções de código
- `PROJECT_STATE.md` — decisões tomadas, pendências, o que está em andamento
- `TESTING.md` — estado dos testes + diretrizes BDD

Histórico de mudanças concluídas: [`CHANGELOG.md`](CHANGELOG.md) na raiz — nenhum
doc de `src/docs/` deve narrar o que já mudou, só o que **é** hoje.

O que estiver nesses documentos é **guideline inflingível** — tem prioridade sobre
convenções genéricas, preferências do modelo ou padrões inferidos só do código.

## Quando o código diverge da documentação

Se o estado atual **divergir** do descrito nas docs, informe **explicitamente no
plano** (ou na resposta). Não corrija silenciosamente — torne a divergência
visível para o usuário decidir.

## As docs também evoluem

Quando uma tarefa mudar comportamento/arquitetura/convenção já documentado,
atualize o doc correspondente **como parte da tarefa**. Histórico vai no
`CHANGELOG.md`, não nas docs.

## Portões de qualidade (rodar antes de subir)

- **Testes:** `yarn test` (Vitest) — ver `src/docs/TESTING.md`.
- **Type-check:** `yarn ts` (`tsc --noEmit`) · **Build:** `yarn build`.
- **Lint:** `yarn lint` (ESLint + SonarJS).
