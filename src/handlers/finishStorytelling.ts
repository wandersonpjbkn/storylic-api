import type { Server, Socket } from 'socket.io'
import { SocketEvents } from '@/constants/socketEvents.js'
import type { FinishStorytellingPayload } from '@/types/index.ts'

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

      // Só o jogador da vez encerra o próprio turno. Idempotente por natureza:
      // um segundo emit (ex.: retry após blip de rede) já não bate mais aqui,
      // pois o currentPlayer avançou.
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
