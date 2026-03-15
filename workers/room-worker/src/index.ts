import type { ClientMessage, ServerMessage, Room, Player } from '@wgp/shared'

// Generates a 6-char room code (no ambiguous chars)
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export class RoomDurableObject {
  private sessions: Map<WebSocket, Player> = new Map()
  private room: Room | null = null
  private state: DurableObjectState

  constructor(state: DurableObjectState) {
    this.state = state
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request)
    }

    // REST: GET room info
    if (request.method === 'GET' && url.pathname === '/') {
      return Response.json(this.room)
    }

    return new Response('Not found', { status: 404 })
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    const { 0: client, 1: server } = new WebSocketPair()
    this.state.acceptWebSocket(server)

    server.addEventListener('message', (event) => {
      try {
        const msg: ClientMessage = JSON.parse(event.data as string)
        this.handleMessage(server, msg)
      } catch {
        this.send(server, { type: 'error', message: 'Invalid message format' })
      }
    })

    server.addEventListener('close', () => {
      const player = this.sessions.get(server)
      if (player) {
        player.connected = false
        this.sessions.delete(server)
        this.broadcast({ type: 'player_left', playerId: player.id })
      }
    })

    return new Response(null, { status: 101, webSocket: client })
  }

  private handleMessage(ws: WebSocket, msg: ClientMessage) {
    if (msg.type === 'join') {
      const player: Player = {
        id: crypto.randomUUID(),
        name: msg.name,
        connected: true,
      }
      this.sessions.set(ws, player)

      if (!this.room) {
        // Room doesn't exist yet — this player is the host
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

      this.broadcast({ type: 'player_joined', player })
      this.broadcast({ type: 'room_update', room: this.room })
    }

    if (msg.type === 'action' && this.room) {
      // TODO: route to game plugin applyAction, then broadcast new state
      this.room.lastActivityAt = Date.now()
    }

    if (msg.type === 'rematch' && this.room) {
      // TODO: reset game state via game plugin getInitialState
      this.room.lastActivityAt = Date.now()
    }
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    ws.send(JSON.stringify(msg))
  }

  private broadcast(msg: ServerMessage) {
    for (const ws of this.sessions.keys()) {
      this.send(ws, msg)
    }
  }
}

// Worker entry — routes /rooms/:code to the right Durable Object
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const match = url.pathname.match(/^\/rooms\/([A-Z0-9]{6})/)

    if (!match) {
      // Create new room — return a generated code
      if (request.method === 'POST' && url.pathname === '/rooms') {
        const code = generateRoomCode()
        return Response.json({ code })
      }
      return new Response('Not found', { status: 404 })
    }

    const code = match[1]
    const id = env.ROOMS.idFromName(code)
    const stub = env.ROOMS.get(id)
    return stub.fetch(request)
  },
}

interface Env {
  ROOMS: DurableObjectNamespace
}
