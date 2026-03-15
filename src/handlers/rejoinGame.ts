import type { Server, Socket } from 'socket.io'

import type { RejoinGamePayload } from '../types/index.js'
import { getGame, getPlayersArray, getOnlinePlayers, getRoomsSnapshot } from '../utils/games.js'
import { generateToken, tokensAreEqual } from '../utils/tokens.js'

export const RESERVATION_TTL_MS = 60_000

export const rejoinGameHandler = (io: Server, socket: Socket) => {
  socket.on('rejoin-game', ({ gameId, token }: RejoinGamePayload) => {
    const game = getGame(gameId)

    if (!game) {
      socket.emit('rejoin-error', {
        reason: 'Sala não encontrada ou já encerrada',
      })
      return
    }

    const playersArray = getPlayersArray(game)
    const existingPlayer = playersArray.find((p) => tokensAreEqual(p.token, token))

    if (!existingPlayer) {
      socket.emit('rejoin-error', {
        reason: 'Token inválido ou vaga expirada',
      })
      return
    }

    if (existingPlayer.disconnectedAt === undefined && existingPlayer.id !== socket.id) {
      socket.emit('rejoin-error', {
        reason: 'Reconexão já processada por outra aba',
      })
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

    console.log(
      `[rejoin-game] "${existingPlayer.name}" reconectou em "${gameId}" (${oldSocketId} → ${socket.id})`,
    )

    socket.emit('rejoin-ack', {
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

    socket.to(gameId).emit('player-reconnected', {
      playerId: socket.id,
      playerName: existingPlayer.name,
      players: getOnlinePlayers(game),
    })

    io.emit('rooms-updated', getRoomsSnapshot())
  })
}
