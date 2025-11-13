require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const games = new Map();

io.on('connection', (socket) => {
  console.log('Novo jogador conectado:', socket.id);

  socket.on('join-game', ({ gameId, playerName, playerNumber }) => {
    socket.join(gameId);
    
    if (!games.has(gameId)) {
      games.set(gameId, {
        currentPlayer: playerNumber,
        currentTurn: 1,
        playerName,
        gameState: 'setup',
        players: new Set()
      });
    }
    
    const game = games.get(gameId);
    game.players.add({
      id: socket.id,
      name: playerName
    });
    
    console.log(`Jogador [ ${playerName} ] entrou na sala [ ${gameId} ]. Sala com [ ${game.players.size} ] players`);
    
    io.to(gameId).emit('game-state', {
      currentPlayer: game.currentPlayer,
      players: Array.from(game.players)
    });
  });

  socket.on('start-game', ({ gameId, currentPlayer, numPlayers, turns }) => {
    const game = games.get(gameId);

    if (game) {
      game.currentPlayer = currentPlayer;
      game.numPlayers = numPlayers;
      game.turns = turns;
      game.currentTurn = 1;
      game.gameState = 'waiting';
      
      io.to(gameId).emit('game-started', game);
      
      io.to(gameId).emit('player-turn', {
        currentPlayer,
        currentTurn: 1 
      });
    }
  });

  socket.on('finish-storytelling', ({ gameId, currentPlayer }) => {
    const game = games.get(gameId);

    if (!game) return;

    const playersArray = Array.from(game.players);

    const currentPlayerIndex = playersArray.findIndex(({ id }) => id === currentPlayer);
    const nextPlayerIndex = currentPlayerIndex + 1
    
    if (nextPlayerIndex >= game.players.size) {
      if (game.currentTurn < game.turns) {
        game.currentTurn++;
        game.currentPlayer = playersArray[0].id;
        
        io.to(gameId).emit('player-turn', {
          currentPlayer: game.currentPlayer,
          currentTurn: game.currentTurn
        });
      } else {    
        game.gameState = 'ended';
        io.to(gameId).emit('game-ended');
      }
    } else {
      game.currentPlayer = playersArray[nextPlayerIndex].id;

      const data = {
        currentPlayer: game.currentPlayer,
        currentTurn: game.currentTurn
      }
      
      io.to(gameId).emit('player-turn', data);
    }
  });

  socket.on('cards-selected', ({ gameId, cards, playerNumber }) => {
    io.to(gameId).emit('player-selected-cards', { 
      cards, 
      playerNumber 
    });
  });

  socket.on('reset-game', ({ gameId }) => {
    const game = games.get(gameId);
    if (game) {
      game.playerName = '';
      game.currentPlayer = '';
      game.currentTurn = 1;
      game.gameState = 'setup';
      
      io.to(gameId).emit('game-reset');
    }
  });

  socket.on('disconnect', () => {
    console.log('Jogador desconectado:', socket.id);
    
    games.forEach((game, gameId) => {
      const playersArray = Array.from(game.players);
      const item = playersArray.find(({ id }) => id === socket.id);

      if (item) {
        game.players.delete(item);

        io.to(gameId).emit('game-state', {
          currentPlayer: game.currentPlayer,
          players: Array.from(game.players)
        });
            
        if (game.players.size === 0) {
          console.log(`Sala [ ${gameId} ] removida devido ausência de jogadores`);

          io.to(gameId).emit('game-reset');
          
          games.delete(gameId);
        }
      }
    });
  });
});

const PORT = process.env.API_PORT || 3000;

if (process.env.NODE_ENV === 'development') {
  server.listen(PORT, process.env.API_LOCALHOST, () => {
    console.log(`🚀 Servidor rodando em https://${process.env.API_LOCALHOST}:${PORT}`);
    console.log(`Acesse na LAN em: Seu_IP_Local:${PORT}`);
  });
} else {
  server.listen(PORT, () => {
    console.log(`🚀 Servidor rodando`);
  });
}
