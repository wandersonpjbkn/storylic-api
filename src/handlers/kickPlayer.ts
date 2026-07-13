import type { Server, Socket } from 'socket.io'
import { SocketEvents } from '@/constants/socketEvents.js'
import type { KickPlayerPayload } from '@/types/index.js'

import { getGame, getSafePlayersArray, deleteGame, getRoomsSnapshot } from '@/utils/games.js'
import { isRateLimited } from '@/utils/rateLimiter.js'
import { removeOfflinePlayer } from '@/utils/turns.js'
import { validateGameId, validatePlayerId } from '@/utils/validate.js'

export const kickPlayerHandler = (io: Server, socket: Socket) => {
  socket.on(SocketEvents.EMIT_KICK_PLAYER, ({ gameId, targetPlayerId }: KickPlayerPayload) => {
    if (isRateLimited(socket.id, SocketEvents.EMIT_KICK_PLAYER)) return

    const err = validateGameId(gameId) ?? validatePlayerId(targetPlayerId)
    if (err) return

    const game = getGame(gameId)
    if (!game) return

    // Only the room owner can remove players — allowed in the lobby and mid-game.
    if (game.owner?.id !== socket.id) {
      console.warn(`[kick-player] Socket ${socket.id.slice(0, 8)} não é dono da sala "${gameId}"`)
      return
    }

    if (targetPlayerId === socket.id) return
    if (!game.players.has(targetPlayerId)) return

    const kickedName = game.players.get(targetPlayerId)?.name ?? ''

    removeOfflinePlayer(io, gameId, game, targetPlayerId)

    console.log(`[kick-player] "${kickedName}" removido de "${gameId}" pelo dono`)

    // Permanent removal: with no token kept anywhere, a subsequent rejoin
    // fails with "invalid token", same as a voluntary leave.
    io.to(targetPlayerId).emit(SocketEvents.ON_KICKED, {
      reason: 'Você foi removido da sala pelo dono.',
    })
    io.sockets.sockets.get(targetPlayerId)?.leave(gameId)

    if (game.players.size === 0) {
      deleteGame(gameId)
      console.log(`[kick-player] Sala "${gameId}" removida — sem jogadores`)
    } else {
      io.to(gameId).emit(SocketEvents.ON_GAME_STATE, {
        currentPlayer: game.currentPlayer,
        players: getSafePlayersArray(game),
      })
    }

    io.emit(SocketEvents.ON_ROOMS_UPDATED, getRoomsSnapshot())
  })
}
