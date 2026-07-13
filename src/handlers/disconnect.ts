import type { Server, Socket } from 'socket.io'

import { RESERVATION_TTL_MS } from '@/config.js'
import { SocketEvents } from '@/constants/socketEvents.js'
import type { Game } from '@/types/index.js'
import { games, getSafeOnlinePlayers, deleteGame, getRoomsSnapshot } from '@/utils/games.js'
import { persistGame } from '@/utils/persistence/gameStore.js'
import { clearSocket } from '@/utils/rateLimiter.js'
import { removeOfflinePlayer } from '@/utils/turns.js'

// Runs when a disconnected player's reserved slot expires without a rejoin.
export const expireReservation = (io: Server, gameId: string, game: Game, socketId: string): void => {
  const currentEntry = game.players.get(socketId)
  if (!currentEntry || currentEntry.disconnectedAt === undefined) return

  const playerName = currentEntry.name
  removeOfflinePlayer(io, gameId, game, socketId)
  console.log(`[disconnect] Vaga de "${playerName}" expirou em "${gameId}"`)

  if (game.players.size === 0) {
    console.log(`[disconnect] Sala "${gameId}" removida — sem jogadores`)
    io.to(gameId).emit(SocketEvents.ON_GAME_RESET)
    deleteGame(gameId)
    io.emit(SocketEvents.ON_ROOMS_UPDATED, getRoomsSnapshot())
    return
  }

  io.to(gameId).emit(SocketEvents.ON_GAME_STATE, {
    currentPlayer: game.currentPlayer,
    players: getSafeOnlinePlayers(game),
  })
  io.emit(SocketEvents.ON_ROOMS_UPDATED, getRoomsSnapshot())
}

export const disconnectHandler = (io: Server, socket: Socket) => {
  socket.on(SocketEvents.ON_DISCONNECT, () => {
    console.log(`[disconnect] ${socket.id.slice(0, 8)} desconectou`)

    clearSocket(socket.id)

    games.forEach((game, gameId) => {
      const player = game.players.get(socket.id)
      if (!player) return
      if (player.reservationTimer !== undefined) return

      player.disconnectedAt = Date.now()
      void persistGame(gameId, game)

      io.to(gameId).emit(SocketEvents.ON_PLAYER_DISCONNECTED, {
        playerId: socket.id,
        playerName: player.name,
        reservedFor: RESERVATION_TTL_MS,
      })

      console.log(
        `[disconnect] Vaga de "${player.name}" reservada por ${RESERVATION_TTL_MS / 1000}s em "${gameId}"`,
      )

      // Keep the id in a local const: this handler is reused across sockets.
      const disconnectedId = socket.id
      player.reservationTimer = setTimeout(
        () => expireReservation(io, gameId, game, disconnectedId),
        RESERVATION_TTL_MS,
      )
    })

    io.emit(SocketEvents.ON_ROOMS_UPDATED, getRoomsSnapshot())
  })
}
