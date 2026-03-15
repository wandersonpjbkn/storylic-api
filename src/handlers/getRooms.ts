import type { Server, Socket } from 'socket.io'

import { getRoomsSnapshot } from '../utils/games.js'
import { isRateLimited } from '../utils/rateLimiter.js'

export const getRoomsHandler = (_io: Server, socket: Socket) => {
  socket.on('get-rooms', () => {
    if (isRateLimited(socket.id, 'get-rooms')) return
    socket.emit('rooms-updated', getRoomsSnapshot())
  })
}
