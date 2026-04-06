import type { Server, Socket } from 'socket.io'

import type { ResetGamePayload } from '@/types/index.js'
import { getGame, getPlayersArray, getSafePlayersArray, getRoomsSnapshot } from '@/utils/games.js'
import { isRateLimited } from '@/utils/rateLimiter.js'
import { SocketEvents } from '@/constants/socketEvents.js'
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

    // only players in the game can reset
    if (!game.players.has(socket.id)) {
      console.warn(`[reset-game] Socket ${socket.id.slice(0, 8)} não pertence à sala "${gameId}"`)
      return
    }

    game.currentPlayer = null
    game.currentTurn = 1
    game.gameState = SocketEvents.STATE_LOBBY
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
      players: getSafePlayersArray(game),
    })

    io.emit(SocketEvents.EMIT_ROOMS_UPDATED, getRoomsSnapshot())
  })
}
