import type { Server, Socket } from 'socket.io'

import type { LeaveGamePayload } from '@/types/index.js'
import { getGame, getSafePlayersArray, deleteGame, getRoomsSnapshot } from '@/utils/games.js'
import { isRateLimited } from '@/utils/rateLimiter.js'
import { SocketEvents } from '@/constants/socketEvents.js'
import { validateGameId } from '@/utils/validate.js'

export const leaveGameHandler = (io: Server, socket: Socket) => {
  socket.on(SocketEvents.ON_LEAVE_GAME, ({ gameId }: LeaveGamePayload) => {
    if (isRateLimited(socket.id, SocketEvents.ON_LEAVE_GAME)) return

    const err = validateGameId(gameId)
    if (err) return

    const game = getGame(gameId)
    if (!game || !game.players.has(socket.id)) return

    game.players.delete(socket.id)
    socket.leave(gameId)

    console.log(`[leave-game] ${socket.id.slice(0, 8)} saiu da sala "${gameId}"`)

    if (game.players.size === 0) {
      deleteGame(gameId)
      console.log(`[leave-game] Sala "${gameId}" removida — sem jogadores`)
    } else {
      io.to(gameId).emit(SocketEvents.EMIT_GAME_STATE, {
        currentPlayer: game.currentPlayer,
        players: getSafePlayersArray(game),
      })
    }

    io.emit(SocketEvents.EMIT_ROOMS_UPDATED, getRoomsSnapshot())
  })
}
