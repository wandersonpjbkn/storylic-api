import type { Server } from 'socket.io'
import { SocketEvents } from '@/constants/socketEvents.js'
import type { Game } from '@/types/index.ts'

import {
  clearTurnTimer,
  getGame,
  getOnlinePlayers,
  getPlayersArray,
  getRoomsSnapshot,
} from '@/utils/games.js'

// Folga extra sobre (tempo de cards + tempo de narração) antes do servidor
// assumir que o jogador da vez travou/minimizou o app/caiu e avançar sozinho.
const TURN_GRACE_MS = Number(process.env.TURN_GRACE_MS ?? 8_000)

/**
 * Watchdog autoritativo de turno. A progressão do jogo não pode depender só do
 * cronômetro do cliente do jogador da vez: no mobile, se ele minimiza o app ou
 * perde conexão, o `setInterval` congela e a sala inteira trava. Aqui o servidor
 * garante que o turno sempre avança, mesmo sem receber `finish-storytelling`.
 */
export const armTurnWatchdog = (io: Server, gameId: string, game: Game): void => {
  clearTurnTimer(game)

  const totalMs = game.turnDurationMs + game.timerStory * 1000 + TURN_GRACE_MS

  game.turnTimer = setTimeout(() => {
    const fresh = getGame(gameId)
    if (!fresh || fresh !== game) return
    if (fresh.gameState !== SocketEvents.STATE_PLAYING) return

    console.log(`[watchdog] Turno expirou em "${gameId}" — avançando automaticamente`)
    advanceTurn(io, gameId, fresh)
  }, totalMs)
}

/**
 * Avança para o próximo jogador **online**, pulando vagas reservadas/desconectadas.
 * Ao fim da rodada, incrementa o turno ou encerra a partida. Sempre rearma o
 * watchdog para o próximo jogador.
 */
export const advanceTurn = (io: Server, gameId: string, game: Game): void => {
  const allPlayers = getPlayersArray(game)
  const currentIndex = allPlayers.findIndex(({ id }) => id === game.currentPlayer)

  // Próximo jogador online logo após o atual, na ordem de entrada
  const nextOnline = allPlayers.find(
    (p, idx) => idx > currentIndex && p.disconnectedAt === undefined,
  )

  if (nextOnline) {
    game.currentPlayer = nextOnline.id
    game.turnStartedAt = Date.now()
    armTurnWatchdog(io, gameId, game)

    console.log(`[turn] Próximo: "${nextOnline.name}" — turno ${game.currentTurn}/${game.turns}`)

    io.to(gameId).emit(SocketEvents.ON_PLAYER_TURN, {
      currentPlayer: game.currentPlayer,
      currentTurn: game.currentTurn,
    })
    return
  }

  // Ninguém online depois do atual → nova rodada ou fim
  const onlinePlayers = getOnlinePlayers(game)

  if (game.currentTurn < game.turns && onlinePlayers.length > 0) {
    game.currentTurn++
    game.currentPlayer = onlinePlayers[0].id
    game.turnStartedAt = Date.now()
    armTurnWatchdog(io, gameId, game)

    console.log(`[turn] Nova rodada ${game.currentTurn}/${game.turns} — "${onlinePlayers[0].name}"`)

    io.to(gameId).emit(SocketEvents.ON_PLAYER_TURN, {
      currentPlayer: game.currentPlayer,
      currentTurn: game.currentTurn,
    })
    return
  }

  // Fim de jogo (todas as rodadas concluídas ou sem ninguém online para seguir)
  game.gameState = SocketEvents.STATE_ENDED
  game.turnStartedAt = null
  clearTurnTimer(game)

  console.log(`[turn] Sala "${gameId}" finalizada`)

  io.to(gameId).emit(SocketEvents.ON_GAME_ENDED)
  io.emit(SocketEvents.ON_ROOMS_UPDATED, getRoomsSnapshot())
}
