import type { ClientMessage, ServerMessage, Room, Player } from '@wgp/shared'
import { ExplodingKittensPlugin } from '@wgp/game-exploding-kittens'

const PLUGINS = {
  'exploding-kittens': ExplodingKittensPlugin,
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export class RoomDurableObject {
  private sessions: Map<WebSocket, string> = new Map()  // ws -> playerId
  private room: Room | null = null
  private state: DurableObjectState

  constructor(state: DurableObjectState) {
    this.state = state
  }

  async fetch(request: Request): Promise<Response> {
    if (!this.room) {
      this.room = await this.state.storage.get<Room>('room') ?? null
    }

    const url = new URL(request.url)

    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request)
    }

    if (request.method === 'GET') {
      return Response.json(this.room)
    }

    return new Response('Not found', { status: 404 })
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    const { 0: client, 1: server } = new WebSocketPair()
    server.accept()

    server.addEventListener('message', (event) => {
      try {
        const msg: ClientMessage = JSON.parse(event.data as string)
        this.handleMessage(server, msg)
      } catch {
        this.send(server, { type: 'error', message: 'Invalid message format' })
      }
    })

    server.addEventListener('close', () => {
      const playerId = this.sessions.get(server)
      if (playerId && this.room) {
        const player = this.room.players.find(p => p.id === playerId)
        if (player) player.connected = false
        this.sessions.delete(server)
        this.saveRoom()
        this.broadcast({ type: 'player_left', playerId })
      }
    })

    server.addEventListener('error', () => {
      this.sessions.delete(server)
    })

    return new Response(null, { status: 101, webSocket: client })
  }

  private handleMessage(ws: WebSocket, msg: ClientMessage) {
    if (msg.type === 'rejoin') {
      if (!this.room) {
        this.send(ws, { type: 'error', message: 'Room not found' })
        return
      }
      const player = this.room.players.find(p => p.id === msg.playerId)
      if (!player) {
        this.handleMessage(ws, { type: 'join', name: msg.name })
        return
      }
      player.connected = true
      this.sessions.set(ws, player.id)
      this.saveRoom()
      this.broadcast({ type: 'room_update', room: this.room })
      return
    }

    if (msg.type === 'join') {
      const player: Player = {
        id: crypto.randomUUID(),
        name: msg.name,
        connected: true,
      }
      this.sessions.set(ws, player.id)

      if (!this.room) {
        this.room = {
          id: generateRoomCode(),
          gameId: 'exploding-kittens',
          hostId: player.id,
          players: [player],
          state: { phase: 'waiting', currentPlayerId: null, winner: null },
          createdAt: Date.now(),
          lastActivityAt: Date.now(),
        }
      } else {
        this.room.players.push(player)
        this.room.lastActivityAt = Date.now()
      }

      this.saveRoom()
      this.broadcastExcept(ws, { type: 'player_joined', player })
      this.broadcast({ type: 'room_update', room: this.room })
      return
    }

    if (msg.type === 'start_game') {
      if (!this.room) return
      const playerId = this.sessions.get(ws)
      if (playerId !== this.room.hostId) {
        this.send(ws, { type: 'error', message: 'Only the host can start the game' })
        return
      }
      if (this.room.players.length < 2) {
        this.send(ws, { type: 'error', message: 'Need at least 2 players' })
        return
      }

      const plugin = PLUGINS[this.room.gameId as keyof typeof PLUGINS]
      if (!plugin) {
        this.send(ws, { type: 'error', message: 'Unknown game' })
        return
      }

      const playerIds = this.room.players.map(p => p.id)
      this.room.state = plugin.getInitialState(playerIds, { maxPlayers: plugin.maxPlayers })
      this.room.lastActivityAt = Date.now()
      this.saveRoom()
      this.broadcast({ type: 'room_update', room: this.room })
      return
    }

    if (msg.type === 'action' && this.room) {
      const playerId = this.sessions.get(ws)
      if (!playerId) return

      const plugin = PLUGINS[this.room.gameId as keyof typeof PLUGINS]
      if (!plugin) return

      if (this.room.state.phase === 'waiting' || this.room.state.phase === 'finished') {
        this.send(ws, { type: 'error', message: 'Game is not in progress' })
        return
      }

      try {
        const newState = plugin.applyAction(
          this.room.state,
          { type: 'ek', playerId, payload: msg.action },
          { maxPlayers: plugin.maxPlayers }
        )

        this.room.state = newState
        this.room.lastActivityAt = Date.now()
        this.saveRoom()
        this.broadcast({ type: 'room_update', room: this.room })

        // Check win condition
        if (plugin.isGameOver(newState)) {
          const winner = plugin.getWinner(newState)
          this.broadcast({ type: 'game_over', winnerId: winner })
        }
      } catch (err) {
        this.send(ws, { type: 'error', message: 'Invalid action' })
      }
      return
    }

    if (msg.type === 'rematch' && this.room) {
      const playerId = this.sessions.get(ws)
      if (playerId !== this.room.hostId) return

      this.room.state = { phase: 'waiting', currentPlayerId: null, winner: null }
      this.room.lastActivityAt = Date.now()
      this.saveRoom()
      this.broadcast({ type: 'room_update', room: this.room })
      return
    }
  }

  private saveRoom() {
    if (this.room) this.state.storage.put('room', this.room)
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    try { ws.send(JSON.stringify(msg)) } catch {}
  }

  private broadcast(msg: ServerMessage) {
    for (const ws of this.sessions.keys()) this.send(ws, msg)
  }

  private broadcastExcept(skip: WebSocket, msg: ServerMessage) {
    for (const ws of this.sessions.keys()) {
      if (ws !== skip) this.send(ws, msg)
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const match = url.pathname.match(/^\/rooms\/([A-Z2-9]{6})/)

    if (match) {
      const code = match[1]
      const id = env.ROOMS.idFromName(code)
      const stub = env.ROOMS.get(id)
      return stub.fetch(request)
    }

    if (request.method === 'POST' && url.pathname === '/rooms') {
      const code = generateRoomCode()
      return Response.json({ code })
    }

    return new Response('Not found', { status: 404 })
  },
}

interface Env {
  ROOMS: DurableObjectNamespace
}
