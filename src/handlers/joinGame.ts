import type { Server, Socket } from 'socket.io'

import type { JoinGamePayload } from '../types/index.js'
import { games, createGame, getGame, getPlayersArray, getRoomsSnapshot, canJoinGame } from '../utils/games.js'
import { generateToken } from '../utils/tokens.js'
import { isRateLimited } from '../utils/rateLimiter.js'
import { validateGameId, validatePlayerName } from '../utils/validate.js'

export const joinGameHandler = (io: Server, socket: Socket) => {
  socket.on('join-game', ({ gameId, playerName }: JoinGamePayload) => {
    if (isRateLimited(socket.id, 'join-game')) {
      socket.emit('join-error', { reason: 'Muitas tentativas. Aguarde um momento.' })
      return
    }

    const gameIdErr = validateGameId(gameId)
    if (gameIdErr) { socket.emit('join-error', { reason: gameIdErr }); return }

    const nameErr = validatePlayerName(playerName)
    if (nameErr) { socket.emit('join-error', { reason: nameErr }); return }

    socket.join(gameId)

    const isNewRoom = !games.has(gameId)
    if (isNewRoom) {
      const created = createGame(gameId)
      if (!created) {
        socket.emit('join-error', { reason: 'Servidor cheio. Tente mais tarde.' })
        socket.leave(gameId)
        return
      }
    }

    const game = getGame(gameId)!

    if (!canJoinGame(game)) {
      socket.emit('join-error', { reason: 'Sala cheia.' })
      socket.leave(gameId)
      return
    }

    const token = generateToken()
    game.players.set(socket.id, {
      id: socket.id,
      name: playerName.trim(),
      token,
      disconnectedAt: undefined,
      reservationTimer: undefined,
    })

    console.log(
      `[join-game] "${playerName.trim()}" (${socket.id.slice(0, 8)}) → sala "${gameId}" (${game.players.size} jogadores)`,
    )

    socket.emit('join-ack', { token, gameId, isCreator: isNewRoom })

    io.to(gameId).emit('game-state', {
      currentPlayer: game.currentPlayer,
      players: getPlayersArray(game),
    })

    io.emit('rooms-updated', getRoomsSnapshot())
  })
}
