import type { Server, Socket } from 'socket.io'

import type { ResetGamePayload } from '@/types/index.js'
import { getGame, getPlayersArray, getRoomsSnapshot } from '@/utils/games.js'
import { isRateLimited } from '@/utils/rateLimiter.js'
import { SocketEvents } from '@/utils/socket.js'
import { validateGameId } from '@/utils/validate.js'

export const resetGameHandler = (io: Server, socket: Socket) => {
  socket.on(SocketEvents.ON_RESET_GAME, ({ gameId }: ResetGamePayload) => {
    if (isRateLimited(socket.id, SocketEvents.ON_RESET_GAME)) return

    const err = validateGameId(gameId)
    if (err) return

    const game = getGame(gameId)
    if (!game) {
      console.warn(`[reset-game] Sala "${gameId}" não encontrada`)
      return
    }

    // Apenas jogadores da sala podem resetar
    if (!game.players.has(socket.id)) {
      console.warn(`[reset-game] Socket ${socket.id.slice(0, 8)} não pertence à sala "${gameId}"`)
      return
    }

    game.currentPlayer = null
    game.currentTurn = 1
    game.gameState = 'lobby'
    game.turnStartedAt = null
    game.turnDurationMs = game.timerTurn * 1000

    console.log(`[reset-game] "${gameId}" resetada com ${game.players.size} jogador(es)`)

    const firstPlayer = getPlayersArray(game)[0]
    const creatorId = firstPlayer?.id ?? null

    io.to(gameId).emit(SocketEvents.EMIT_GAME_RESET, {
      reason: 'new-game',
      creatorId,
      timerTurn: game.timerTurn,
      timerStory: game.timerStory,
      turns: game.turns,
    })

    io.to(gameId).emit(SocketEvents.EMIT_GAME_STATE, {
      currentPlayer: game.currentPlayer,
      players: getPlayersArray(game),
    })

    io.emit(SocketEvents.EMIT_ROOMS_UPDATED, getRoomsSnapshot())
  })
}
