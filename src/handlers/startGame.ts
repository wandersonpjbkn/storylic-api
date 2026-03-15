import type { Server, Socket } from 'socket.io'

import type { StartGamePayload } from '../types/index.js'
import { getGame, getPlayersArray, getRoomsSnapshot } from '../utils/games.js'

export const startGameHandler = (io: Server, socket: Socket) => {
  socket.on(
    'start-game',
    ({ gameId, currentPlayer, numPlayers, turns, turnDurationMs }: StartGamePayload) => {
      const game = getGame(gameId)

      if (!game) {
        console.warn(`[start-game] Sala "${gameId}" não encontrada`)
        return
      }

      const playersArray = getPlayersArray(game)
      const firstPlayer = playersArray[0]
      if (!firstPlayer) {
        console.warn('[start-game] Sala sem jogadores')
        return
      }
      game.currentPlayer = firstPlayer.id
      game.numPlayers = numPlayers
      game.currentTurn = 1
      game.gameState = 'playing'
      game.turnStartedAt = Date.now()

      console.log(
        `[start-game] Sala "${gameId}" iniciada — ${turns} turnos, ${numPlayers} jogadores`,
      )

      io.to(gameId).emit('player-turn', {
        currentPlayer: game.currentPlayer,
        currentTurn: 1,
      })

      io.emit('rooms-updated', getRoomsSnapshot())
    },
  )
}
