import type { Server, Socket } from 'socket.io'

import type { CardsSelectedPayload } from '../types/index.js'
import { getGame } from '../utils/games.js'
import { isRateLimited } from '../utils/rateLimiter.js'
import { validateGameId } from '../utils/validate.js'

export const cardsSelectedHandler = (_io: Server, socket: Socket) => {
  socket.on('cards-selected', ({ gameId, cards, playerNumber }: CardsSelectedPayload) => {
    if (isRateLimited(socket.id, 'cards-selected')) return

    const err = validateGameId(gameId)
    if (err) return

    const game = getGame(gameId)
    if (!game || !game.players.has(socket.id)) return

    // Limitar número de cards a no máximo 3
    const safeCards = Array.isArray(cards) ? cards.slice(0, 3) : []

    socket.to(gameId).emit('player-selected-cards', {
      cards: safeCards,
      playerNumber,
    })
  })
}
