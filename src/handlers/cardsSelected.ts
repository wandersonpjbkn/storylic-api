import type { Server, Socket } from 'socket.io'

import type { CardsSelectedPayload } from '../types/index.js'

export const cardsSelectedHandler = (_io: Server, socket: Socket) => {
  socket.on('cards-selected', ({ gameId, cards, playerNumber }: CardsSelectedPayload) => {
    // Retransmite para todos na sala para que a WaitingView possa exibir as cartas
    socket.to(gameId).emit('player-selected-cards', {
      cards,
      playerNumber,
    })
  })
}
