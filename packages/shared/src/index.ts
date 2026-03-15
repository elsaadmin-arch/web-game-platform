// GamePlugin interface — every game must implement this

export interface GameConfig {
  maxPlayers: number
  [key: string]: unknown // game-specific tuning knobs from CMS
}

export interface GameState {
  phase: 'waiting' | 'playing' | 'inserting_kitten' | 'finished'
  currentPlayerId: string | null
  winner: string | null
  [key: string]: unknown
}

export interface PlayerAction {
  type: string
  playerId: string
  payload?: unknown
}

export interface GamePlugin {
  id: string
  name: string
  minPlayers: number
  maxPlayers: number
  getInitialState(playerIds: string[], config: GameConfig): GameState
  applyAction(state: GameState, action: PlayerAction, config: GameConfig): GameState
  isGameOver(state: GameState): boolean
  getWinner(state: GameState): string | null
}

// Room types
export interface Room {
  id: string           // 6-char code e.g. K7X2QP
  gameId: string
  hostId: string
  players: Player[]
  state: GameState
  createdAt: number
  lastActivityAt: number
}

export interface Player {
  id: string
  name: string
  connected: boolean
}

// WebSocket message types
export type ClientMessage =
  | { type: 'join'; name: string }
  | { type: 'rejoin'; playerId: string; name: string }
  | { type: 'start_game' }
  | { type: 'action'; action: unknown }
  | { type: 'rematch' }
  | { type: 'leave' }

export type ServerMessage =
  | { type: 'room_update'; room: Room }
  | { type: 'player_joined'; player: Player }
  | { type: 'player_left'; playerId: string }
  | { type: 'game_over'; winnerId: string | null }
  | { type: 'error'; message: string }
