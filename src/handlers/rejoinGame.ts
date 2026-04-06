import type { Server, Socket } from 'socket.io'

import type { RejoinGamePayload } from '@/types/index.js'
import { getGame, getPlayersArray, getOnlinePlayers, getRoomsSnapshot } from '@/utils/games.js'
import { isRateLimited } from '@/utils/rateLimiter.js'
import { SocketEvents } from '@/utils/socket.js'
import { generateToken, tokensAreEqual } from '@/utils/tokens.js'
import { validateGameId, validateToken } from '@/utils/validate.js'

export const RESERVATION_TTL_MS = 60_000

export const rejoinGameHandler = (io: Server, socket: Socket) => {
  socket.on(SocketEvents.ON_REJOIN_GAME, ({ gameId, token }: RejoinGamePayload) => {
    if (isRateLimited(socket.id, SocketEvents.ON_REJOIN_GAME)) {
      socket.emit(SocketEvents.EMIT_REJOIN_ERROR, { reason: 'Muitas tentativas de reconexão.' })
      return
    }

    const gameIdErr = validateGameId(gameId)
    if (gameIdErr) {
      socket.emit(SocketEvents.EMIT_REJOIN_ERROR, { reason: gameIdErr })
      return
    }

    const tokenErr = validateToken(token)
    if (tokenErr) {
      socket.emit(SocketEvents.EMIT_REJOIN_ERROR, { reason: 'Sessão inválida.' })
      return
    }

    const game = getGame(gameId)
    if (!game) {
      socket.emit(SocketEvents.EMIT_REJOIN_ERROR, { reason: 'Sala não encontrada ou já encerrada' })
      return
    }

    const playersArray = getPlayersArray(game)
    const existingPlayer = playersArray.find((p) => tokensAreEqual(p.token, token))

    if (!existingPlayer) {
      socket.emit(SocketEvents.EMIT_REJOIN_ERROR, { reason: 'Token inválido ou vaga expirada' })
      return
    }

    if (existingPlayer.disconnectedAt === undefined && existingPlayer.id !== socket.id) {
      socket.emit(SocketEvents.EMIT_REJOIN_ERROR, { reason: 'Reconexão já processada por outra aba' })
      return
    }

    if (existingPlayer.reservationTimer) {
      clearTimeout(existingPlayer.reservationTimer)
      existingPlayer.reservationTimer = undefined
    }

    const oldSocketId = existingPlayer.id

    game.players.delete(oldSocketId)
    existingPlayer.id = socket.id
    existingPlayer.disconnectedAt = undefined

    const newToken = generateToken()
    existingPlayer.token = newToken
    game.players.set(socket.id, existingPlayer)

    if (game.currentPlayer === oldSocketId) {
      game.currentPlayer = socket.id
    }

    socket.join(gameId)

    const elapsedMs = game.turnStartedAt ? Date.now() - game.turnStartedAt : 0
    const remainingTurnMs = Math.max(0, game.turnDurationMs - elapsedMs)

    // IDs truncados nos logs — nunca logar tokens
    console.log(
      `[rejoin-game] "${existingPlayer.name}" reconectou em "${gameId}" (${oldSocketId.slice(0, 8)} → ${socket.id.slice(0, 8)})`,
    )

    socket.emit(SocketEvents.EMIT_REJOIN_ACK, {
      gameState: game.gameState,
      currentPlayer: game.currentPlayer,
      currentTurn: game.currentTurn,
      turns: game.turns,
      players: getOnlinePlayers(game),
      isMyTurn: game.currentPlayer === socket.id,
      remainingTurnMs,
      newToken,
      timerTurn: game.timerTurn,
      timerStory: game.timerStory,
    })

    socket.to(gameId).emit(SocketEvents.EMIT_PLAYER_RECONNECTED, {
      playerId: socket.id,
      playerName: existingPlayer.name,
      players: getOnlinePlayers(game),
    })

    io.emit(SocketEvents.EMIT_ROOMS_UPDATED, getRoomsSnapshot())
  })
}
