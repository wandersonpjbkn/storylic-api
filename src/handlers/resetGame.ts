import type { Server, Socket } from 'socket.io'

import type { ResetGamePayload } from '../types/index.js'
import { getGame, getPlayersArray, getRoomsSnapshot } from '../utils/games.js'

export const resetGameHandler = (io: Server, socket: Socket) => {
  socket.on('reset-game', ({ gameId }: ResetGamePayload) => {
    const game = getGame(gameId)

    if (!game) {
      console.warn(`[reset-game] Sala "${gameId}" não encontrada`)
      return
    }

    game.currentPlayer = null
    game.currentTurn = 1
    // Fix: 'lobby' em vez de 'setup' — a sala existe, jogadores conectados
    game.gameState = 'lobby'
    game.turnStartedAt = null

    console.log(`[reset-game] Sala "${gameId}" resetada com ${game.players.size} jogador(es)`)

    // Fix: reason='new-game' para o frontend saber que é reinício de partida
    // (diferente de sala esvaziada pelo disconnect, que não tem reason)
    io.to(gameId).emit('game-reset', { reason: 'new-game' })
    io.to(gameId).emit('game-state', {
      currentPlayer: game.currentPlayer,
      players: getPlayersArray(game),
    })

    io.emit('rooms-updated', getRoomsSnapshot())
  })
}
