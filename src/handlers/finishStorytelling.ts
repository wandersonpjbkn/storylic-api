import type { Server, Socket } from 'socket.io'
import { SocketEvents } from '@/constants/socketEvents.js'
import type { FinishStorytellingPayload } from '@/types/index.js'

import { getGame } from '@/utils/games.js'
import { isRateLimited } from '@/utils/rateLimiter.js'
import { advanceTurn } from '@/utils/turns.js'
import { validateGameId } from '@/utils/validate.js'

export const finishStorytellingHandler = (io: Server, socket: Socket) => {
  socket.on(
    SocketEvents.EMIT_FINISH_STORYTELLING,
    ({ gameId }: FinishStorytellingPayload) => {
      if (isRateLimited(socket.id, SocketEvents.EMIT_FINISH_STORYTELLING)) return

      const err = validateGameId(gameId)
      if (err) return

      const game = getGame(gameId)
      if (!game) {
        console.warn(`[finish-storytelling] Sala "${gameId}" não encontrada`)
        return
      }

      // Only the current player can end their own turn. Idempotent by nature:
      // a second emit (e.g. a retry after a network blip) no longer matches
      // here once currentPlayer has advanced.
      if (game.currentPlayer !== socket.id) {
        console.warn(
          `[finish-storytelling] Socket ${socket.id.slice(0, 8)} não é o jogador atual em "${gameId}"`,
        )
        return
      }

      advanceTurn(io, gameId, game)
    },
  )
}
