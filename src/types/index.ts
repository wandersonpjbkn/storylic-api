export type GameState = 'setup' | 'lobby' | 'playing' | 'waiting' | 'storytelling' | 'ended'

export interface Player {
  id: string
  name: string
  token: string
  disconnectedAt?: number
  reservationTimer?: ReturnType<typeof setTimeout>
}

export interface Card {
  name: string
  category: string
}

export interface Game {
  currentPlayer: string | null
  currentTurn: number
  turns: number
  // keep: not emitted to clients — server-side only, for the `[start-game]`
  // log line (room size at a glance without counting `players` by hand).
  numPlayers: number
  gameState: GameState
  players: Map<string, Player>
  // Stable reference to the Player who created the room — survives rejoin
  // because rejoinGame.ts mutates the same Player object (never swaps the
  // reference), only updating its `.id` to the new socket.id. Owner doesn't
  // change on "play again" or reconnect; it only stops existing when the
  // room itself is deleted.
  owner: Player | null
  turnStartedAt: number | null
  turnDurationMs: number
  timerTurn: number
  timerStory: number
  turnTimer?: ReturnType<typeof setTimeout>
}

export interface JoinGamePayload {
  gameId: string
  playerName: string
}

export interface RejoinGamePayload {
  gameId: string
  token: string
}

export interface StartGamePayload {
  gameId: string
}

export interface ConfigGamePayload {
  gameId: string
  timerTurn: number
  timerStory: number
  turns: number
}

export interface FinishStorytellingPayload {
  gameId: string
}

export interface CardsSelectedPayload {
  gameId: string
  cards: Card[]
  playerNumber: string
}

export interface ResetGamePayload {
  gameId: string
}

export interface LeaveGamePayload {
  gameId: string
}

export interface KickPlayerPayload {
  gameId: string
  targetPlayerId: string
}

export interface EventRecord {
  timestamps: number[]
}

export interface RateLimitOptions {
  maxRequests: number
  windowMs: number
}
