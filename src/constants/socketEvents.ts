export enum SocketEvents {
  // config
  STORAGE_KEY = 'storylic_session',

  // state
  STATE_CONFIG = 'config',
  STATE_SETUP = 'setup',
  STATE_WAITING = 'waiting',
  STATE_LOBBY = 'lobby',
  STATE_ROOMS = 'rooms',
  STATE_PLAYING = 'playing',
  STATE_STORYTELLING = 'storytelling',
  STATE_ENDED = 'ended',

  // on
  ON_CONNECT = 'connect',
  ON_DISCONNECT = 'disconnect',
  ON_JOIN_ACK = 'join-ack',
  ON_JOIN_ERROR = 'join-error',
  ON_REJOIN_ACK = 'rejoin-ack',
  ON_REJOIN_ERROR = 'rejoin-error',
  ON_ROOM_CONFIG = 'room-config',
  ON_GAME_STATE = 'game-state',
  ON_GAME_ENDED = 'game-ended',
  ON_GAME_RESET = 'game-reset',
  ON_PLAYER_TURN = 'player-turn',
  ON_PLAYER_SELECTED_CARDS = 'player-selected-cards',
  ON_PLAYER_DISCONNECTED = 'player-disconnected',
  ON_PLAYER_RECONNECTED = 'player-reconnected',
  ON_ROOMS_UPDATED = 'rooms-updated',
  ON_CONFIG_ERROR = 'config-error',

  // emit
  EMIT_JOIN_GAME = 'join-game',
  EMIT_REJOIN_GAME = 'rejoin-game',
  EMIT_LEAVE_GAME = 'leave-game',
  EMIT_START_GAME = 'start-game',
  EMIT_CONFIG_GAME = 'config-game',
  EMIT_RESET_GAME = 'reset-game',
  EMIT_GET_ROOMS = 'get-rooms',
  EMIT_CARDS_SELECTED = 'cards-selected',
  EMIT_FINISH_STORYTELLING = 'finish-storytelling',
}
