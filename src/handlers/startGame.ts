import type { Server, Socket } from 'socket.io'
import { SocketEvents } from '@/constants/socketEvents.js'
import type { StartGamePayload } from '@/types/index.ts'

import { getGame, getPlayersArray, getRoomsSnapshot } from '@/utils/games.js'
import { isRateLimited } from '@/utils/rateLimiter.js'
import { armTurnWatchdog } from '@/utils/turns.js'
import { validateGameId } from '@/utils/validate.js'

export const startGameHandler = (io: Server, socket: Socket) => {
  socket.on(SocketEvents.EMIT_START_GAME, ({ gameId }: StartGamePayload) => {
    if (isRateLimited(socket.id, SocketEvents.EMIT_START_GAME)) return

    const err = validateGameId(gameId)
    if (err) return

    const game = getGame(gameId)
    if (!game) {
      console.warn(`[start-game] Sala "${gameId}" não encontrada`)
      return
    }

    // only players in the game can start
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
    game.numPlayers = getPlayersArray(game).length
    game.currentTurn = 1
    game.gameState = SocketEvents.STATE_PLAYING
    game.turnStartedAt = Date.now()

    // turnDurationMs and turns already set in createGame
    // don't overwrite them if the host configured the game before starting

    // Watchdog autoritativo: garante que o turno avança mesmo se o 1º jogador
    // travar/minimizar o app antes de confirmar a mão.
    armTurnWatchdog(io, gameId, game)

    console.log(`[start-game] "${gameId}" — ${game.turns} turnos, ${game.numPlayers} jogadores`)

    io.to(gameId).emit(SocketEvents.ON_PLAYER_TURN, {
      currentPlayer: game.currentPlayer,
      currentTurn: 1,
    })

    io.emit(SocketEvents.ON_ROOMS_UPDATED, getRoomsSnapshot())
  })
}
