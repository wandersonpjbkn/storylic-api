import { Redis } from 'ioredis'

let client: Redis | null | undefined

/**
 * Lazily builds a singleton Redis client from `REDIS_URL`. Returns `null`
 * when unset — the sole seam every other persistence module depends on, so
 * "no REDIS_URL" behaves identically to today (in-memory only) everywhere
 * else. A connection error only logs: Redis being unavailable must never
 * break gameplay, since the in-memory `Map` is still the source of truth.
 */
export const getRedisClient = (): Redis | null => {
  if (client !== undefined) return client

  const REDIS_URL = process.env.REDIS_URL
  if (!REDIS_URL) {
    client = null
    return client
  }

  client = new Redis(REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: 2 })
  client.on('error', (err) => {
    console.error('[persistence] Erro de conexão com o Redis:', err.message)
  })

  return client
}
