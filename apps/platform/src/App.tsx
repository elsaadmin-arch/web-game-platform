import { useState } from 'react'

type Screen = 'lobby' | 'room'

export default function App() {
  const [screen, setScreen] = useState<Screen>('lobby')
  const [roomCode, setRoomCode] = useState('')
  const [inputCode, setInputCode] = useState('')

  const createRoom = async () => {
    const res = await fetch('/rooms', { method: 'POST' })
    const { code } = await res.json()
    setRoomCode(code)
    setScreen('room')
  }

  const joinRoom = () => {
    if (inputCode.trim().length === 6) {
      setRoomCode(inputCode.trim().toUpperCase())
      setScreen('room')
    }
  }

  if (screen === 'room') {
    return (
      <div style={{ padding: 32 }}>
        <h1>Room: {roomCode}</h1>
        <p>Waiting for players... (game UI coming soon)</p>
        <button onClick={() => setScreen('lobby')}>Leave</button>
      </div>
    )
  }

  return (
    <div style={{ padding: 32 }}>
      <h1>🎮 Web Game Platform</h1>
      <div style={{ marginTop: 24 }}>
        <button onClick={createRoom}>Create Room</button>
      </div>
      <div style={{ marginTop: 16 }}>
        <input
          placeholder="Enter room code"
          value={inputCode}
          onChange={e => setInputCode(e.target.value.toUpperCase())}
          maxLength={6}
        />
        <button onClick={joinRoom} style={{ marginLeft: 8 }}>Join Room</button>
      </div>
    </div>
  )
}
