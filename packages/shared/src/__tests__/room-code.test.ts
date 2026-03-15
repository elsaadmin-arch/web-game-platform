import { describe, it, expect } from 'vitest'

// Room code format validation (mirrors worker logic)
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

describe('Room code', () => {
  it('is 6 characters long', () => {
    expect(generateRoomCode()).toHaveLength(6)
  })

  it('contains only valid characters (no 0, O, 1, I)', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateRoomCode()
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/)
    }
  })

  it('generates unique codes', () => {
    const codes = new Set(Array.from({ length: 1000 }, generateRoomCode))
    // With 32^6 = 1B possibilities, 1000 codes should all be unique
    expect(codes.size).toBe(1000)
  })
})
