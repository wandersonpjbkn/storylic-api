import type { Server, Socket } from 'socket.io'

import type { StartGamePayload } from '@/types/index.js'
import { getGame, getPlayersArray, getRoomsSnapshot } from '@/utils/games.js'
import { isRateLimited } from '@/utils/rateLimiter.js'
import { SocketEvents } from '@/constants/socketEvents.js'
import { validateGameId } from '@/utils/validate.js'

export const startGameHandler = (io: Server, socket: Socket) => {
  socket.on(SocketEvents.ON_START_GAME, ({ gameId, numPlayers }: StartGamePayload) => {
    if (isRateLimited(socket.id, SocketEvents.ON_START_GAME)) return

    const err = validateGameId(gameId)
    if (err) return

    const game = getGame(gameId)
    if (!game) {
      console.warn(`[start-game] Sala "${gameId}" não encontrada`)
      return
    }

    // Apenas jogadores da sala podem iniciar
    if (!game.players.has(socket.id)) {
      console.warn(`[start-game] Socket ${socket.id.slice(0, 8)} não pertence à sala "${gameId}"`)
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
    game.gameState = SocketEvents.STATE_PLAYING
    game.turnStartedAt = Date.now()
    // turnDurationMs e turns já foram definidos pelo config-game — não sobrescrever

    console.log(`[start-game] "${gameId}" — ${game.turns} turnos, ${numPlayers} jogadores`)

    io.to(gameId).emit(SocketEvents.EMIT_PLAYER_TURN, {
      currentPlayer: game.currentPlayer,
      currentTurn: 1,
    })

    io.emit(SocketEvents.EMIT_ROOMS_UPDATED, getRoomsSnapshot())
  })
}
