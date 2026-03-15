import { randomBytes } from 'crypto'

export const generateToken = (): string => randomBytes(24).toString('hex')

export const tokensAreEqual = (a: string, b: string): boolean =>
  a.length === b.length && a === b
