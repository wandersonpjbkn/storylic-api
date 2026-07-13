# Docs — Storylic API (tempo real)

Documentação viva da API do Storylic (Express + Socket.io, estado em memória).
Cada arquivo descreve **o que é verdade hoje**. O cliente (Vue 3 + PWA) vive no
repo `storylic` (documentado lá).

## Mapa de documentos

Histórico de mudanças concluídas: [`CHANGELOG.md`](../../CHANGELOG.md) (raiz do
repo) — nenhum doc abaixo deve narrar o que já mudou, só o que **é** hoje.

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — servidor, handler por evento, store em memória, watchdog, reserva de vaga, rate limit, modo LAN
- [`CONVENTIONS.md`](CONVENTIONS.md) — convenções de código
- [`PROJECT_STATE.md`](PROJECT_STATE.md) — decisões, pendências, em andamento
- [`TESTING.md`](TESTING.md) — estado dos testes + diretrizes BDD

## Convenção de status

✅ decidido / validado · 🟡 hipótese forte · 🔬 em validação · ⏳ pendente · ⛔ bloqueado (de propósito)

## Princípio

Detalhe técnico vem do código. **Nunca documentar como fato técnico o que não foi
observado no código** — doc de agente fabricado é pior que doc ausente.
