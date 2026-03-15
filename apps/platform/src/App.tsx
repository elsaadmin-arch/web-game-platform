import { useState } from 'react'
import GameScreen from './GameScreen'
import { useRoom } from './useRoom'

export default function App() {
  const {
    screen, setScreen,
    name, setName,
    joinCode, setJoinCode,
    roomCode, players, isHost, gameState, playerId,
    send, leave, createRoom, joinRoom,
  } = useRoom()

  const [intent, setIntent] = useState<'create' | 'join'>('create')
  const [copied, setCopied] = useState(false)

  async function handleNameConfirm() {
    if (!name.trim()) return
    if (intent === 'create') {
      await createRoom(name.trim())
    } else {
      if (joinCode.trim().length !== 6) return
      joinRoom(joinCode.trim().toUpperCase(), name.trim())
    }
  }

  async function handleCopy() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(roomCode)
      } else {
        const el = document.createElement('input')
        el.value = roomCode
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { setCopied(false) }
  }

  if (screen === 'in-game' && gameState) return (
    <GameScreen state={gameState} players={players} myId={playerId} isHost={isHost} send={send} onLeave={leave} />
  )

  if (screen === 'landing') return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col items-center justify-center px-6 gap-10">
      <div className="text-center">
        <div className="text-5xl mb-3">🎮</div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">Game Room</h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400 text-sm">Play mini-games with friends — no account needed</p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button onClick={() => { setIntent('create'); setScreen('name-prompt') }}
          className="w-full py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold text-base hover:opacity-90 transition">
          Create Room
        </button>
        <button onClick={() => { setIntent('join'); setScreen('name-prompt') }}
          className="w-full py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white font-semibold text-base hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">
          Join Room
        </button>
      </div>
    </div>
  )

  if (screen === 'name-prompt') return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col items-center justify-center px-6 gap-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">{intent === 'create' ? 'Create a Room' : 'Join a Room'}</h2>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400 text-sm">Enter your name to continue</p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <input
          className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 text-base"
          placeholder="Your name" value={name} maxLength={20} autoFocus
          onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleNameConfirm()}
        />
        {intent === 'join' && (
          <input
            className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 text-base uppercase tracking-widest font-mono"
            placeholder="Room code" value={joinCode} maxLength={6}
            onChange={e => setJoinCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && handleNameConfirm()}
          />
        )}
        <button onClick={handleNameConfirm} disabled={!name.trim() || (intent === 'join' && joinCode.length !== 6)}
          className="w-full py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold text-base hover:opacity-90 transition disabled:opacity-30">
          {intent === 'create' ? 'Create Room' : 'Join'}
        </button>
        <button onClick={() => setScreen('landing')} className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition text-center">← Back</button>
      </div>
    </div>
  )

  if (screen === 'waiting-room') return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col items-center justify-center px-6 gap-8">
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-zinc-400 mb-1">Room Code</p>
        <div className="text-5xl font-mono font-bold tracking-widest text-zinc-900 dark:text-white">{roomCode}</div>
        <button onClick={handleCopy}
          className="mt-3 px-4 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">
          {copied ? '✓ Copied!' : 'Copy Code'}
        </button>
      </div>
      <div className="w-full max-w-xs">
        <p className="text-xs uppercase tracking-widest text-zinc-400 mb-3">Players ({players.length})</p>
        <div className="flex flex-col gap-2">
          {players.length === 0 && <div className="text-sm text-zinc-400 text-center py-4">Connecting…</div>}
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
          <button onClick={() => send({ type: 'start_game' })} disabled={players.length < 2}
            className="w-full py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold text-base hover:opacity-90 transition disabled:opacity-30">
            Start Game
          </button>
          {players.length < 2 && <p className="text-center text-xs text-zinc-400">Waiting for at least 2 players…</p>}
        </div>
      ) : (
        <p className="text-sm text-zinc-400">Waiting for host to start…</p>
      )}
      <button onClick={leave} className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition">Leave Room</button>
    </div>
  )

  return null
}
