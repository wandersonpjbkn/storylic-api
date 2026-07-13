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

## Resiliência (Wi-Fi instável / cold start)

- **Watchdog de turno autoritativo:** o servidor avança o turno sozinho se o
  jogador da vez travar, minimizar o app ou cair (o cronômetro do cliente não é
  mais a única fonte da verdade). Ajuste a folga com `TURN_GRACE_MS`.
- **Rotação pula jogadores offline:** um jogador desconectado nunca vira "a vez",
  então a sala não trava esperando um fantasma.
- **Keep-warm (evitar o "esperar ligar"):** no tier free do Render a instância
  dorme após ~15 min sem tráfego. Aponte um cron externo (ex.: UptimeRobot,
  cron-job.org) para `GET /health` a cada ~10 min para mantê-la acordada antes
  do encontro do clube. (Auto-ping não resolve: uma instância dormindo não
  consegue acordar a si mesma.)

## Modo clube local (LAN) — jogar sem internet

Se o Wi-Fi do local não tiver internet, rode tudo num notebook da rede:

```bash
# 1) build do frontend (no repo storylic)
cd ../storylic && yarn build

# 2) sirva API + frontend juntos (neste repo)
cd ../storylic-api
yarn build
PUBLIC_DIR=../storylic/dist API_PORT=3000 yarn start

# 3) descubra o IP do notebook na rede (ex.: 192.168.0.10) e no celular acesse:
#    http://192.168.0.10:3000
```

Alternativa sem servir o frontend pela API: mantenha o site (PWA, já faz cache
offline do shell) e use o seletor **Servidor → Local** na tela inicial para
apontar para `http://<IP-do-notebook>:3000`.

## Requisitos

- Node >= 20
- Yarn ~1.22

## Eventos Socket.io

### Cliente → Servidor

| Evento | Payload | Descrição |
|---|---|---|
| `join-game` | `{ gameId, playerName }` | Entra em uma sala |
| `start-game` | `{ gameId }` | Inicia a partida |
| `finish-storytelling` | `{ gameId }` | Finaliza o turno de narração |
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
