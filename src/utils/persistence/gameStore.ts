import { ROOM_TTL_MS } from '@/config.js'
import type { Game } from '@/types/index.js'
import { getRedisClient } from '@/utils/persistence/client.js'
import { deserializeGame, serializeGame } from '@/utils/persistence/serialize.js'

const keyFor = (gameId: string): string => `game:${gameId}`

/**
 * Snapshots one room to Redis, keyed individually (not one blob) so a write
 * is O(1) regardless of room count. The TTL mirrors `ROOM_TTL_MS` and
 * refreshes on every write, so idle rooms expire in Redis the same way
 * `cleanupInactiveRooms` expires them in memory — no extra interval job
 * needed against Redis. No-ops instantly when `REDIS_URL` is unset.
 */
export const persistGame = async (gameId: string, game: Game): Promise<void> => {
  const client = getRedisClient()
  if (!client) return

  try {
    await client.set(
      keyFor(gameId),
      JSON.stringify(serializeGame(game)),
      'EX',
      Math.ceil(ROOM_TTL_MS / 1000),
    )
  } catch (err) {
    console.error(`[persistence] Falha ao salvar "${gameId}" no Redis:`, (err as Error).message)
  }
}

export const removeGame = async (gameId: string): Promise<void> => {
  const client = getRedisClient()
  if (!client) return

  try {
    await client.del(keyFor(gameId))
  } catch (err) {
    console.error(`[persistence] Falha ao remover "${gameId}" do Redis:`, (err as Error).message)
  }
}

/** Loads every persisted room once, at boot. Uses `SCAN`, never `KEYS`. */
export const loadAllGames = async (): Promise<Map<string, Game>> => {
  const restored = new Map<string, Game>()
  const client = getRedisClient()
  if (!client) return restored

  try {
    let cursor = '0'
    const keys: string[] = []
    do {
      const [nextCursor, batch] = await client.scan(cursor, 'MATCH', 'game:*', 'COUNT', 100)
      cursor = nextCursor
      keys.push(...batch)
    } while (cursor !== '0')

    if (keys.length === 0) return restored

    const values = await client.mget(...keys)
    keys.forEach((key, index) => {
      const raw = values[index]
      if (!raw) return
      restored.set(key.slice('game:'.length), deserializeGame(JSON.parse(raw)))
    })
  } catch (err) {
    console.error('[persistence] Falha ao carregar salas do Redis:', (err as Error).message)
  }

  return restored
}
