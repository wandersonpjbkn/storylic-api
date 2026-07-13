import type { Server, Socket } from 'socket.io'
import { SocketEvents } from '@/constants/socketEvents.js'
import type { ConfigGamePayload } from '@/types/index.js'

import { getGame } from '@/utils/games.js'
import { persistGame } from '@/utils/persistence/gameStore.js'
import { isRateLimited } from '@/utils/rateLimiter.js'
import {
  validateGameId,
  validateTimerTurn,
  validateTimerStory,
  validateTurns,
} from '@/utils/validate.js'

export const configGameHandler = (io: Server, socket: Socket) => {
  socket.on(
    SocketEvents.EMIT_CONFIG_GAME,
    ({ gameId, timerTurn, timerStory, turns }: ConfigGamePayload) => {
      if (isRateLimited(socket.id, SocketEvents.EMIT_CONFIG_GAME)) return

      const err =
        validateGameId(gameId) ??
        validateTimerTurn(timerTurn) ??
        validateTimerStory(timerStory) ??
        validateTurns(turns)
      if (err) {
        socket.emit(SocketEvents.ON_CONFIG_ERROR, { reason: err })
        return
      }

      const game = getGame(gameId)
      if (!game) {
        console.warn(`[config-game] Sala "${gameId}" não encontrada`)
        return
      }

      if (game.owner?.id !== socket.id) {
        console.warn(`[config-game] Socket ${socket.id.slice(0, 8)} não é dono da sala "${gameId}"`)
        socket.emit(SocketEvents.ON_CONFIG_ERROR, {
          reason: 'Apenas o dono da sala pode alterar a configuração.',
        })
        return
      }

      if (game.gameState !== SocketEvents.STATE_LOBBY) {
        console.warn(`[config-game] Sala "${gameId}" não está no lobby`)
        socket.emit(SocketEvents.ON_CONFIG_ERROR, {
          reason: 'A configuração só pode ser alterada no lobby.',
        })
        return
      }

      game.timerTurn = timerTurn
      game.timerStory = timerStory
      game.turns = turns
      game.turnDurationMs = timerTurn * 1000

      void persistGame(gameId, game)

      console.log(
        `[config-game] "${gameId}" — cards:${timerTurn}s narração:${timerStory}s turnos:${turns}`,
      )

      io.to(gameId).emit(SocketEvents.ON_ROOM_CONFIG, { timerTurn, timerStory, turns })
    },
  )
}
