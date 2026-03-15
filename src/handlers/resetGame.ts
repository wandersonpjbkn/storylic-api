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
    game.gameState = 'lobby'
    game.turnStartedAt = null
    // Reseta turnDurationMs para o valor do timerTurn atual (pode ter sido reconfigurado)
    game.turnDurationMs = game.timerTurn * 1000

    console.log(`[reset-game] Sala "${gameId}" resetada com ${game.players.size} jogador(es)`)

    // creatorId = primeiro jogador que entrou (mantém ordem de inserção no Map)
    const firstPlayer = getPlayersArray(game)[0]
    const creatorId = firstPlayer?.id ?? null

    io.to(gameId).emit('game-reset', {
      reason: 'new-game',
      creatorId,
      // Envia configs atuais para todos sincronizarem
      timerTurn: game.timerTurn,
      timerStory: game.timerStory,
      turns: game.turns,
    })
    io.to(gameId).emit('game-state', {
      currentPlayer: game.currentPlayer,
      players: getPlayersArray(game),
    })

    io.emit('rooms-updated', getRoomsSnapshot())
  })
}
