import { randomBytes, timingSafeEqual } from 'crypto'

export const generateToken = (): string => randomBytes(24).toString('hex')

/**
 * Comparação de tokens em tempo constante.
 * Previne timing attacks onde um atacante poderia inferir o token
 * medindo o tempo de resposta de comparações parcialmente corretas.
 */
export const tokensAreEqual = (a: string, b: string): boolean => {
  // Comprimentos diferentes revelam informação, mas como tokens são sempre
  // gerados com randomBytes(24) = 48 chars, podemos verificar sem risco.
  if (a.length !== b.length) return false

  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
  } catch {
    return false
  }
}
