import type { Server, Socket } from 'socket.io'

import type { JoinGamePayload } from '../types/index.js'
import { games, createGame, getGame, getPlayersArray, getRoomsSnapshot } from '../utils/games.js'
import { generateToken } from '../utils/tokens.js'

export const joinGameHandler = (io: Server, socket: Socket) => {
  socket.on('join-game', ({ gameId, playerName }: JoinGamePayload) => {
    socket.join(gameId)

    const isNewRoom = !games.has(gameId)
    if (isNewRoom) createGame(gameId)

    const game = getGame(gameId)!

    const token = generateToken()
    game.players.set(socket.id, {
      id: socket.id,
      name: playerName,
      token,
      disconnectedAt: undefined,
      reservationTimer: undefined,
    })

    console.log(
      `[join-game] Jogador "${playerName}" (${socket.id}) entrou na sala "${gameId}" — ${game.players.size} jogador(es)`,
    )

    // isCreator: true apenas para quem criou a sala (primeiro a entrar)
    socket.emit('join-ack', { token, gameId, isCreator: isNewRoom })

    io.to(gameId).emit('game-state', {
      currentPlayer: game.currentPlayer,
      players: getPlayersArray(game),
    })

    io.emit('rooms-updated', getRoomsSnapshot())
  })
}
