import type { Server, Socket } from 'socket.io'
import { SocketEvents } from '@/constants/socketEvents.js'
import type { Player, RejoinGamePayload } from '@/types/index.js'

import {
  clearReservationTimer,
  getGame,
  getPlayersArray,
  getSafeOnlinePlayers,
  getRoomsSnapshot,
} from '@/utils/games.js'
import { persistGame } from '@/utils/persistence/gameStore.js'
import { isRateLimited } from '@/utils/rateLimiter.js'
import { generateToken, tokensAreEqual } from '@/utils/tokens.js'
import { armTurnWatchdog } from '@/utils/turns.js'
import { validateGameId, validateToken } from '@/utils/validate.js'

export const rejoinGameHandler = (io: Server, socket: Socket) => {
  socket.on(SocketEvents.EMIT_REJOIN_GAME, ({ gameId, token }: RejoinGamePayload) => {
    if (isRateLimited(socket.id, SocketEvents.EMIT_REJOIN_GAME)) {
      socket.emit(SocketEvents.ON_REJOIN_ERROR, { reason: 'Muitas tentativas de reconexão.' })
      return
    }

    const gameIdErr = validateGameId(gameId)
    if (gameIdErr) {
      socket.emit(SocketEvents.ON_REJOIN_ERROR, { reason: gameIdErr })
      return
    }

    const tokenErr = validateToken(token)
    if (tokenErr) {
      socket.emit(SocketEvents.ON_REJOIN_ERROR, { reason: 'Sessão inválida.' })
      return
    }

    const game = getGame(gameId)
    if (!game) {
      socket.emit(SocketEvents.ON_REJOIN_ERROR, { reason: 'Sala não encontrada ou já encerrada' })
      return
    }

    const playersArray = getPlayersArray(game)
    const existingPlayer = playersArray.find((p) => tokensAreEqual(p.token, token))

    if (!existingPlayer) {
      socket.emit(SocketEvents.ON_REJOIN_ERROR, { reason: 'Token inválido ou vaga expirada' })
      return
    }

    if (existingPlayer.disconnectedAt === undefined && existingPlayer.id !== socket.id) {
      socket.emit(SocketEvents.ON_REJOIN_ERROR, { reason: 'Reconexão já processada por outra aba' })
      return
    }

    clearReservationTimer(existingPlayer)

    const oldSocketId = existingPlayer.id

    existingPlayer.id = socket.id
    existingPlayer.disconnectedAt = undefined

    const newToken = generateToken()
    existingPlayer.token = newToken

    // Rebuilds the Map, swapping only the key (oldSocketId → new socket.id)
    // at the SAME position — preserves the original turn order. A plain
    // `delete` + `set` would push the player to the end of the entry order;
    // reconnecting alone should never reorder the queue.
    const reordered = new Map<string, Player>()
    for (const [key, player] of game.players) {
      reordered.set(key === oldSocketId ? socket.id : key, player)
    }
    game.players = reordered

    const isCurrentPlayerRejoining = game.currentPlayer === oldSocketId
    if (isCurrentPlayerRejoining) game.currentPlayer = socket.id

    socket.join(gameId)

    // Reconnecting mid-turn under stress (network dropped, app minimized)
    // shouldn't hand the player back a clock that's nearly out — reset to
    // the full duration and re-arm the server's watchdog to match what the
    // client will show (otherwise the server would cut the turn on the old
    // deadline while the client still displays full time).
    if (isCurrentPlayerRejoining && game.gameState === SocketEvents.STATE_PLAYING) {
      game.turnStartedAt = Date.now()
      armTurnWatchdog(io, gameId, game)
    }

    void persistGame(gameId, game)

    console.log(
      `[rejoin-game] "${existingPlayer.name}" reconectou em "${gameId}" (${oldSocketId.slice(0, 8)} → ${socket.id.slice(0, 8)})`,
    )

    socket.emit(SocketEvents.ON_REJOIN_ACK, {
      gameState: game.gameState,
      currentPlayer: game.currentPlayer,
      currentTurn: game.currentTurn,
      turns: game.turns,
      players: getSafeOnlinePlayers(game),
      isMyTurn: game.currentPlayer === socket.id,
      isOwner: game.owner?.id === socket.id,
      remainingTurnMs: game.turnDurationMs,
      newToken,
      timerTurn: game.timerTurn,
      timerStory: game.timerStory,
    })

    socket.to(gameId).emit(SocketEvents.ON_PLAYER_RECONNECTED, {
      playerId: socket.id,
      playerName: existingPlayer.name,
      players: getSafeOnlinePlayers(game),
    })

    io.emit(SocketEvents.ON_ROOMS_UPDATED, getRoomsSnapshot())
  })
}
