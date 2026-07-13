// Extra buffer over (card time + narration time) before the server assumes the
// current player stalled/minimized the app/dropped and advances the turn itself.
export const TURN_GRACE_MS = Number(process.env.TURN_GRACE_MS ?? 8_000)

// How long a disconnected player's slot stays reserved before it's freed up.
export const RESERVATION_TTL_MS = Number(process.env.RESERVATION_TTL_MS ?? 60_000)

// How long an empty room (no online players) is kept before cleanup removes it.
export const ROOM_TTL_MS = 1 * 60 * 60 * 1000 // 1h
