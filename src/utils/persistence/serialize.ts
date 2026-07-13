import type { Game, GameState, Player } from '@/types/index.js'

export interface PersistedPlayer {
  id: string
  name: string
  token: string
  disconnectedAt?: number
}

export interface PersistedGame {
  currentPlayer: string | null
  currentTurn: number
  turns: number
  numPlayers: number
  gameState: GameState
  players: PersistedPlayer[]
  ownerId: string | null
  turnStartedAt: number | null
  turnDurationMs: number
  timerTurn: number
  timerStory: number
}

// `turnTimer`/`reservationTimer` (Timeout handles) never survive JSON — every
// other field is an absolute timestamp or plain value, so the watchdog/
// reservation deadlines are recomputed from `turnStartedAt`/`disconnectedAt`
// on load instead of persisting a separate "remaining ms" that would go
// stale the instant it's written.
export const serializeGame = (game: Game): PersistedGame => ({
  currentPlayer: game.currentPlayer,
  currentTurn: game.currentTurn,
  turns: game.turns,
  numPlayers: game.numPlayers,
  gameState: game.gameState,
  players: Array.from(game.players.values()).map(({ id, name, token, disconnectedAt }) => ({
    id,
    name,
    token,
    disconnectedAt,
  })),
  ownerId: game.owner?.id ?? null,
  turnStartedAt: game.turnStartedAt,
  turnDurationMs: game.turnDurationMs,
  timerTurn: game.timerTurn,
  timerStory: game.timerStory,
})

export const deserializeGame = (persisted: PersistedGame): Game => {
  // Map insertion order is load-bearing (rejoin/turn-rotation rely on it) —
  // building from the persisted array in order preserves it.
  const players = new Map<string, Player>(
    persisted.players.map((p) => [p.id, { ...p, reservationTimer: undefined }]),
  )

  return {
    currentPlayer: persisted.currentPlayer,
    currentTurn: persisted.currentTurn,
    turns: persisted.turns,
    numPlayers: persisted.numPlayers,
    gameState: persisted.gameState,
    players,
    owner: persisted.ownerId ? (players.get(persisted.ownerId) ?? null) : null,
    turnStartedAt: persisted.turnStartedAt,
    turnDurationMs: persisted.turnDurationMs,
    timerTurn: persisted.timerTurn,
    timerStory: persisted.timerStory,
    turnTimer: undefined,
  }
}
