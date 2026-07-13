import type { Server, Socket } from 'socket.io'
import { SocketEvents } from '@/constants/socketEvents.js'
import type { ResetGamePayload } from '@/types/index.js'

import { clearTurnTimer, getGame, getSafePlayersArray, getRoomsSnapshot } from '@/utils/games.js'
import { persistGame } from '@/utils/persistence/gameStore.js'
import { isRateLimited } from '@/utils/rateLimiter.js'
import { validateGameId } from '@/utils/validate.js'

export const resetGameHandler = (io: Server, socket: Socket) => {
  socket.on(SocketEvents.EMIT_RESET_GAME, ({ gameId }: ResetGamePayload) => {
    if (isRateLimited(socket.id, SocketEvents.EMIT_RESET_GAME)) return

    const err = validateGameId(gameId)
    if (err) return

    const game = getGame(gameId)
    if (!game) {
      console.warn(`[reset-game] Sala "${gameId}" não encontrada`)
      return
    }

    // only players in the game can reset
    if (!game.players.has(socket.id)) {
      console.warn(`[reset-game] Socket ${socket.id.slice(0, 8)} não pertence à sala "${gameId}"`)
      return
    }

    clearTurnTimer(game)

    game.currentPlayer = null
    game.currentTurn = 1
    game.gameState = SocketEvents.STATE_LOBBY
    game.turnStartedAt = null
    game.turnDurationMs = game.timerTurn * 1000

    void persistGame(gameId, game)

    console.log(`[reset-game] "${gameId}" resetada com ${game.players.size} jogador(es)`)

    // Owner is fixed (see `Game.owner`) and unaffected by a reset; the client
    // already knows whether it's the owner from join/rejoin.
    io.to(gameId).emit(SocketEvents.ON_GAME_RESET, {
      reason: 'new-game',
      timerTurn: game.timerTurn,
      timerStory: game.timerStory,
      turns: game.turns,
    })

    io.to(gameId).emit(SocketEvents.ON_GAME_STATE, {
      currentPlayer: game.currentPlayer,
      players: getSafePlayersArray(game),
    })

    io.emit(SocketEvents.ON_ROOMS_UPDATED, getRoomsSnapshot())
  })
}
