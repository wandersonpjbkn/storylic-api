import type { EventRecord, RateLimitOptions } from '@/types/index.ts'
import { SocketEvents } from '@/constants/socketEvents.js'

// socketId → eventName → timestamps
const store = new Map<string, Map<string, EventRecord>>()

export const clearSocket = (socketId: string): void => {
  store.delete(socketId)
}

const LIMITS: Record<string, RateLimitOptions> = {
  [SocketEvents.ON_JOIN_GAME]: { maxRequests: 5, windowMs: 10_000 }, // 5 per 10s
  [SocketEvents.ON_CONFIG_GAME]: { maxRequests: 10, windowMs: 10_000 }, // 10 per 10s (sliders)
  [SocketEvents.ON_START_GAME]: { maxRequests: 3, windowMs: 10_000 },
  [SocketEvents.ON_FINISH_STORYTELLING]: { maxRequests: 5, windowMs: 5_000 },
  [SocketEvents.ON_CARDS_SELECTED]: { maxRequests: 10, windowMs: 5_000 },
  [SocketEvents.ON_RESET_GAME]: { maxRequests: 3, windowMs: 10_000 },
  [SocketEvents.ON_LEAVE_GAME]: { maxRequests: 5, windowMs: 10_000 },
  [SocketEvents.ON_REJOIN_GAME]: { maxRequests: 5, windowMs: 10_000 },
  [SocketEvents.ON_GET_ROOMS]: { maxRequests: 10, windowMs: 5_000 },
}

export const isRateLimited = (socketId: string, event: string): boolean => {
  const limit = LIMITS[event]

  // allowed cuz has no limit set
  if (!limit) return false

  // otherwise...

  const now = Date.now()
  const cutoff = now - limit.windowMs

  if (!store.has(socketId)) store.set(socketId, new Map())
  const socketEvents = store.get(socketId)!

  if (!socketEvents.has(event)) socketEvents.set(event, { timestamps: [] })
  const record = socketEvents.get(event)!

  record.timestamps = record.timestamps.filter((t) => t > cutoff)

  // blocked
  if (record.timestamps.length >= limit.maxRequests) return true

  // allowed
  record.timestamps.push(now)
  return false
}
