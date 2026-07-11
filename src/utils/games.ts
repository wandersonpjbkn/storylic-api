import { SocketEvents } from '@/constants/socketEvents.js'
import type { Game } from '@/types/index.ts'


export const games = new Map<string, Game>()

const MAX_ROOMS = 12 // 1 room per club member hahah
const MAX_PLAYERS = 12 // club members qty
const ROOM_TTL_MS = 1 * 60 * 60 * 1000 // 1h

export const getPlayersArray = (game: Game) => {
  return Array.from(game.players.values())
}

export const getOnlinePlayers = (game: Game) => {
  return Array.from(game.players.values()).filter((p) => p.disconnectedAt === undefined)
}

export const getSafePlayersArray = (game: Game) => {
  return Array.from(game.players.values()).map(({ id, name }) => ({ id, name }))
}

export const getSafeOnlinePlayers = (game: Game) => {
  return Array.from(game.players.values())
    .filter((p) => p.disconnectedAt === undefined)
    .map(({ id, name }) => ({ id, name }))
}

export const createGame = (gameId: string): Game | null => {
  if (games.size >= MAX_ROOMS) return null

  const game: Game = {
    currentPlayer: null,
    currentTurn: 1,
    turns: 3,
    numPlayers: 0,
    gameState: SocketEvents.STATE_LOBBY,
    players: new Map(),
    turnStartedAt: null,
    turnDurationMs: 25_000,
    timerTurn: 25,
    timerStory: 45,
  }

  games.set(gameId, game)
  return game
}

export const getGame = (gameId: string): Game | undefined => {
  return games.get(gameId)
}

export const clearTurnTimer = (game: Game): void => {
  if (game.turnTimer) {
    clearTimeout(game.turnTimer)
    game.turnTimer = undefined
  }
}

export const deleteGame = (gameId: string): void => {
  const game = games.get(gameId)
  if (game) clearTurnTimer(game)
  games.delete(gameId)
}

export const canJoinGame = (game: Game): boolean => {
  return game.players.size < MAX_PLAYERS
}

export const getRoomsSnapshot = () => {
  return Array.from(games.entries()).map(([id, game]) => ({
    id,
    playerCount: getOnlinePlayers(game).length,
    gameState: game.gameState,
    players: getOnlinePlayers(game).map((p) => p.name),
  }))
}

const cleanupInactiveRooms = (): void => {
  const now = Date.now()
  for (const [gameId, game] of games.entries()) {
    const hasOnlinePlayers = getOnlinePlayers(game).length > 0
    if (hasOnlinePlayers) continue

    const lastActivity = game.turnStartedAt ?? 0
    if (now - lastActivity > ROOM_TTL_MS) {
      deleteGame(gameId)
      console.log(`[cleanup] Sala "${gameId}" removida por inatividade`)
    }
  }
}

setInterval(cleanupInactiveRooms, 15 * 60 * 1000) // run every15min
