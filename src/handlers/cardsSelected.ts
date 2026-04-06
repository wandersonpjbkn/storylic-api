import type { Server, Socket } from 'socket.io'
import type { CardsSelectedPayload } from '@/types/index.js'
import { getGame } from '@/utils/games.js'
import { isRateLimited } from '@/utils/rateLimiter.js'
import { SocketEvents } from '@/utils/socket.js'
import { validateGameId } from '@/utils/validate.js'


export const cardsSelectedHandler = (_io: Server, socket: Socket) => {
  socket.on(
    SocketEvents.ON_CARDS_SELECTED,
    ({ gameId, cards, playerNumber }: CardsSelectedPayload) => {
      if (isRateLimited(socket.id, SocketEvents.ON_CARDS_SELECTED)) return

      const err = validateGameId(gameId)
      if (err) return

      const game = getGame(gameId)
      if (!game || !game.players.has(socket.id)) return

      const safeCards = Array.isArray(cards) ? cards.slice(0, 3) : []

      socket.to(gameId).emit(SocketEvents.EMIT_PLAYER_SELECTED_CARDS, {
        cards: safeCards,
        playerNumber,
      })
    },
  )
}
