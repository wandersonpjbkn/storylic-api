import type { Server, Socket } from 'socket.io'

import { getRoomsSnapshot } from '../utils/games.js'

export const getRoomsHandler = (_io: Server, socket: Socket) => {
  // O cliente solicita a lista atual ao entrar na tela de rooms
  socket.on('get-rooms', () => {
    socket.emit('rooms-updated', getRoomsSnapshot())
  })
}
