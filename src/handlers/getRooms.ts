import type { Server, Socket } from 'socket.io'

import { SocketEvents } from '@/constants/socketEvents.js'
import { getRoomsSnapshot } from '@/utils/games.js'
import { isRateLimited } from '@/utils/rateLimiter.js'

export const getRoomsHandler = (_io: Server, socket: Socket) => {
  socket.on(SocketEvents.EMIT_GET_ROOMS, () => {
    if (isRateLimited(socket.id, SocketEvents.EMIT_GET_ROOMS)) return
    socket.emit(SocketEvents.ON_ROOMS_UPDATED, getRoomsSnapshot())
  })
}
