import { useState, useEffect, useRef, useCallback } from 'react'

type Screen = 'landing' | 'name-prompt' | 'waiting-room'
type Intent = 'create' | 'join'

interface Player {
  id: string
  name: string
  connected: boolean
}

interface Session {
  screen: Screen
  name: string
  roomCode: string
  isHost: boolean
  playerId: string
}

const SESSION_KEY = 'wgp_session'

function loadSession(): Partial<Session> {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveSession(s: Partial<Session>) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s))
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

export default function App() {
  const saved = loadSession()

  const [screen, setScreen] = useState<Screen>(saved.screen ?? 'landing')
  const [intent, setIntent] = useState<Intent>('create')
  const [name, setName] = useState(saved.name ?? '')
  const [joinCode, setJoinCode] = useState('')
  const [roomCode, setRoomCode] = useState(saved.roomCode ?? '')
  const [players, setPlayers] = useState<Player[]>([])
  const [isHost, setIsHost] = useState(saved.isHost ?? false)
  const [copied, setCopied] = useState(false)
  const [gameStarted, setGameStarted] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const playerIdRef = useRef<string>(saved.playerId ?? '')

  const connectWS = useCallback((code: string, playerName: string) => {
    if (wsRef.current) wsRef.current.close()

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${protocol}://${window.location.host}/rooms/${code}`)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', name: playerName }))
    }

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)

      if (msg.type === 'room_update') {
        setPlayers(msg.room.players)
        // First time we get our player id from the room
        if (!playerIdRef.current) {
          const me = msg.room.players.find((p: Player) => p.name === playerName)
          if (me) {
            playerIdRef.current = me.id
            saveSession({ screen: 'waiting-room', name: playerName, roomCode: code, isHost: msg.room.hostId === me.id, playerId: me.id })
            setIsHost(msg.room.hostId === me.id)
          }
        } else {
          setIsHost(msg.room.hostId === playerIdRef.current)
        }
      }

      if (msg.type === 'player_joined') {
        setPlayers(prev => {
          if (prev.find(p => p.id === msg.player.id)) return prev
          return [...prev, msg.player]
        })
      }

      if (msg.type === 'player_left') {
        setPlayers(prev => prev.filter(p => p.id !== msg.playerId))
      }

      if (msg.type === 'game_start') {
        setGameStarted(true)
      }
    }

    ws.onclose = () => {
      // Auto-reconnect after 2s if still in waiting room
      setTimeout(() => {
        if (wsRef.current === ws) connectWS(code, playerName)
      }, 2000)
    }
  }, [])

  // Reconnect on mount if session exists
  useEffect(() => {
    if (saved.screen === 'waiting-room' && saved.roomCode && saved.name) {
      connectWS(saved.roomCode, saved.name)
    }
    return () => { wsRef.current?.close() }
  }, [])

  const handleCreate = () => { setIntent('create'); setScreen('name-prompt') }
  const handleJoin = () => { setIntent('join'); setScreen('name-prompt') }

  const handleNameConfirm = async () => {
    if (!name.trim()) return
    let code = ''
    let host = false

    if (intent === 'create') {
      const res = await fetch('/rooms', { method: 'POST' })
      const data = await res.json()
      code = data.code
      host = true
    } else {
      if (joinCode.trim().length !== 6) return
      code = joinCode.trim().toUpperCase()
    }

    setRoomCode(code)
    setIsHost(host)
    playerIdRef.current = ''
    saveSession({ screen: 'waiting-room', name: name.trim(), roomCode: code, isHost: host, playerId: '' })
    setScreen('waiting-room')
    connectWS(code, name.trim())
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(roomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleStartGame = () => {
    wsRef.current?.send(JSON.stringify({ type: 'start_game' }))
  }

  const leaveRoom = () => {
    wsRef.current?.close()
    wsRef.current = null
    clearSession()
    setScreen('landing')
    setRoomCode('')
    setPlayers([])
    setName('')
    setJoinCode('')
    setIsHost(false)
    setGameStarted(false)
    playerIdRef.current = ''
  }

  // --- Screens ---

  if (screen === 'landing') return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col items-center justify-center px-6 gap-10">
      <div className="text-center">
        <div className="text-5xl mb-3">🎮</div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">Game Room</h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400 text-sm">Play mini-games with friends — no account needed</p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button onClick={handleCreate} className="w-full py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold text-base hover:opacity-90 transition">
          Create Room
        </button>
        <button onClick={handleJoin} className="w-full py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white font-semibold text-base hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">
          Join Room
        </button>
      </div>
    </div>
  )

  if (screen === 'name-prompt') return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col items-center justify-center px-6 gap-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
          {intent === 'create' ? 'Create a Room' : 'Join a Room'}
        </h2>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400 text-sm">Enter your name to continue</p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <input
          className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 text-base"
          placeholder="Your name"
          value={name}
          maxLength={20}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleNameConfirm()}
          autoFocus
        />
        {intent === 'join' && (
          <input
            className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 text-base uppercase tracking-widest font-mono"
            placeholder="Room code"
            value={joinCode}
            maxLength={6}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleNameConfirm()}
          />
        )}
        <button
          onClick={handleNameConfirm}
          disabled={!name.trim() || (intent === 'join' && joinCode.length !== 6)}
          className="w-full py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold text-base hover:opacity-90 transition disabled:opacity-30"
        >
          {intent === 'create' ? 'Create Room' : 'Join'}
        </button>
        <button onClick={() => setScreen('landing')} className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition text-center">
          ← Back
        </button>
      </div>
    </div>
  )

  if (screen === 'waiting-room') return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col items-center justify-center px-6 gap-8">
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-zinc-400 mb-1">Room Code</p>
        <div className="text-5xl font-mono font-bold tracking-widest text-zinc-900 dark:text-white">{roomCode}</div>
        <button
          onClick={handleCopy}
          className="mt-3 px-4 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
        >
          {copied ? '✓ Copied!' : 'Copy Code'}
        </button>
      </div>

      <div className="w-full max-w-xs">
        <p className="text-xs uppercase tracking-widest text-zinc-400 mb-3">Players ({players.length})</p>
        <div className="flex flex-col gap-2">
          {players.length === 0 && (
            <div className="text-sm text-zinc-400 text-center py-4">Connecting…</div>
          )}
          {players.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-900">
              <div className={`w-2 h-2 rounded-full ${p.connected ? 'bg-emerald-400' : 'bg-zinc-300'}`} />
              <span className="text-zinc-900 dark:text-white font-medium text-sm">{p.name}</span>
              {i === 0 && <span className="ml-auto text-xs text-zinc-400">host</span>}
            </div>
          ))}
        </div>
      </div>

      {isHost ? (
        <div className="w-full max-w-xs flex flex-col gap-3">
          <button
            onClick={handleStartGame}
            disabled={players.length < 2}
            className="w-full py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold text-base hover:opacity-90 transition disabled:opacity-30"
          >
            Start Game
          </button>
          {players.length < 2 && (
            <p className="text-center text-xs text-zinc-400">Waiting for at least 2 players…</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-zinc-400">Waiting for host to start the game…</p>
      )}

      <button onClick={leaveRoom} className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition">
        Leave Room
      </button>
    </div>
  )

  return null
}
