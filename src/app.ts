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
import { leaveGameHandler } from '@/handlers/leaveGame.js'
import { rejoinGameHandler } from '@/handlers/rejoinGame.js'
import { resetGameHandler } from '@/handlers/resetGame.js'
import { startGameHandler } from '@/handlers/startGame.js'

export interface GameServer {
  app: express.Express
  httpServer: ReturnType<typeof createServer>
  io: Server
  allowedOrigins: string[]
}

const resolveOrigins = (): string[] => {
  const CORS_ORIGIN = process.env.CORS_ORIGIN
  const LOCAL_CORS_ORIGIN = process.env.LOCAL_CORS_ORIGIN ?? 'http://localhost:8080'

  if (!CORS_ORIGIN && process.env.NODE_ENV === 'production') {
    console.error('❌ CORS_ORIGIN não definida em produção. Encerrando.')
    process.exit(1)
  }

  return (CORS_ORIGIN ?? LOCAL_CORS_ORIGIN).split(',').map((o) => o.trim())
}

/**
 * Monta o app Express + servidor Socket.io com todos os handlers, **sem**
 * chamar `listen`. Isolar a criação do bind à porta permite subir instâncias
 * em porta efêmera nos testes de integração. O entrypoint (`server.ts`) é quem
 * dá o `listen`.
 */
export const createGameServer = (): GameServer => {
  const allowedOrigins = resolveOrigins()

  const app = express()

  app.use(helmet())
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

  // Modo "clube local" (LAN): se PUBLIC_DIR apontar para o build do frontend,
  // este servidor também o serve — o jogo roda 100% offline num notebook, sem
  // depender da internet nem de outro host. Opt-in: em produção na nuvem, basta
  // não definir PUBLIC_DIR. SPA fallback para o Vue Router.
  const PUBLIC_DIR = process.env.PUBLIC_DIR
  if (PUBLIC_DIR && existsSync(PUBLIC_DIR)) {
    const dir = resolve(PUBLIC_DIR)

    // Rate limit HTTP nas rotas de arquivo (evita leitura de disco sem limite).
    // Janela/teto generosos: ~12 jogadores no mesmo IP (Wi-Fi do clube) carregam
    // o SPA de uma vez sem tropeçar; ainda barra abuso. Só o socket.io e /health
    // ficam de fora (registrados antes / fora do Express).
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

  io.on('connection', (socket) => {
    console.log(`[connection] Novo jogador: ${socket.id.slice(0, 8)}`)

    joinGameHandler(io, socket)
    configGameHandler(io, socket)
    startGameHandler(io, socket)
    finishStorytellingHandler(io, socket)
    cardsSelectedHandler(io, socket)
    resetGameHandler(io, socket)
    leaveGameHandler(io, socket)
    disconnectHandler(io, socket)
    getRoomsHandler(io, socket)
    rejoinGameHandler(io, socket)
  })

  return { app, httpServer, io, allowedOrigins }
}
