import type { Game } from '../types/index.js'

export const games = new Map<string, Game>()

const MAX_ROOMS   = 100
const MAX_PLAYERS = 10
// Sala inativa por 2h sem nenhum jogador online é removida automaticamente
const ROOM_TTL_MS = 2 * 60 * 60 * 1000

export const getPlayersArray = (game: Game) => Array.from(game.players.values())

export const getOnlinePlayers = (game: Game) =>
  Array.from(game.players.values()).filter((p) => p.disconnectedAt === undefined)

/**
 * Cria uma nova sala. Retorna null se o limite de salas ativas foi atingido.
 */
export const createGame = (gameId: string): Game | null => {
  if (games.size >= MAX_ROOMS) return null

  const game: Game = {
    currentPlayer: null,
    currentTurn: 1,
    turns: 3,
    numPlayers: 0,
    gameState: 'lobby',
    players: new Map(),
    turnStartedAt: null,
    turnDurationMs: 25_000,
    timerTurn: 25,
    timerStory: 45,
  }

  games.set(gameId, game)
  return game
}

export const getGame = (gameId: string): Game | undefined => games.get(gameId)

export const deleteGame = (gameId: string): void => {
  games.delete(gameId)
}

/**
 * Retorna false se a sala já atingiu o máximo de jogadores.
 */
export const canJoinGame = (game: Game): boolean => game.players.size < MAX_PLAYERS

export const getRoomsSnapshot = () =>
  Array.from(games.entries()).map(([id, game]) => ({
    id,
    playerCount: getOnlinePlayers(game).length,
    gameState: game.gameState,
    players: getOnlinePlayers(game).map((p) => p.name),
  }))

/**
 * Limpeza periódica de salas inativas (sem jogadores online por TTL).
 * Previne vazamento de memória por salas abandonadas.
 */
const cleanupInactiveRooms = (): void => {
  const now = Date.now()
  for (const [gameId, game] of games.entries()) {
    const hasOnlinePlayers = getOnlinePlayers(game).length > 0
    if (hasOnlinePlayers) continue

    // Usa turnStartedAt como proxy de "última atividade", ou cria um campo dedicado
    const lastActivity = game.turnStartedAt ?? 0
    if (now - lastActivity > ROOM_TTL_MS) {
      games.delete(gameId)
      console.log(`[cleanup] Sala "${gameId}" removida por inatividade`)
    }
  }
}

// Roda a cada 30 minutos
setInterval(cleanupInactiveRooms, 30 * 60 * 1000)
