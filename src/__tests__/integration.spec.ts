import type { AddressInfo } from 'node:net'

import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { createGameServer, type GameServer } from '@/app.js'
import { games, clearTurnTimer } from '@/utils/games.js'

// Sobe o servidor real em porta efêmera e dirige clientes Socket.io de verdade —
// o mesmo espírito do harness manual, agora como suíte durável. Timers curtos
// vêm do vitest.config (TURN_GRACE_MS=0, RESERVATION_TTL_MS=1500).

let server: GameServer
let port: number
const openSockets: ClientSocket[] = []

const conn = (): Promise<ClientSocket> =>
  new Promise((resolve, reject) => {
    const s = ioClient(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 6000,
    })
    openSockets.push(s)
    s.on('connect', () => resolve(s))
    s.on('connect_error', reject)
  })

const waitFor = <T = Record<string, unknown>>(
  socket: ClientSocket,
  event: string,
  pred: (p: T) => boolean = () => true,
  ms = 8000,
): Promise<T> =>
  new Promise((resolve, reject) => {
    const to = setTimeout(() => {
      socket.off(event, handler)
      reject(new Error(`timeout esperando '${event}'`))
    }, ms)
    const handler = (payload: T) => {
      if (pred(payload)) {
        clearTimeout(to)
        socket.off(event, handler)
        resolve(payload)
      }
    }
    socket.on(event, handler)
  })

const join = (s: ClientSocket, gameId: string, name: string) => {
  const ack = waitFor<{ gameId: string; token: string; isCreator: boolean }>(
    s,
    'join-ack',
    (d) => d.gameId === gameId,
    6000,
  )
  s.emit('join-game', { gameId, playerName: name })
  return ack
}

const config = (s: ClientSocket, gameId: string, turns: number) => {
  const cfg = waitFor(s, 'room-config')
  s.emit('config-game', { gameId, timerTurn: 5, timerStory: 5, turns })
  return cfg
}

beforeEach(async () => {
  server = createGameServer()
  await new Promise<void>((res) => server.httpServer.listen(0, res))
  port = (server.httpServer.address() as AddressInfo).port
})

afterEach(async () => {
  openSockets.forEach((s) => s.close())
  openSockets.length = 0
  // Limpa o estado em memória e quaisquer timers pendentes entre os testes.
  for (const game of games.values()) {
    clearTurnTimer(game)
    game.players.forEach((p) => p.reservationTimer && clearTimeout(p.reservationTimer))
  }
  games.clear()
  server.io.close()
  await new Promise<void>((res) => server.httpServer.close(() => res()))
})

describe('Funcionalidade: ciclo de vida da partida', () => {
  it('Cenário: partida completa de 3 jogadores encerra ao fim do último turno', async () => {
    const [a, b, c] = await Promise.all([conn(), conn(), conn()])
    await join(a, 's1', 'Ana')
    await join(b, 's1', 'Bia')
    await join(c, 's1', 'Cid')
    await config(a, 's1', 1)

    const turn0 = waitFor<{ currentPlayer: string }>(a, 'player-turn')
    a.emit('start-game', { gameId: 's1' })
    expect((await turn0).currentPlayer).toBe(a.id)

    const t1 = waitFor(b, 'player-turn', (d: { currentPlayer: string }) => d.currentPlayer === b.id)
    a.emit('finish-storytelling', { gameId: 's1' })
    await t1

    const t2 = waitFor(c, 'player-turn', (d: { currentPlayer: string }) => d.currentPlayer === c.id)
    b.emit('finish-storytelling', { gameId: 's1' })
    await t2

    const ended = waitFor(a, 'game-ended')
    c.emit('finish-storytelling', { gameId: 's1' })
    // game-ended não carrega payload: resolver (não estourar timeout) já prova.
    await expect(ended).resolves.toBeUndefined()
  })
})

describe('Funcionalidade: resiliência de turno', () => {
  it('Cenário: fim de turno pula jogador desconectado (bug A1)', async () => {
    const [a, b, c] = await Promise.all([conn(), conn(), conn()])
    await join(a, 's3', 'Ana')
    await join(b, 's3', 'Bia')
    await join(c, 's3', 'Cid')
    await config(a, 's3', 1)

    const t0 = waitFor(a, 'player-turn')
    a.emit('start-game', { gameId: 's3' })
    await t0

    // Bia (próxima da ordem, em espera) cai
    const disc = waitFor(a, 'player-disconnected', (d: { playerName: string }) => d.playerName === 'Bia')
    b.close()
    await disc

    // Ana finaliza → deve pular Bia (offline) e ir direto para Cid
    const next = waitFor<{ currentPlayer: string }>(a, 'player-turn')
    a.emit('finish-storytelling', { gameId: 's3' })
    expect((await next).currentPlayer).toBe(c.id)
  })

  it('Cenário: queda do jogador da vez libera a sala pela expiração da reserva', async () => {
    const [a, b, c] = await Promise.all([conn(), conn(), conn()])
    await join(a, 's2', 'Ana')
    await join(b, 's2', 'Bia')
    await join(c, 's2', 'Cid')
    await config(a, 's2', 2)

    const t0 = waitFor(a, 'player-turn')
    a.emit('start-game', { gameId: 's2' })
    await t0

    // Ana (jogadora da vez) cai; após a reserva expirar, a vez avança
    const advanced = waitFor(b, 'player-turn', (d: { currentPlayer: string }) => d.currentPlayer === b.id, 5000)
    a.close()
    await expect(advanced).resolves.toBeDefined()
  })

  it('Cenário: watchdog avança quando o jogador da vez "minimiza" o app (bug A2)', async () => {
    const [a, b] = await Promise.all([conn(), conn()])
    await join(a, 's4', 'Ana')
    await join(b, 's4', 'Bia')
    await config(a, 's4', 1)

    const t0 = waitFor(a, 'player-turn')
    a.emit('start-game', { gameId: 's4' })
    await t0

    // Ana continua conectada mas nunca envia finish (setInterval congelado).
    // O watchdog do servidor (cards+narração+folga) avança sozinho.
    const advanced = waitFor(b, 'player-turn', (d: { currentPlayer: string }) => d.currentPlayer === b.id, 14000)
    await expect(advanced).resolves.toBeDefined()
  }, 16000)
})

describe('Funcionalidade: reconexão e entrada', () => {
  it('Cenário: reconexão com token devolve o estado da partida', async () => {
    const [a, b] = await Promise.all([conn(), conn()])
    await join(a, 's5', 'Ana')
    const bAck = await join(b, 's5', 'Bia')
    await config(a, 's5', 1)

    const t0 = waitFor(a, 'player-turn')
    a.emit('start-game', { gameId: 's5' })
    await t0

    const disc = waitFor(a, 'player-disconnected', (d: { playerName: string }) => d.playerName === 'Bia')
    b.close()
    await disc

    const b2 = await conn()
    const rejoin = waitFor<{ gameState: string; newToken: string }>(b2, 'rejoin-ack')
    b2.emit('rejoin-game', { gameId: 's5', token: bAck.token })
    const ack = await rejoin
    expect(ack.gameState).toBe('playing')
    expect(ack.newToken).toMatch(/^[0-9a-f]{48}$/)
  })

  it('Cenário: entrar numa partida em andamento é recusado', async () => {
    const [a, b] = await Promise.all([conn(), conn()])
    await join(a, 's6', 'Ana')
    await config(a, 's6', 1)
    const t0 = waitFor(a, 'player-turn')
    a.emit('start-game', { gameId: 's6' })
    await t0

    const err = waitFor<{ reason: string }>(b, 'join-error')
    b.emit('join-game', { gameId: 's6', playerName: 'Zed' })
    expect((await err).reason).toMatch(/andamento/i)
  })

  it('Cenário: reserva expira e o jogador some do elenco', async () => {
    const [a, b] = await Promise.all([conn(), conn()])
    await join(a, 's7', 'Ana')
    await join(b, 's7', 'Bia')

    // Bia cai no lobby; após a reserva (1,5s) o elenco atualiza sem ela
    const shrunk = waitFor<{ players: { name: string }[] }>(
      a,
      'game-state',
      (d) => d.players.length === 1 && d.players.every((p) => p.name !== 'Bia'),
      5000,
    )
    b.close()
    await expect(shrunk).resolves.toBeDefined()
  })

  it('Cenário: perda de estado do servidor devolve rejoin-error (degradação graciosa)', async () => {
    const [a, b] = await Promise.all([conn(), conn()])
    await join(a, 's8', 'Ana')
    const bAck = await join(b, 's8', 'Bia')

    // Simula um restart/spindown do Render: o estado em memória é perdido.
    for (const game of games.values()) clearTurnTimer(game)
    games.clear()

    const err = waitFor<{ reason: string }>(b, 'rejoin-error')
    b.emit('rejoin-game', { gameId: 's8', token: bAck.token })
    expect((await err).reason).toMatch(/não encontrada|encerrada/i)
  })

  it('Cenário: reset após o fim leva todos de volta ao lobby', async () => {
    const [a, b] = await Promise.all([conn(), conn()])
    await join(a, 's9', 'Ana')
    await join(b, 's9', 'Bia')
    await config(a, 's9', 1)

    const t0 = waitFor(a, 'player-turn')
    a.emit('start-game', { gameId: 's9' })
    await t0

    const ended = waitFor(a, 'game-ended')
    a.emit('finish-storytelling', { gameId: 's9' }) // Ana
    // Bia não está mais na vez; o watchdog/entrada garante o encerramento em 1 turno de 2 jogadores
    await waitFor(b, 'player-turn', (d: { currentPlayer: string }) => d.currentPlayer === b.id)
    b.emit('finish-storytelling', { gameId: 's9' })
    await ended

    const reset = waitFor<{ reason: string }>(b, 'game-reset', (d) => d.reason === 'new-game')
    a.emit('reset-game', { gameId: 's9' })
    await expect(reset).resolves.toBeDefined()
  })
})
