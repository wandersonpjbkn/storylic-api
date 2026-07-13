import { describe, it, expect } from 'vitest'

import { generateToken, tokensAreEqual } from '@/utils/tokens.js'

describe('tokens de sessão', () => {
  it('generateToken produz hex de 48 chars, único a cada chamada', () => {
    const a = generateToken()
    const b = generateToken()
    expect(a).toMatch(/^[0-9a-f]{48}$/)
    expect(b).toMatch(/^[0-9a-f]{48}$/)
    expect(a).not.toBe(b)
  })

  it('tokensAreEqual reconhece iguais e rejeita diferentes', () => {
    const t = generateToken()
    expect(tokensAreEqual(t, t)).toBe(true)
    expect(tokensAreEqual(t, generateToken())).toBe(false)
  })

  it('comprimentos diferentes retornam false sem lançar (guarda do timingSafe)', () => {
    expect(tokensAreEqual('abc', 'abcd')).toBe(false)
  })
})
