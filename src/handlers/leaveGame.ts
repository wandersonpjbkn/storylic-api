import type { Server, Socket } from 'socket.io'

import type { LeaveGamePayload } from '../types/index.js'
import { getGame, getPlayersArray, deleteGame, getRoomsSnapshot } from '../utils/games.js'
import { isRateLimited } from '../utils/rateLimiter.js'
import { validateGameId } from '../utils/validate.js'

export const leaveGameHandler = (io: Server, socket: Socket) => {
  socket.on('leave-game', ({ gameId }: LeaveGamePayload) => {
    if (isRateLimited(socket.id, 'leave-game')) return

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
      io.to(gameId).emit('game-state', {
        currentPlayer: game.currentPlayer,
        players: getPlayersArray(game),
      })
    }

    io.emit('rooms-updated', getRoomsSnapshot())
  })
}
