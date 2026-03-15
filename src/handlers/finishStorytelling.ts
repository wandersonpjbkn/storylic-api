import type { Server, Socket } from 'socket.io'

import type { FinishStorytellingPayload } from '../types/index.js'
import { getGame, getPlayersArray, getRoomsSnapshot } from '../utils/games.js'
import { isRateLimited } from '../utils/rateLimiter.js'
import { validateGameId } from '../utils/validate.js'

export const finishStorytellingHandler = (io: Server, socket: Socket) => {
  socket.on('finish-storytelling', ({ gameId, currentPlayer }: FinishStorytellingPayload) => {
    if (isRateLimited(socket.id, 'finish-storytelling')) return

    const err = validateGameId(gameId)
    if (err) return

    const game = getGame(gameId)
    if (!game) {
      console.warn(`[finish-storytelling] Sala "${gameId}" não encontrada`)
      return
    }

    // Apenas o jogador cujo turno é atual pode finalizar a narração
    if (game.currentPlayer !== socket.id) {
      console.warn(`[finish-storytelling] Socket ${socket.id.slice(0, 8)} não é o jogador atual em "${gameId}"`)
      return
    }

    const playersArray = getPlayersArray(game)
    const currentIndex = playersArray.findIndex(({ id }) => id === currentPlayer)

    if (currentIndex === -1) {
      console.warn(`[finish-storytelling] Jogador "${currentPlayer.slice(0, 8)}" não encontrado em "${gameId}"`)
      return
    }

    const nextIndex = currentIndex + 1

    if (nextIndex >= playersArray.length) {
      if (game.currentTurn < game.turns) {
        game.currentTurn++
        game.currentPlayer  = playersArray[0].id
        game.turnStartedAt  = Date.now()

        console.log(`[finish-storytelling] Turno ${game.currentTurn}/${game.turns} — primeiro jogador`)

        io.to(gameId).emit('player-turn', {
          currentPlayer: game.currentPlayer,
          currentTurn:   game.currentTurn,
        })
      } else {
        game.gameState     = 'ended'
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
        currentTurn:   game.currentTurn,
      })
    }
  })
}
