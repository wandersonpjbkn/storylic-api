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
  numPlayers: number
  gameState: GameState
  players: Map<string, Player>
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
  currentPlayer: string
  numPlayers: number
  turns: number
  turnDurationMs?: number
}

export interface ConfigGamePayload {
  gameId: string
  timerTurn: number
  timerStory: number
  turns: number
}

export interface FinishStorytellingPayload {
  gameId: string
  currentPlayer: string
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

export interface EventRecord {
  timestamps: number[]
}

export interface RateLimitOptions {
  maxRequests: number
  windowMs: number
}
