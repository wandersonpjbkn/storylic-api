import type { Server } from 'socket.io'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { SocketEvents } from '@/constants/socketEvents.js'
import type { Game, Player } from '@/types/index.ts'
import { games, clearTurnTimer } from '@/utils/games.js'
import { advanceTurn } from '@/utils/turns.js'

interface Emitted {
  event: string
  payload?: unknown
}

// io falso: captura tudo que foi emitido, tanto por `io.to(room).emit` quanto
// por `io.emit`.
const makeIo = (sink: Emitted[]) =>
  ({
    to: () => ({ emit: (event: string, payload?: unknown) => sink.push({ event, payload }) }),
    emit: (event: string, payload?: unknown) => sink.push({ event, payload }),
  }) as unknown as Server

const player = (id: string, online = true): Player => ({
  id,
  name: id.toUpperCase(),
  token: 'x'.repeat(48),
  disconnectedAt: online ? undefined : Date.now(),
})

const makeGame = (ids: [string, boolean][], currentPlayer: string, currentTurn: number, turns: number): Game => ({
  currentPlayer,
  currentTurn,
  turns,
  numPlayers: ids.length,
  gameState: SocketEvents.STATE_PLAYING,
  players: new Map(ids.map(([id, online]) => [id, player(id, online)])),
  turnStartedAt: Date.now(),
  turnDurationMs: 5000,
  timerTurn: 5,
  timerStory: 5,
})

const GID = 'sala-teste'

describe('advanceTurn', () => {
  beforeEach(() => {
    vi.useFakeTimers() // evita o watchdog real disparar durante o teste
  })

  afterEach(() => {
    const g = games.get(GID)
    if (g) clearTurnTimer(g)
    games.delete(GID)
    vi.useRealTimers()
  })

  const register = (game: Game) => {
    games.set(GID, game)
    return game
  }

  it('pula o próximo jogador offline e passa a vez ao próximo online', () => {
    // Dado A(online) jogando, B offline (vaga reservada), C online
    const game = register(makeGame([['a', true], ['b', false], ['c', true]], 'a', 1, 1))
    const events: Emitted[] = []

    advanceTurn(makeIo(events), GID, game)

    // Então a vez vai direto para C, sem travar em B
    expect(game.currentPlayer).toBe('c')
    const turn = events.find((e) => e.event === SocketEvents.ON_PLAYER_TURN)
    expect(turn?.payload).toMatchObject({ currentPlayer: 'c', currentTurn: 1 })
  })

  it('ao fim da rodada, incrementa o turno e recomeça no primeiro online', () => {
    // Dado o último jogador da rodada terminando, ainda há turnos
    const game = register(makeGame([['a', true], ['b', true]], 'b', 1, 2))
    const events: Emitted[] = []

    advanceTurn(makeIo(events), GID, game)

    expect(game.currentTurn).toBe(2)
    expect(game.currentPlayer).toBe('a')
  })

  it('no último turno do último jogador, encerra a partida', () => {
    const game = register(makeGame([['a', true], ['b', true]], 'b', 2, 2))
    const events: Emitted[] = []

    advanceTurn(makeIo(events), GID, game)

    expect(game.gameState).toBe(SocketEvents.STATE_ENDED)
    expect(events.some((e) => e.event === SocketEvents.ON_GAME_ENDED)).toBe(true)
  })

  it('com o jogador da vez ainda online e turnos restantes, começa nova rodada com ele', () => {
    // A online, B offline, ainda há turnos → A joga de novo na rodada seguinte
    const game = register(makeGame([['a', true], ['b', false]], 'a', 1, 3))
    const events: Emitted[] = []

    advanceTurn(makeIo(events), GID, game)

    expect(game.gameState).toBe(SocketEvents.STATE_PLAYING)
    expect(game.currentTurn).toBe(2)
    expect(game.currentPlayer).toBe('a')
  })

  it('se ninguém mais está online, encerra em vez de travar', () => {
    // Todos offline (ex.: último online saiu) → não há para quem passar
    const game = register(makeGame([['a', false], ['b', false]], 'a', 1, 3))
    const events: Emitted[] = []

    advanceTurn(makeIo(events), GID, game)

    expect(game.gameState).toBe(SocketEvents.STATE_ENDED)
    expect(events.some((e) => e.event === SocketEvents.ON_GAME_ENDED)).toBe(true)
  })
})
