import { describe, it, expect } from 'vitest'
import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test'
import worker from '../index'

// Helper: create a room via POST /rooms
async function createRoom(): Promise<string> {
  const res = await SELF.fetch('http://example.com/rooms', { method: 'POST' })
  const { code } = await res.json() as { code: string }
  return code
}

// Helper: connect a WebSocket player to a room
async function connectPlayer(code: string, name: string): Promise<{ ws: WebSocket, messages: any[] }> {
  const messages: any[] = []
  const res = await SELF.fetch(`http://example.com/rooms/${code}`, {
    headers: { Upgrade: 'websocket' },
  })
  const ws = res.webSocket!
  ws.accept()
  ws.addEventListener('message', (e) => {
    messages.push(JSON.parse(e.data as string))
  })
  ws.send(JSON.stringify({ type: 'join', name }))
  // Give DO a tick to process
  await new Promise(r => setTimeout(r, 10))
  return { ws, messages }
}

describe('Room Worker', () => {

  describe('POST /rooms', () => {
    it('returns a 6-char room code', async () => {
      const code = await createRoom()
      expect(code).toMatch(/^[A-Z2-9]{6}$/)
    })

    it('generates unique codes for multiple rooms', async () => {
      const codes = await Promise.all(Array.from({ length: 10 }, createRoom))
      const unique = new Set(codes)
      expect(unique.size).toBe(10)
    })
  })

  describe('Unknown routes', () => {
    it('returns 404 for unknown paths', async () => {
      const res = await SELF.fetch('http://example.com/unknown')
      expect(res.status).toBe(404)
    })

    it('returns 404 for GET /rooms without a code', async () => {
      const res = await SELF.fetch('http://example.com/rooms')
      expect(res.status).toBe(404)
    })
  })

  describe('WebSocket — room join', () => {
    it('player receives room_update on join', async () => {
      const code = await createRoom()
      const { messages } = await connectPlayer(code, 'Alice')
      const roomUpdate = messages.find(m => m.type === 'room_update')
      expect(roomUpdate).toBeDefined()
      expect(roomUpdate.room.id).toBe(code)
    })

    it('first player is set as host', async () => {
      const code = await createRoom()
      const { messages } = await connectPlayer(code, 'Alice')
      const roomUpdate = messages.find(m => m.type === 'room_update')
      const alice = roomUpdate.room.players.find((p: any) => p.name === 'Alice')
      expect(roomUpdate.room.hostId).toBe(alice.id)
    })

    it('second player receives player_joined event', async () => {
      const code = await createRoom()
      const { ws: ws1, messages: msgs1 } = await connectPlayer(code, 'Alice')
      await connectPlayer(code, 'Bob')
      await new Promise(r => setTimeout(r, 10))
      const joined = msgs1.find(m => m.type === 'player_joined' && m.player.name === 'Bob')
      expect(joined).toBeDefined()
      ws1.close()
    })

    it('room lists both players after second join', async () => {
      const code = await createRoom()
      await connectPlayer(code, 'Alice')
      const { messages } = await connectPlayer(code, 'Bob')
      await new Promise(r => setTimeout(r, 10))
      const roomUpdate = messages.find(m => m.type === 'room_update')
      expect(roomUpdate.room.players).toHaveLength(2)
    })
  })

})
