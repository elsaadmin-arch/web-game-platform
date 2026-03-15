import { useState, useRef, useCallback, useEffect } from 'react'
import type { EKGameState } from './GameScreen'
import type { Screen, Player } from './session'
import { loadSession, saveSession, clearSession } from './session'

export function useRoom() {
  const saved = loadSession()

  const [screen, setScreen] = useState<Screen>(saved.screen ?? 'landing')
  const [name, setName] = useState(saved.name ?? '')
  const [joinCode, setJoinCode] = useState('')
  const [roomCode, setRoomCode] = useState(saved.roomCode ?? '')
  const [players, setPlayers] = useState<Player[]>([])
  const [isHost, setIsHost] = useState(saved.isHost ?? false)
  const [gameState, setGameState] = useState<EKGameState | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const playerIdRef = useRef<string>(saved.playerId ?? '')

  const connectWS = useCallback((code: string, playerName: string) => {
    if (wsRef.current) wsRef.current.close()
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${protocol}://${window.location.host}/rooms/${code}`)
    wsRef.current = ws

    ws.onopen = () => {
      const savedId = playerIdRef.current
      if (savedId) {
        ws.send(JSON.stringify({ type: 'rejoin', playerId: savedId, name: playerName }))
      } else {
        ws.send(JSON.stringify({ type: 'join', name: playerName }))
      }
    }

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)

      if (msg.type === 'room_update') {
        setPlayers(msg.room.players)
        if (msg.room.state.phase !== 'waiting') {
          setGameState(msg.room.state as EKGameState)
          setScreen('in-game')
        } else {
          // Game reset (rematch) — go back to waiting room
          setGameState(null)
          setScreen('waiting-room')
        }
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
        setPlayers(prev => prev.find(p => p.id === msg.player.id) ? prev : [...prev, msg.player])
      }

      if (msg.type === 'player_left') {
        setPlayers(prev => prev.filter(p => p.id !== msg.playerId))
      }

      if (msg.type === 'game_over') {
        setGameState(prev => prev ? { ...prev, phase: 'finished', winner: msg.winnerId } : prev)
      }
    }

    ws.onclose = () => {
      setTimeout(() => { if (wsRef.current === ws) connectWS(code, playerName) }, 2000)
    }
  }, [])

  useEffect(() => {
    if (saved.screen === 'waiting-room' && saved.roomCode && saved.name) {
      connectWS(saved.roomCode, saved.name)
    }
    return () => { wsRef.current?.close() }
  }, [])

  const send = useCallback((msg: object) => {
    wsRef.current?.send(JSON.stringify(msg))
  }, [])

  const leave = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
    clearSession()
    playerIdRef.current = ''
    setScreen('landing')
    setRoomCode('')
    setPlayers([])
    setName('')
    setJoinCode('')
    setIsHost(false)
    setGameState(null)
  }, [])

  const createRoom = useCallback(async (playerName: string) => {
    const res = await fetch('/rooms', { method: 'POST' })
    const data = await res.json()
    const code = data.code
    playerIdRef.current = ''
    saveSession({ screen: 'waiting-room', name: playerName, roomCode: code, isHost: true, playerId: '' })
    setRoomCode(code)
    setIsHost(true)
    setScreen('waiting-room')
    connectWS(code, playerName)
  }, [connectWS])

  const joinRoom = useCallback((code: string, playerName: string) => {
    playerIdRef.current = ''
    saveSession({ screen: 'waiting-room', name: playerName, roomCode: code, isHost: false, playerId: '' })
    setRoomCode(code)
    setIsHost(false)
    setScreen('waiting-room')
    connectWS(code, playerName)
  }, [connectWS])

  const returnToLobby = useCallback(() => {
    setGameState(null)
    setScreen('waiting-room')
  }, [])

  return {
    screen, setScreen,
    name, setName,
    joinCode, setJoinCode,
    roomCode,
    players,
    isHost,
    gameState,
    playerId: playerIdRef.current,
    send, leave, returnToLobby, createRoom, joinRoom,
  }
}
