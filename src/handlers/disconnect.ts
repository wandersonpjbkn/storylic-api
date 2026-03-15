import type { Server, Socket } from 'socket.io'

import {
  games,
  getPlayersArray,
  getOnlinePlayers,
  deleteGame,
  getRoomsSnapshot,
} from '../utils/games.js'
import { RESERVATION_TTL_MS } from './rejoinGame.js'

export const disconnectHandler = (io: Server, socket: Socket) => {
  socket.on('disconnect', () => {
    console.log(`[disconnect] Jogador desconectado: ${socket.id}`)

    games.forEach((game, gameId) => {
      const player = game.players.get(socket.id)
      if (!player) return

      if (player.reservationTimer !== undefined) return

      player.disconnectedAt = Date.now()

      io.to(gameId).emit('player-disconnected', {
        playerId: socket.id,
        playerName: player.name,
        reservedFor: RESERVATION_TTL_MS,
      })

      console.log(
        `[disconnect] Vaga de "${player.name}" reservada por ${RESERVATION_TTL_MS / 1000}s na sala "${gameId}"`,
      )

      player.reservationTimer = setTimeout(() => {
        const currentEntry = game.players.get(socket.id)
        if (!currentEntry || currentEntry.disconnectedAt === undefined) return

        game.players.delete(socket.id)
        console.log(`[disconnect] Vaga de "${player.name}" expirou — removido da sala "${gameId}"`)

        if (game.players.size === 0) {
          console.log(`[disconnect] Sala "${gameId}" removida — sem jogadores`)
          io.to(gameId).emit('game-reset')
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
              io.to(gameId).emit('game-reset')
              deleteGame(gameId)
              io.emit('rooms-updated', getRoomsSnapshot())
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

            io.to(gameId).emit('player-turn', {
              currentPlayer: game.currentPlayer,
              currentTurn: game.currentTurn,
            })
          }

          io.to(gameId).emit('game-state', {
            currentPlayer: game.currentPlayer,
            players: getOnlinePlayers(game),
          })
        }

        io.emit('rooms-updated', getRoomsSnapshot())
      }, RESERVATION_TTL_MS)
    })

    io.emit('rooms-updated', getRoomsSnapshot())
  })
}
