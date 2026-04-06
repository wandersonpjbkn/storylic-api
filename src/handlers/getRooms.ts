import type { Server, Socket } from 'socket.io'

import { getRoomsSnapshot } from '@/utils/games.js'
import { isRateLimited } from '@/utils/rateLimiter.js'
import { SocketEvents } from '@/utils/socket.js'

export const getRoomsHandler = (_io: Server, socket: Socket) => {
  socket.on(SocketEvents.ON_GET_ROOMS, () => {
    if (isRateLimited(socket.id, SocketEvents.ON_GET_ROOMS)) return
    socket.emit(SocketEvents.EMIT_ROOMS_UPDATED, getRoomsSnapshot())
  })
}
