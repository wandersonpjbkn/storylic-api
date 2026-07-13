import type { Server, Socket } from 'socket.io'
import { SocketEvents } from '@/constants/socketEvents.js'
import type { CardsSelectedPayload } from '@/types/index.js'

import { getGame } from '@/utils/games.js'
import { isRateLimited } from '@/utils/rateLimiter.js'
import { validateGameId } from '@/utils/validate.js'

export const cardsSelectedHandler = (_io: Server, socket: Socket) => {
  socket.on(
    SocketEvents.EMIT_CARDS_SELECTED,
    ({ gameId, cards }: CardsSelectedPayload) => {
      if (isRateLimited(socket.id, SocketEvents.EMIT_CARDS_SELECTED)) return

      const err = validateGameId(gameId)
      if (err) return

      const game = getGame(gameId)
      if (!game || !game.players.has(socket.id)) return

      // Only the current player reveals their hand — identity comes from the
      // server, never the client (avoids playerNumber spoofing).
      if (game.currentPlayer !== socket.id) return

      const safeCards = Array.isArray(cards) ? cards.slice(0, 3) : []

      socket.to(gameId).emit(SocketEvents.ON_PLAYER_SELECTED_CARDS, {
        cards: safeCards,
        playerNumber: socket.id,
      })
    },
  )
}
