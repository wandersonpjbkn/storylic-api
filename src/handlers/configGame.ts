import type { Server, Socket } from 'socket.io'
import type { ConfigGamePayload } from '@/types/index.js'
import { getGame } from '@/utils/games.js'
import { isRateLimited } from '@/utils/rateLimiter.js'
import { SocketEvents } from '@/constants/socketEvents.js'
import {
  validateGameId,
  validateTimerTurn,
  validateTimerStory,
  validateTurns,
} from '@/utils/validate.js'

export const configGameHandler = (io: Server, socket: Socket) => {
  socket.on(
    SocketEvents.ON_CONFIG_GAME,
    ({ gameId, timerTurn, timerStory, turns }: ConfigGamePayload) => {
      if (isRateLimited(socket.id, SocketEvents.ON_CONFIG_GAME)) return

      const err =
        validateGameId(gameId) ??
        validateTimerTurn(timerTurn) ??
        validateTimerStory(timerStory) ??
        validateTurns(turns)
      if (err) {
        socket.emit(SocketEvents.EMIT_CONFIG_ERROR, { reason: err })
        return
      }

      const game = getGame(gameId)
      if (!game) {
        console.warn(`[config-game] Sala "${gameId}" não encontrada`)
        return
      }

      // Apenas jogadores da sala podem configurá-la
      if (!game.players.has(socket.id)) {
        console.warn(
          `[config-game] Socket ${socket.id.slice(0, 8)} não pertence à sala "${gameId}"`,
        )
        return
      }

      game.timerTurn = timerTurn
      game.timerStory = timerStory
      game.turns = turns
      game.turnDurationMs = timerTurn * 1000

      console.log(
        `[config-game] "${gameId}" — cards:${timerTurn}s narração:${timerStory}s turnos:${turns}`,
      )

      io.to(gameId).emit(SocketEvents.EMIT_ROOM_CONFIG, { timerTurn, timerStory, turns })
    },
  )
}
