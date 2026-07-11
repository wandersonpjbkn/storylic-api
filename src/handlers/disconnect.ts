import type { Server, Socket } from 'socket.io'

import { SocketEvents } from '@/constants/socketEvents.js'
import { RESERVATION_TTL_MS } from '@/handlers/rejoinGame.js'
import type { Game } from '@/types/index.ts'
import {
  games,
  getPlayersArray,
  getOnlinePlayers,
  getSafeOnlinePlayers,
  deleteGame,
  getRoomsSnapshot,
} from '@/utils/games.js'
import { clearSocket } from '@/utils/rateLimiter.js'
import { armTurnWatchdog } from '@/utils/turns.js'

const isGameActive = (game: Game): boolean =>
  game.gameState === SocketEvents.STATE_PLAYING ||
  game.gameState === SocketEvents.STATE_STORYTELLING ||
  game.gameState === SocketEvents.STATE_WAITING

// Próximo online após o que saiu, na ordem de entrada; senão o primeiro online.
const pickNextOnlinePlayer = (game: Game, removedSocketId: string) => {
  const allPlayers = getPlayersArray(game)
  const onlinePlayers = getOnlinePlayers(game)
  const removedIndex = allPlayers.findIndex((p) => p.id === removedSocketId)
  const after = onlinePlayers.find((p) => allPlayers.findIndex((a) => a.id === p.id) > removedIndex)
  return after ?? onlinePlayers[0]
}

// Executa quando a reserva de vaga expira sem o jogador ter reconectado.
const expireReservation = (io: Server, gameId: string, game: Game, socketId: string): void => {
  const currentEntry = game.players.get(socketId)
  if (!currentEntry || currentEntry.disconnectedAt === undefined) return

  game.players.delete(socketId)
  console.log(`[disconnect] Vaga de "${currentEntry.name}" expirou em "${gameId}"`)

  if (game.players.size === 0) {
    console.log(`[disconnect] Sala "${gameId}" removida — sem jogadores`)
    io.to(gameId).emit(SocketEvents.ON_GAME_RESET)
    deleteGame(gameId)
    io.emit(SocketEvents.ON_ROOMS_UPDATED, getRoomsSnapshot())
    return
  }

  // Se quem saiu era o jogador da vez numa partida ativa, passa a vez.
  if (isGameActive(game) && game.currentPlayer === socketId) {
    if (getOnlinePlayers(game).length === 0) {
      io.to(gameId).emit(SocketEvents.ON_GAME_RESET)
      deleteGame(gameId)
      io.emit(SocketEvents.ON_ROOMS_UPDATED, getRoomsSnapshot())
      return
    }

    const nextPlayer = pickNextOnlinePlayer(game, socketId)
    game.currentPlayer = nextPlayer.id
    game.turnStartedAt = Date.now()
    armTurnWatchdog(io, gameId, game)

    io.to(gameId).emit(SocketEvents.ON_PLAYER_TURN, {
      currentPlayer: game.currentPlayer,
      currentTurn: game.currentTurn,
    })
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

      io.to(gameId).emit(SocketEvents.ON_PLAYER_DISCONNECTED, {
        playerId: socket.id,
        playerName: player.name,
        reservedFor: RESERVATION_TTL_MS,
      })

      console.log(
        `[disconnect] Vaga de "${player.name}" reservada por ${RESERVATION_TTL_MS / 1000}s em "${gameId}"`,
      )

      // Guarda o id numa const local: o handler é reutilizado entre sockets.
      const disconnectedId = socket.id
      player.reservationTimer = setTimeout(
        () => expireReservation(io, gameId, game, disconnectedId),
        RESERVATION_TTL_MS,
      )
    })

    io.emit(SocketEvents.ON_ROOMS_UPDATED, getRoomsSnapshot())
  })
}
