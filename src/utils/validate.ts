const MAX_GAME_ID_LENGTH = 32
const MAX_PLAYER_NAME_LENGTH = 24
const MIN_TIMER = 5
const MAX_TIMER_TURN = 120
const MAX_TIMER_STORY = 300
const MAX_TURNS = 20
const MIN_TURNS = 1

const SAFE_ID_REGEX = /^[a-z0-9_-]+$/

const isString = (v: unknown): v is string => typeof v === 'string'
const isInteger = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && isFinite(v)

export const validateGameId = (gameId: unknown): string | null => {
  if (!isString(gameId)) return 'gameId deve ser uma string'
  if (gameId.trim().length === 0) return 'gameId não pode ser vazio'
  if (gameId.length > MAX_GAME_ID_LENGTH) return `gameId máximo ${MAX_GAME_ID_LENGTH} caracteres`
  if (!SAFE_ID_REGEX.test(gameId)) return 'gameId contém caracteres inválidos'
  return null
}

export const validatePlayerName = (name: unknown): string | null => {
  if (!isString(name)) return 'playerName deve ser uma string'
  if (name.trim().length === 0) return 'playerName não pode ser vazio'
  if (name.length > MAX_PLAYER_NAME_LENGTH)
    return `playerName máximo ${MAX_PLAYER_NAME_LENGTH} caracteres`
  return null
}

export const validateTimerTurn = (v: unknown): string | null => {
  if (!isInteger(v)) return 'timerTurn deve ser um inteiro'
  if (v < MIN_TIMER || v > MAX_TIMER_TURN)
    return `timerTurn deve estar entre ${MIN_TIMER} e ${MAX_TIMER_TURN}`
  return null
}

export const validateTimerStory = (v: unknown): string | null => {
  if (!isInteger(v)) return 'timerStory deve ser um inteiro'
  if (v < MIN_TIMER || v > MAX_TIMER_STORY)
    return `timerStory deve estar entre ${MIN_TIMER} e ${MAX_TIMER_STORY}`
  return null
}

export const validateTurns = (v: unknown): string | null => {
  if (!isInteger(v)) return 'turns deve ser um inteiro'
  if (v < MIN_TURNS || v > MAX_TURNS) return `turns deve estar entre ${MIN_TURNS} e ${MAX_TURNS}`
  return null
}

export const validateToken = (v: unknown): string | null => {
  if (!isString(v)) return 'token deve ser uma string'
  if (v.length !== 48) return 'token com tamanho inválido' // 24 bytes hex = 48 chars
  if (!/^[0-9a-f]+$/.test(v)) return 'token com formato inválido'
  return null
}
