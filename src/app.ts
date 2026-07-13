import { existsSync } from 'fs'
import { createServer } from 'http'
import { resolve } from 'path'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { Server } from 'socket.io'

import { cardsSelectedHandler } from '@/handlers/cardsSelected.js'
import { configGameHandler } from '@/handlers/configGame.js'
import { disconnectHandler } from '@/handlers/disconnect.js'
import { finishStorytellingHandler } from '@/handlers/finishStorytelling.js'
import { getRoomsHandler } from '@/handlers/getRooms.js'
import { joinGameHandler } from '@/handlers/joinGame.js'
import { kickPlayerHandler } from '@/handlers/kickPlayer.js'
import { leaveGameHandler } from '@/handlers/leaveGame.js'
import { rejoinGameHandler } from '@/handlers/rejoinGame.js'
import { resetGameHandler } from '@/handlers/resetGame.js'
import { startGameHandler } from '@/handlers/startGame.js'
import { rehydrateGames } from '@/utils/persistence/rehydrate.js'

export interface GameServer {
  app: express.Express
  httpServer: ReturnType<typeof createServer>
  io: Server
  allowedOrigins: string[]
}

const resolveOrigins = (): string[] => {
  // Empty string (CORS_ORIGIN="" in .env) isn't nullish — without the
  // `|| undefined`, the `??` below would never fall back to LOCAL_CORS_ORIGIN.
  const CORS_ORIGIN = process.env.CORS_ORIGIN || undefined
  const LOCAL_CORS_ORIGIN = process.env.LOCAL_CORS_ORIGIN ?? 'http://localhost:8080'

  if (!CORS_ORIGIN && process.env.NODE_ENV === 'production') {
    console.error('❌ CORS_ORIGIN não definida em produção. Encerrando.')
    process.exit(1)
  }

  return (CORS_ORIGIN ?? LOCAL_CORS_ORIGIN).split(',').map((o) => o.trim())
}

/**
 * Builds the Express app + Socket.io server with every handler registered,
 * **without** calling `listen`. Isolating the port bind lets integration
 * tests spin up instances on an ephemeral port. The entrypoint (`server.ts`)
 * is the one that calls `listen`. Async: rehydrates any Redis-persisted
 * rooms (no-op when `REDIS_URL` is unset) before accepting connections.
 */
export const createGameServer = async (): Promise<GameServer> => {
  const allowedOrigins = resolveOrigins()

  const app = express()

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'self'"],
          manifestSrc: ["'self'"],
          workerSrc: ["'self'"],
        },
      },
    }),
  )
  app.use(
    cors({
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    }),
  )

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // "Local club" mode (LAN): if PUBLIC_DIR points at the frontend build, this
  // server also serves it — the game runs 100% offline on a laptop, with no
  // dependency on the internet or another host. Opt-in: in cloud production,
  // just leave PUBLIC_DIR unset. SPA fallback for Vue Router.
  const PUBLIC_DIR = process.env.PUBLIC_DIR
  if (PUBLIC_DIR && existsSync(PUBLIC_DIR)) {
    const dir = resolve(PUBLIC_DIR)

    // HTTP rate limit on the static file routes (avoids unbounded disk reads).
    // Generous window/cap: ~12 players on the same IP (the club's Wi-Fi) can
    // load the SPA at once without tripping it, while still blocking abuse.
    // Only socket.io and /health stay outside it (registered before/outside
    // Express).
    const staticLimiter = rateLimit({
      windowMs: 60_000,
      limit: 1000,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    })
    app.use(staticLimiter)
    app.use(express.static(dir))
    app.get(/^(?!\/(health|socket\.io)).*/, (_req, res) => {
      res.sendFile(resolve(dir, 'index.html'))
    })
    console.log(`🗂️  Servindo frontend estático de: ${dir}`)
  }

  const httpServer = createServer(app)

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
    },
    maxHttpBufferSize: 64 * 1024,
  })

  await rehydrateGames(io)

  io.on('connection', (socket) => {
    console.log(`[connection] Novo jogador: ${socket.id.slice(0, 8)}`)

    joinGameHandler(io, socket)
    configGameHandler(io, socket)
    startGameHandler(io, socket)
    finishStorytellingHandler(io, socket)
    cardsSelectedHandler(io, socket)
    resetGameHandler(io, socket)
    leaveGameHandler(io, socket)
    kickPlayerHandler(io, socket)
    disconnectHandler(io, socket)
    getRoomsHandler(io, socket)
    rejoinGameHandler(io, socket)
  })

  return { app, httpServer, io, allowedOrigins }
}
