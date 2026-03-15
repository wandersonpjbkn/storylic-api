import type { Server, Socket } from 'socket.io';

import type { JoinGamePayload } from '../types/index.js';
import {
  games,
  createGame,
  getGame,
  getOnlinePlayers,
  getRoomsSnapshot,
} from '../utils/games.js';
import { generateToken } from '../utils/tokens.js';

export const joinGameHandler = (io: Server, socket: Socket) => {
  socket.on('join-game', ({ gameId, playerName }: JoinGamePayload) => {
    socket.join(gameId);

    if (!games.has(gameId)) {
      createGame(gameId);
    }

    const game = getGame(gameId)!;
    const token = generateToken();

    game.players.set(socket.id, {
      id: socket.id,
      name: playerName,
      token,
      disconnectedAt: undefined,
      reservationTimer: undefined,
    });

    console.log(
      `[join-game] "${playerName}" (${socket.id}) entrou em "${gameId}" — ${game.players.size} jogador(es)`,
    );

    socket.emit('join-ack', { token, gameId, gameState: game.gameState });

    io.to(gameId).emit('game-state', {
      currentPlayer: game.currentPlayer,
      players: getOnlinePlayers(game),
    });

    io.emit('rooms-updated', getRoomsSnapshot());
  });
};
