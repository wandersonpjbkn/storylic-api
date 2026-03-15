import type { Server, Socket } from 'socket.io'

import type { FinishStorytellingPayload } from '../types/index.js'
import { getGame, getPlayersArray, getRoomsSnapshot } from '../utils/games.js'

export const finishStorytellingHandler = (io: Server, socket: Socket) => {
  socket.on('finish-storytelling', ({ gameId, currentPlayer }: FinishStorytellingPayload) => {
    const game = getGame(gameId)

    if (!game) {
      console.warn(`[finish-storytelling] Sala "${gameId}" não encontrada`)
      return
    }

    const playersArray = getPlayersArray(game)
    const currentIndex = playersArray.findIndex(({ id }) => id === currentPlayer)

    if (currentIndex === -1) {
      console.warn(`[finish-storytelling] Jogador "${currentPlayer}" não encontrado em "${gameId}"`)
      return
    }

    const nextIndex = currentIndex + 1

    if (nextIndex >= playersArray.length) {
      if (game.currentTurn < game.turns) {
        game.currentTurn++
        game.currentPlayer = playersArray[0].id
        game.turnStartedAt = Date.now()

        console.log(
          `[finish-storytelling] Turno ${game.currentTurn}/${game.turns} — primeiro jogador`,
        )

        io.to(gameId).emit('player-turn', {
          currentPlayer: game.currentPlayer,
          currentTurn: game.currentTurn,
        })
      } else {
        game.gameState = 'ended'
        game.turnStartedAt = null

        console.log(`[finish-storytelling] Sala "${gameId}" finalizada`)

        io.to(gameId).emit('game-ended')
        io.emit('rooms-updated', getRoomsSnapshot())
      }
    } else {
      game.currentPlayer = playersArray[nextIndex].id
      game.turnStartedAt = Date.now()

      console.log(
        `[finish-storytelling] Próximo: "${playersArray[nextIndex].name}" — turno ${game.currentTurn}`,
      )

      io.to(gameId).emit('player-turn', {
        currentPlayer: game.currentPlayer,
        currentTurn: game.currentTurn,
      })
    }
  })
}
