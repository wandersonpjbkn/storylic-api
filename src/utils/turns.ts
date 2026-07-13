import type { Server } from 'socket.io'
import { TURN_GRACE_MS } from '@/config.js'
import { SocketEvents } from '@/constants/socketEvents.js'
import type { Game } from '@/types/index.js'

import {
  clearTurnTimer,
  getGame,
  getOnlinePlayers,
  getPlayersArray,
  getRoomsSnapshot,
} from '@/utils/games.js'
import { persistGame } from '@/utils/persistence/gameStore.js'

/**
 * Absolute deadline (epoch ms) by which the current player must act before
 * the watchdog takes over. Shared by `armTurnWatchdog` and by persistence
 * (Redis snapshot) so both compute it the same way.
 */
export const getTurnDeadline = (game: Game): number =>
  (game.turnStartedAt ?? Date.now()) + game.turnDurationMs + game.timerStory * 1000 + TURN_GRACE_MS

/**
 * Authoritative turn watchdog. Game progression can't depend only on the
 * current player's client clock: on mobile, minimizing the app or losing
 * connection freezes `setInterval` and would stall the whole room. This
 * guarantees the turn always advances, even without a `finish-storytelling`.
 */
export const armTurnWatchdog = (io: Server, gameId: string, game: Game): void => {
  clearTurnTimer(game)

  const totalMs = getTurnDeadline(game) - (game.turnStartedAt ?? Date.now())

  game.turnTimer = setTimeout(() => {
    const fresh = getGame(gameId)
    if (!fresh || fresh !== game) return
    if (fresh.gameState !== SocketEvents.STATE_PLAYING) return

    console.log(`[watchdog] Turno expirou em "${gameId}" — avançando automaticamente`)
    advanceTurn(io, gameId, fresh)
  }, totalMs)
}

/**
 * Advances to the next **online** player, skipping reserved/disconnected
 * slots. At the end of a round, increments the turn or ends the match.
 * Always rearms the watchdog for whoever goes next.
 */
export const advanceTurn = (io: Server, gameId: string, game: Game): void => {
  const allPlayers = getPlayersArray(game)
  const currentIndex = allPlayers.findIndex(({ id }) => id === game.currentPlayer)

  // Next online player right after the current one, in join order
  const nextOnline = allPlayers.find(
    (p, idx) => idx > currentIndex && p.disconnectedAt === undefined,
  )

  if (nextOnline) {
    game.currentPlayer = nextOnline.id
    game.turnStartedAt = Date.now()
    armTurnWatchdog(io, gameId, game)
    void persistGame(gameId, game)

    console.log(`[turn] Próximo: "${nextOnline.name}" — turno ${game.currentTurn}/${game.turns}`)

    io.to(gameId).emit(SocketEvents.ON_PLAYER_TURN, {
      currentPlayer: game.currentPlayer,
      currentTurn: game.currentTurn,
    })
    return
  }

  // Nobody online after the current player → new round or end of game
  const onlinePlayers = getOnlinePlayers(game)

  if (game.currentTurn < game.turns && onlinePlayers.length > 0) {
    game.currentTurn++
    game.currentPlayer = onlinePlayers[0].id
    game.turnStartedAt = Date.now()
    armTurnWatchdog(io, gameId, game)
    void persistGame(gameId, game)

    console.log(`[turn] Nova rodada ${game.currentTurn}/${game.turns} — "${onlinePlayers[0].name}"`)

    io.to(gameId).emit(SocketEvents.ON_PLAYER_TURN, {
      currentPlayer: game.currentPlayer,
      currentTurn: game.currentTurn,
    })
    return
  }

  // Game over (all rounds completed, or nobody online left to continue)
  game.gameState = SocketEvents.STATE_ENDED
  game.turnStartedAt = null
  clearTurnTimer(game)
  void persistGame(gameId, game)

  console.log(`[turn] Sala "${gameId}" finalizada`)

  io.to(gameId).emit(SocketEvents.ON_GAME_ENDED)
  io.emit(SocketEvents.ON_ROOMS_UPDATED, getRoomsSnapshot())
}

/**
 * Removes a player who's leaving for good — voluntary leave, kick, or an
 * expired reconnection reservation. Advances the turn first if they were the
 * current player: `advanceTurn` locates them by index in the players Map, so
 * deleting first would break that lookup (see `advanceTurn`'s `currentIndex`
 * above). Callers handle their own broadcast/cleanup after this returns.
 */
export const removeOfflinePlayer = (io: Server, gameId: string, game: Game, playerId: string): void => {
  const wasCurrentPlayer = game.gameState === SocketEvents.STATE_PLAYING && game.currentPlayer === playerId

  const player = game.players.get(playerId)
  if (player) player.disconnectedAt = Date.now()

  if (wasCurrentPlayer) advanceTurn(io, gameId, game)

  game.players.delete(playerId)
  void persistGame(gameId, game)
}
