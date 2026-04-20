import { randomBytes, timingSafeEqual } from 'crypto'

export const generateToken = (): string => randomBytes(24).toString('hex')

/**
 * Prevents timing attacks
 * @param a token {string}
 * @param b token {string}
 * @returns boolean
 */
export const tokensAreEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false

  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
  } catch {
    return false
  }
}
