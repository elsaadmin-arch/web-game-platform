export type Screen = 'landing' | 'name-prompt' | 'waiting-room' | 'in-game'

export interface Player {
  id: string
  name: string
  connected: boolean
}

export interface Session {
  screen: Screen
  name: string
  roomCode: string
  isHost: boolean
  playerId: string
}

const SESSION_KEY = 'wgp_session'

export function loadSession(): Partial<Session> {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function saveSession(s: Partial<Session>) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}
