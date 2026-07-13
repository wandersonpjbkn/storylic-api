import type { Server } from 'socket.io'
import { RESERVATION_TTL_MS } from '@/config.js'
import { SocketEvents } from '@/constants/socketEvents.js'
import { expireReservation } from '@/handlers/disconnect.js'
import type { Game } from '@/types/index.js'
import { games } from '@/utils/games.js'
import { loadAllGames } from '@/utils/persistence/gameStore.js'
import { advanceTurn, getTurnDeadline } from '@/utils/turns.js'

// A deadline already in the past on rehydration fires immediately instead of
// leaving the room stuck until the next real event.
const rearmWatchdog = (io: Server, gameId: string, game: Game): void => {
  if (game.gameState !== SocketEvents.STATE_PLAYING || game.turnStartedAt === null) return

  const remainingMs = getTurnDeadline(game) - Date.now()
  if (remainingMs <= 0) {
    advanceTurn(io, gameId, game)
  } else {
    game.turnTimer = setTimeout(() => advanceTurn(io, gameId, game), remainingMs)
  }
}

const rearmReservations = (io: Server, gameId: string, game: Game): void => {
  for (const player of game.players.values()) {
    if (player.disconnectedAt === undefined) continue

    const remainingMs = player.disconnectedAt + RESERVATION_TTL_MS - Date.now()
    if (remainingMs <= 0) {
      expireReservation(io, gameId, game, player.id)
    } else {
      player.reservationTimer = setTimeout(
        () => expireReservation(io, gameId, game, player.id),
        remainingMs,
      )
    }
  }
}

/**
 * Restores every room persisted in Redis into the in-memory `games` Map at
 * boot, then re-arms each room's watchdog/reservation timers from elapsed
 * real time. No-op when `REDIS_URL` is unset (`loadAllGames` resolves to an
 * empty Map).
 */
export const rehydrateGames = async (io: Server): Promise<void> => {
  const restored = await loadAllGames()
  if (restored.size === 0) return

  for (const [gameId, game] of restored) {
    games.set(gameId, game)
    rearmWatchdog(io, gameId, game)
    rearmReservations(io, gameId, game)
    console.log(`[persistence] Sala "${gameId}" restaurada do Redis`)
  }
}
