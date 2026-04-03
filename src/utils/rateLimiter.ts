import type { EventRecord, RateLimitOptions } from '@/types/index.ts'

// socketId → eventName → timestamps
const store = new Map<string, Map<string, EventRecord>>()

export const clearSocket = (socketId: string): void => {
  store.delete(socketId)
}

const LIMITS: Record<string, RateLimitOptions> = {
  'join-game': { maxRequests: 5, windowMs: 10_000 }, // 5 per 10s
  'config-game': { maxRequests: 10, windowMs: 10_000 }, // 10 per 10s (sliders)
  'start-game': { maxRequests: 3, windowMs: 10_000 },
  'finish-storytelling': { maxRequests: 5, windowMs: 5_000 },
  'cards-selected': { maxRequests: 10, windowMs: 5_000 },
  'reset-game': { maxRequests: 3, windowMs: 10_000 },
  'leave-game': { maxRequests: 5, windowMs: 10_000 },
  'rejoin-game': { maxRequests: 5, windowMs: 10_000 },
  'get-rooms': { maxRequests: 10, windowMs: 5_000 },
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
