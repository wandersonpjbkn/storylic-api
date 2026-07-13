import type { Server, Socket } from 'socket.io'
import { SocketEvents } from '@/constants/socketEvents.js'
import type { JoinGamePayload } from '@/types/index.js'

import {
  games,
  createGame,
  getGame,
  getSafePlayersArray,
  getRoomsSnapshot,
  canJoinGame,
} from '@/utils/games.js'
import { persistGame } from '@/utils/persistence/gameStore.js'
import { isRateLimited } from '@/utils/rateLimiter.js'
import { generateToken } from '@/utils/tokens.js'
import { validateGameId, validatePlayerName } from '@/utils/validate.js'

export const joinGameHandler = (io: Server, socket: Socket) => {
  socket.on(SocketEvents.EMIT_JOIN_GAME, ({ gameId, playerName }: JoinGamePayload) => {
    if (isRateLimited(socket.id, SocketEvents.EMIT_JOIN_GAME)) {
      socket.emit(SocketEvents.ON_JOIN_ERROR, { reason: 'Muitas tentativas. Aguarde um momento.' })
      return
    }

    const gameIdErr = validateGameId(gameId)
    if (gameIdErr) {
      socket.emit(SocketEvents.ON_JOIN_ERROR, { reason: gameIdErr })
      return
    }

    const nameErr = validatePlayerName(playerName)
    if (nameErr) {
      socket.emit(SocketEvents.ON_JOIN_ERROR, { reason: nameErr })
      return
    }

    // gameId is already validated as lowercase by validateGameId; the same
    // value is used across join/leave/emit to avoid a Socket.io "room" mismatch.
    socket.join(gameId)

    const isNewRoom = !games.has(gameId)
    if (isNewRoom) {
      const created = createGame(gameId)
      if (!created) {
        socket.emit(SocketEvents.ON_JOIN_ERROR, { reason: 'Servidor cheio. Tente mais tarde.' })
        socket.leave(gameId)
        return
      }
    }

    const game = getGame(gameId)!

    if (game.gameState !== SocketEvents.STATE_LOBBY) {
      socket.emit(SocketEvents.ON_JOIN_ERROR, { reason: 'Partida já em andamento.' })
      socket.leave(gameId)
      return
    }

    if (!canJoinGame(game)) {
      socket.emit(SocketEvents.ON_JOIN_ERROR, { reason: 'Sala cheia.' })
      socket.leave(gameId)
      return
    }

    const token = generateToken()
    const player = {
      id: socket.id,
      name: playerName.trim(),
      token,
      disconnectedAt: undefined,
      reservationTimer: undefined,
    }
    game.players.set(socket.id, player)
    // Owner is fixed at room creation and never recalculated — survives
    // rejoin and "play again" (see comment on `types/index.ts#Game`).
    if (isNewRoom) game.owner = player

    void persistGame(gameId, game)

    console.log(
      `[join-game] "${playerName.trim()}" (${socket.id.slice(0, 8)}) → sala "${gameId}" (${game.players.size} jogadores)`,
    )

    socket.emit(SocketEvents.ON_JOIN_ACK, { token, gameId, isCreator: isNewRoom })

    io.to(gameId).emit(SocketEvents.ON_GAME_STATE, {
      currentPlayer: game.currentPlayer,
      players: getSafePlayersArray(game),
    })

    io.emit(SocketEvents.ON_ROOMS_UPDATED, getRoomsSnapshot())
  })
}
