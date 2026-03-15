import type { ClientMessage, ServerMessage, Room, Player } from '@wgp/shared'

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export class RoomDurableObject {
  private sessions: Map<WebSocket, Player> = new Map()
  private room: Room | null = null

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request)
    }

    if (request.method === 'GET' && url.pathname.endsWith('/')) {
      return Response.json(this.room)
    }

    return new Response('Not found', { status: 404 })
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    const { 0: client, 1: server } = new WebSocketPair()

    // Use non-hibernatable pattern — just accept directly
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
      const player = this.sessions.get(server)
      if (player) {
        player.connected = false
        this.sessions.delete(server)
        if (this.room) {
          this.room.players = this.room.players.filter(p => p.id !== player.id)
        }
        this.broadcast({ type: 'player_left', playerId: player.id })
      }
    })

    server.addEventListener('error', () => {
      this.sessions.delete(server)
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

      // Broadcast new player to everyone else first
      this.broadcastExcept(ws, { type: 'player_joined', player })
      // Then send full room state to everyone
      this.broadcast({ type: 'room_update', room: this.room })
    }

    if (msg.type === 'action' && this.room) {
      // TODO: route to game plugin applyAction
      this.room.lastActivityAt = Date.now()
    }

    if (msg.type === 'rematch' && this.room) {
      // TODO: reset game state
      this.room.lastActivityAt = Date.now()
    }
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    try { ws.send(JSON.stringify(msg)) } catch {}
  }

  private broadcast(msg: ServerMessage) {
    for (const ws of this.sessions.keys()) {
      this.send(ws, msg)
    }
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
