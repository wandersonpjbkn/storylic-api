import { describe, it, expect } from 'vitest'

import {
  validateGameId,
  validatePlayerName,
  validateTimerTurn,
  validateTimerStory,
  validateTurns,
  validateToken,
} from '@/utils/validate.js'

// Dado que a API é o único guarda contra payload malicioso (o cliente não é
// confiável), a validação precisa aceitar o válido e recusar o resto.
describe('validateGameId', () => {
  it('aceita id minúsculo com números, hífen e underscore', () => {
    expect(validateGameId('sala-dos-amigos_2')).toBeNull()
  })

  it('recusa vazio, não-string, maiúsculas e comprimento excessivo', () => {
    expect(validateGameId('')).not.toBeNull()
    expect(validateGameId('   ')).not.toBeNull()
    expect(validateGameId(42)).not.toBeNull()
    expect(validateGameId('Sala')).not.toBeNull()
    expect(validateGameId('a b')).not.toBeNull()
    expect(validateGameId('x'.repeat(33))).not.toBeNull()
  })
})

describe('validatePlayerName', () => {
  it('aceita nome comum e recusa vazio/longo/não-string', () => {
    expect(validatePlayerName('Batatinha')).toBeNull()
    expect(validatePlayerName('')).not.toBeNull()
    expect(validatePlayerName('   ')).not.toBeNull()
    expect(validatePlayerName('n'.repeat(25))).not.toBeNull()
    expect(validatePlayerName(null)).not.toBeNull()
  })
})

describe('validação de timers e turnos', () => {
  it('timerTurn respeita 5..120 e exige inteiro', () => {
    expect(validateTimerTurn(25)).toBeNull()
    expect(validateTimerTurn(4)).not.toBeNull()
    expect(validateTimerTurn(121)).not.toBeNull()
    expect(validateTimerTurn(25.5)).not.toBeNull()
  })

  it('timerStory respeita 5..300', () => {
    expect(validateTimerStory(45)).toBeNull()
    expect(validateTimerStory(4)).not.toBeNull()
    expect(validateTimerStory(301)).not.toBeNull()
  })

  it('turns respeita 1..20', () => {
    expect(validateTurns(3)).toBeNull()
    expect(validateTurns(0)).not.toBeNull()
    expect(validateTurns(21)).not.toBeNull()
  })
})

describe('validateToken', () => {
  it('aceita hex de 48 chars e recusa o resto', () => {
    expect(validateToken('a'.repeat(48))).toBeNull()
    expect(validateToken('a'.repeat(47))).not.toBeNull()
    expect(validateToken('z'.repeat(48))).not.toBeNull() // fora do alfabeto hex
    expect(validateToken(123)).not.toBeNull()
  })
})
