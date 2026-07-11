import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { SocketEvents } from '@/constants/socketEvents.js'
import { isRateLimited, clearSocket } from '@/utils/rateLimiter.js'

// join-game permite 5 em 10s (ver LIMITS no rateLimiter).
const JOIN = SocketEvents.EMIT_JOIN_GAME

describe('rateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearSocket('sock-1')
  })

  afterEach(() => {
    vi.useRealTimers()
    clearSocket('sock-1')
  })

  it('libera dentro do limite e bloqueia ao estourar', () => {
    // Dado 5 tentativas permitidas na janela
    for (let i = 0; i < 5; i += 1) {
      expect(isRateLimited('sock-1', JOIN)).toBe(false)
    }
    // Quando vem a 6ª dentro da mesma janela → bloqueia
    expect(isRateLimited('sock-1', JOIN)).toBe(true)
  })

  it('libera de novo depois que a janela passa', () => {
    for (let i = 0; i < 5; i += 1) isRateLimited('sock-1', JOIN)
    expect(isRateLimited('sock-1', JOIN)).toBe(true)

    // Quando a janela de 10s expira
    vi.advanceTimersByTime(10_001)

    // Então volta a liberar
    expect(isRateLimited('sock-1', JOIN)).toBe(false)
  })

  it('evento sem limite configurado nunca bloqueia', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(isRateLimited('sock-1', 'evento-sem-limite')).toBe(false)
    }
  })
})
