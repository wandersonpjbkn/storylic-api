import type { Server, Socket } from 'socket.io'
import { RESERVATION_TTL_MS } from '@/handlers/rejoinGame.js'
import {
  games,
  getPlayersArray,
  getOnlinePlayers,
  deleteGame,
  getRoomsSnapshot,
} from '@/utils/games.js'
import { clearSocket } from '@/utils/rateLimiter.js'
import { SocketEvents } from '@/utils/socket.js'


export const disconnectHandler = (io: Server, socket: Socket) => {
  socket.on(SocketEvents.ON_DISCONNECT, () => {
    console.log(`[disconnect] ${socket.id.slice(0, 8)} desconectou`)

    // Limpa entradas de rate limit para este socket
    clearSocket(socket.id)

    games.forEach((game, gameId) => {
      const player = game.players.get(socket.id)
      if (!player) return

      if (player.reservationTimer !== undefined) return

      player.disconnectedAt = Date.now()

      io.to(gameId).emit(SocketEvents.EMIT_PLAYER_DISCONNECTED, {
        playerId: socket.id,
        playerName: player.name,
        reservedFor: RESERVATION_TTL_MS,
      })

      console.log(
        `[disconnect] Vaga de "${player.name}" reservada por ${RESERVATION_TTL_MS / 1000}s em "${gameId}"`,
      )

      player.reservationTimer = setTimeout(() => {
        const currentEntry = game.players.get(socket.id)
        if (!currentEntry || currentEntry.disconnectedAt === undefined) return

        game.players.delete(socket.id)
        console.log(`[disconnect] Vaga de "${player.name}" expirou em "${gameId}"`)

        if (game.players.size === 0) {
          console.log(`[disconnect] Sala "${gameId}" removida — sem jogadores`)
          io.to(gameId).emit(SocketEvents.EMIT_GAME_RESET)
          deleteGame(gameId)
        } else {
          const isGameActive =
            game.gameState === 'playing' ||
            game.gameState === 'storytelling' ||
            game.gameState === 'waiting'

          if (isGameActive && game.currentPlayer === socket.id) {
            const allPlayers = getPlayersArray(game)
            const onlinePlayers = getOnlinePlayers(game)

            if (onlinePlayers.length === 0) {
              io.to(gameId).emit(SocketEvents.EMIT_GAME_RESET)
              deleteGame(gameId)
              io.emit(SocketEvents.EMIT_ROOMS_UPDATED, getRoomsSnapshot())
              return
            }

            const removedIndex = allPlayers.findIndex((p) => p.id === socket.id)
            const nextPlayer =
              onlinePlayers.find((p) => {
                const idx = allPlayers.findIndex((a) => a.id === p.id)
                return idx > removedIndex
              }) ?? onlinePlayers[0]

            game.currentPlayer = nextPlayer.id
            game.turnStartedAt = Date.now()

            io.to(gameId).emit(SocketEvents.EMIT_PLAYER_TURN, {
              currentPlayer: game.currentPlayer,
              currentTurn: game.currentTurn,
            })
          }

          io.to(gameId).emit(SocketEvents.EMIT_GAME_STATE, {
            currentPlayer: game.currentPlayer,
            players: getOnlinePlayers(game),
          })
        }

        io.emit(SocketEvents.EMIT_ROOMS_UPDATED, getRoomsSnapshot())
      }, RESERVATION_TTL_MS)
    })

    io.emit(SocketEvents.EMIT_ROOMS_UPDATED, getRoomsSnapshot())
  })
}
