import type { Server, Socket } from 'socket.io'

import type { ConfigGamePayload } from '../types/index.js'
import { getGame } from '../utils/games.js'

export const configGameHandler = (io: Server, socket: Socket) => {
  socket.on('config-game', ({ gameId, timerTurn, timerStory, turns }: ConfigGamePayload) => {
    const game = getGame(gameId)

    if (!game) {
      console.warn(`[config-game] Sala "${gameId}" não encontrada`)
      return
    }

    game.timerTurn = timerTurn
    game.timerStory = timerStory
    game.turns = turns
    // Sincroniza turnDurationMs para o cálculo de tempo restante no rejoin
    game.turnDurationMs = timerTurn * 1000

    console.log(
      `[config-game] Sala "${gameId}" — cards:${timerTurn}s narração:${timerStory}s turnos:${turns}`,
    )

    // Propaga para todos na sala (incluindo quem já entrou enquanto o criador configurava)
    io.to(gameId).emit('room-config', { timerTurn, timerStory, turns })
  })
}
