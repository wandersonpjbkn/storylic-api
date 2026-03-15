# storylic-api

API de tempo real para o jogo Storylic, usando Socket.io + Express + TypeScript.

## Estrutura

```
src/
├── handlers/          # Um arquivo por evento de socket
│   ├── cardsSelected.ts
│   ├── disconnect.ts
│   ├── finishStorytelling.ts
│   ├── getRooms.ts
│   ├── joinGame.ts
│   ├── leaveGame.ts
│   ├── resetGame.ts
│   └── startGame.ts
├── types/
│   └── index.ts       # Interfaces compartilhadas
├── utils/
│   └── games.ts       # Store em memória + helpers
└── server.ts          # Entry point
```

## Setup

```bash
cp .env.example .env
yarn install
```

## Scripts

| Comando | Descrição |
|---|---|
| `yarn dev` | Servidor em modo watch (tsx) |
| `yarn build` | Compila TypeScript → dist/ |
| `yarn start` | Roda o build compilado |
| `yarn lint` | ESLint com auto-fix |
| `yarn ts` | Checagem de tipos sem emitir |

## Requisitos

- Node >= 20
- Yarn ~1.22

## Eventos Socket.io

### Cliente → Servidor

| Evento | Payload | Descrição |
|---|---|---|
| `join-game` | `{ gameId, playerName }` | Entra em uma sala |
| `start-game` | `{ gameId, currentPlayer, numPlayers, turns }` | Inicia a partida |
| `finish-storytelling` | `{ gameId, currentPlayer }` | Finaliza o turno de narração |
| `cards-selected` | `{ gameId, cards, playerNumber }` | Confirma as cartas escolhidas |
| `reset-game` | `{ gameId }` | Reinicia a partida |
| `leave-game` | `{ gameId }` | Sai da sala explicitamente |
| `get-rooms` | — | Solicita lista de salas ativas |

### Servidor → Cliente

| Evento | Payload | Descrição |
|---|---|---|
| `game-state` | `{ currentPlayer, players[] }` | Estado atual da sala |
| `player-turn` | `{ currentPlayer, currentTurn }` | Vez de um jogador |
| `player-selected-cards` | `{ cards, playerNumber }` | Cartas confirmadas por um jogador |
| `game-ended` | — | Partida encerrada |
| `game-reset` | — | Partida reiniciada |
| `rooms-updated` | `RoomSnapshot[]` | Lista atualizada de salas públicas |
