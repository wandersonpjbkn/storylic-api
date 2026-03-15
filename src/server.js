require('dotenv').config()

const express = require('express')
const http = require('http')
const socketIo = require('socket.io')
const cors = require('cors')

const app = express()
app.use(cors())

const server = http.createServer(app)
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

const games = new Map()

const getPlayersArray = (game) => Array.from(game.players.values())

io.on('connection', (socket) => {
  console.log('Novo jogador conectado:', socket.id)

  socket.on('join-game', ({ gameId, playerName }) => {
    socket.join(gameId)

    if (!games.has(gameId)) {
      games.set(gameId, {
        currentPlayer: null,
        currentTurn: 1,
        turns: 3,
        numPlayers: 0,
        gameState: 'setup',
        players: new Map(),
      })
    }

    const game = games.get(gameId)

    game.players.set(socket.id, { id: socket.id, name: playerName })

    console.log(
      `Jogador [ ${playerName} ] entrou na sala [ ${gameId} ]. Sala com [ ${game.players.size} ] players`,
    )

    io.to(gameId).emit('game-state', {
      currentPlayer: game.currentPlayer,
      players: getPlayersArray(game),
    })
  })

  socket.on('start-game', ({ gameId, currentPlayer, numPlayers, turns }) => {
    const game = games.get(gameId)
    if (!game) return

    game.currentPlayer = currentPlayer
    game.numPlayers = numPlayers
    game.turns = turns
    game.currentTurn = 1
    game.gameState = 'playing'

    io.to(gameId).emit('player-turn', {
      currentPlayer,
      currentTurn: 1,
    })
  })

  socket.on('finish-storytelling', ({ gameId, currentPlayer }) => {
    const game = games.get(gameId)
    if (!game) return

    const playersArray = getPlayersArray(game)
    const currentIndex = playersArray.findIndex(({ id }) => id === currentPlayer)

    if (currentIndex === -1) {
      console.warn(`finish-storytelling: jogador ${currentPlayer} não encontrado na sala ${gameId}`)
      return
    }

    const nextIndex = currentIndex + 1

    if (nextIndex >= playersArray.length) {
      // Último jogador do turno atual
      if (game.currentTurn < game.turns) {
        game.currentTurn++
        game.currentPlayer = playersArray[0].id

        io.to(gameId).emit('player-turn', {
          currentPlayer: game.currentPlayer,
          currentTurn: game.currentTurn,
        })
      } else {
        game.gameState = 'ended'
        io.to(gameId).emit('game-ended')
      }
    } else {
      game.currentPlayer = playersArray[nextIndex].id

      io.to(gameId).emit('player-turn', {
        currentPlayer: game.currentPlayer,
        currentTurn: game.currentTurn,
      })
    }
  })

  socket.on('cards-selected', ({ gameId, cards, playerNumber }) => {
    io.to(gameId).emit('player-selected-cards', {
      cards,
      playerNumber,
    })
  })

  socket.on('reset-game', ({ gameId }) => {
    const game = games.get(gameId)
    if (!game) return

    game.currentPlayer = null
    game.currentTurn = 1
    game.gameState = 'setup'

    io.to(gameId).emit('game-reset')
  })

  socket.on('leave-game', ({ gameId }) => {
    const game = games.get(gameId)
    if (!game) return

    game.players.delete(socket.id)
    socket.leave(gameId)

    console.log(`Jogador ${socket.id} saiu da sala ${gameId}`)

    if (game.players.size === 0) {
      console.log(`Sala [ ${gameId} ] removida — sem jogadores`)
      games.delete(gameId)
    } else {
      io.to(gameId).emit('game-state', {
        currentPlayer: game.currentPlayer,
        players: getPlayersArray(game),
      })
    }
  })

  socket.on('disconnect', () => {
    console.log('Jogador desconectado:', socket.id)

    games.forEach((game, gameId) => {
      if (!game.players.has(socket.id)) return

      game.players.delete(socket.id)

      if (game.players.size === 0) {
        console.log(`Sala [ ${gameId} ] removida devido ausência de jogadores`)
        io.to(gameId).emit('game-reset')
        games.delete(gameId)
      } else {
        io.to(gameId).emit('game-state', {
          currentPlayer: game.currentPlayer,
          players: getPlayersArray(game),
        })
      }
    })
  })
})

const PORT = process.env.API_PORT || 3000

if (process.env.NODE_ENV === 'development') {
  server.listen(PORT, process.env.API_LOCALHOST, () => {
    console.log(`🚀 Servidor rodando em https://${process.env.API_LOCALHOST}:${PORT}`)
  })
} else {
  server.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`)
  })
}
