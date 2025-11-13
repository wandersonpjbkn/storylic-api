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
    
    console.log(`Jogador ${playerName} entrou na sala ${gameId}`);
    console.log(`Sala atual com ${game.players.size} jogadores`);
    
    io.to(gameId).emit('game-state', {
      players: Array.from(game.players)
    });
  });

  socket.on('start-game', ({ gameId, playerName, currentPlayer, numPlayers, turns }) => {
    const game = games.get(gameId);
    if (game) {
      game.numPlayers = numPlayers;
      game.gameState = 'waiting';
      game.currentPlayer = currentPlayer;
      game.playerName = playerName;
      game.currentTurn = 1;
      game.turns = turns;
      
      io.to(gameId).emit('game-started', game);
      
      io.to(gameId).emit('player-turn', {
        playerName,
        currentPlayer,
        currentTurn: 1 
      });
    }
  });

  socket.on('finish-storytelling', ({ gameId }) => {
    const game = games.get(gameId);

    if (!game) return;

    const playersArray = Array.from(game.players);
    const currentPlayerIndex = playersArray.findIndex(({ id }) => id === game.currentPlayer);
    const nextPlayerIndex = currentPlayerIndex + 1
    
    if (nextPlayerIndex >= game.players.size) {  
      if (game.currentTurn < game.turns) {
        game.currentTurn++;
        game.currentPlayer = playersArray[0].id;
        
        io.to(gameId).emit('player-turn', {
          playerName: game.playerName,
          currentPlayer: game.currentPlayer,
          currentTurn: game.currentTurn
        });
      } else {    
        game.gameState = 'ended';
        io.to(gameId).emit('game-ended');
      }
    } else {
      game.currentPlayer = playersArray[nextPlayerIndex].id;
      
      io.to(gameId).emit('player-turn', {
        playerName: playersArray[nextPlayerIndex].name,
        currentPlayer: game.currentPlayer,
        currentTurn: game.currentTurn
      });
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
          players: Array.from(game.players)
        });
            
        if (game.players.size === 0) {
          console.log(`Sala ${gameId} removida (sem jogadores)`);

          io.to(gameId).emit('game-reset');
          
          games.delete(gameId);
        }
      }
    });
  });
});

const PORT = process.env.API_PORT || 3000;
const HOST = process.env.NODE_ENV === 'development'
  ? process.env.API_LOCALHOST
  : process.env.API_HOST;

  console.log(process.env.NODE_ENV)

server.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor rodando em https://${HOST}:${PORT}`);
  console.log(`Acesse na LAN em: Seu_IP_Local:${PORT}`);
});