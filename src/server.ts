import 'dotenv/config'

import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'

import { joinGameHandler } from './handlers/joinGame.js'
import { startGameHandler } from './handlers/startGame.js'
import { finishStorytellingHandler } from './handlers/finishStorytelling.js'
import { cardsSelectedHandler } from './handlers/cardsSelected.js'
import { resetGameHandler } from './handlers/resetGame.js'
import { leaveGameHandler } from './handlers/leaveGame.js'
import { disconnectHandler } from './handlers/disconnect.js'
import { getRoomsHandler } from './handlers/getRooms.js'
import { rejoinGameHandler } from './handlers/rejoinGame.js'

const app = express()
app.use(cors())

// Health check simples para verificar se o servidor está no ar
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'POST'],
  },
})

io.on('connection', (socket) => {
  console.log(`[connection] Novo jogador conectado: ${socket.id}`)

  // Registra todos os handlers para este socket
  joinGameHandler(io, socket)
  startGameHandler(io, socket)
  finishStorytellingHandler(io, socket)
  cardsSelectedHandler(io, socket)
  resetGameHandler(io, socket)
  leaveGameHandler(io, socket)
  disconnectHandler(io, socket)
  getRoomsHandler(io, socket)
  rejoinGameHandler(io, socket)
})

const PORT = Number(process.env.API_PORT ?? 3000)
const HOST = process.env.API_LOCALHOST

if (process.env.NODE_ENV === 'development' && HOST) {
  httpServer.listen(PORT, HOST, () => {
    console.log(`🚀 Servidor rodando em http://${HOST}:${PORT}`)
  })
} else {
  httpServer.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`)
  })
}
