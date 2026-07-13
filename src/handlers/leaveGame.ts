import type { Server, Socket } from 'socket.io'
import { SocketEvents } from '@/constants/socketEvents.js'
import type { LeaveGamePayload } from '@/types/index.js'

import { getGame, getSafePlayersArray, deleteGame, getRoomsSnapshot } from '@/utils/games.js'
import { isRateLimited } from '@/utils/rateLimiter.js'
import { removeOfflinePlayer } from '@/utils/turns.js'
import { validateGameId } from '@/utils/validate.js'

export const leaveGameHandler = (io: Server, socket: Socket) => {
  socket.on(SocketEvents.EMIT_LEAVE_GAME, ({ gameId }: LeaveGamePayload) => {
    if (isRateLimited(socket.id, SocketEvents.EMIT_LEAVE_GAME)) return

    const err = validateGameId(gameId)
    if (err) return

    const game = getGame(gameId)
    if (!game || !game.players.has(socket.id)) return

    removeOfflinePlayer(io, gameId, game, socket.id)
    socket.leave(gameId)

    console.log(`[leave-game] ${socket.id.slice(0, 8)} saiu da sala "${gameId}"`)

    if (game.players.size === 0) {
      deleteGame(gameId)
      console.log(`[leave-game] Sala "${gameId}" removida — sem jogadores`)
    } else {
      io.to(gameId).emit(SocketEvents.ON_GAME_STATE, {
        currentPlayer: game.currentPlayer,
        players: getSafePlayersArray(game),
      })
    }

    io.emit(SocketEvents.ON_ROOMS_UPDATED, getRoomsSnapshot())
  })
}
