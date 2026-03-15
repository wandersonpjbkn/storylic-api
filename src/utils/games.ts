import type { Game } from '../types/index.js'

export const games = new Map<string, Game>()

export const getPlayersArray = (game: Game) => Array.from(game.players.values())

export const getOnlinePlayers = (game: Game) =>
  Array.from(game.players.values()).filter((p) => p.disconnectedAt === undefined)

export const createGame = (gameId: string): Game => {
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

export const getRoomsSnapshot = () =>
  Array.from(games.entries()).map(([id, game]) => ({
    id,
    playerCount: getOnlinePlayers(game).length,
    gameState: game.gameState,
    players: getOnlinePlayers(game).map((p) => p.name),
  }))
