import type { Server, Socket } from 'socket.io'

import type { LeaveGamePayload } from '../types/index.js'
import { getGame, getPlayersArray, deleteGame, getRoomsSnapshot } from '../utils/games.js'

export const leaveGameHandler = (io: Server, socket: Socket) => {
  socket.on('leave-game', ({ gameId }: LeaveGamePayload) => {
    const game = getGame(gameId)

    if (!game) return

    game.players.delete(socket.id)
    socket.leave(gameId)

    console.log(`[leave-game] Jogador ${socket.id} saiu da sala "${gameId}"`)

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
