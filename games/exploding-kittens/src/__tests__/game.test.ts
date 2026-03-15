import { describe, it, expect } from 'vitest'
import { ExplodingKittensPlugin, type EKGameState, type Card } from '../index'

const PLAYER_IDS = ['alice', 'bob', 'carol']
const DEFAULT_CONFIG = { maxPlayers: 5 }

describe('ExplodingKittensPlugin', () => {

  describe('getInitialState', () => {
    it('sets phase to playing', () => {
      const state = ExplodingKittensPlugin.getInitialState(PLAYER_IDS, DEFAULT_CONFIG) as EKGameState
      expect(state.phase).toBe('playing')
    })

    it('deals 8 cards to each player (7 + 1 defuse)', () => {
      const state = ExplodingKittensPlugin.getInitialState(PLAYER_IDS, DEFAULT_CONFIG) as EKGameState
      for (const pid of PLAYER_IDS) {
        expect(state.hands[pid]).toHaveLength(8)
      }
    })

    it('gives each player exactly 1 defuse card to start', () => {
      const state = ExplodingKittensPlugin.getInitialState(PLAYER_IDS, DEFAULT_CONFIG) as EKGameState
      for (const pid of PLAYER_IDS) {
        const defuses = state.hands[pid].filter((c: Card) => c.type === 'defuse')
        expect(defuses.length).toBeGreaterThanOrEqual(1)
      }
    })

    it('puts (playerCount - 1) exploding kittens in the deck', () => {
      const state = ExplodingKittensPlugin.getInitialState(PLAYER_IDS, DEFAULT_CONFIG) as EKGameState
      const bombs = state.deck.filter((c: Card) => c.type === 'exploding_kitten')
      expect(bombs).toHaveLength(PLAYER_IDS.length - 1)
    })

    it('sets first player as current player', () => {
      const state = ExplodingKittensPlugin.getInitialState(PLAYER_IDS, DEFAULT_CONFIG) as EKGameState
      expect(state.currentPlayerId).toBe(PLAYER_IDS[0])
    })

    it('no exploding kittens in starting hands', () => {
      const state = ExplodingKittensPlugin.getInitialState(PLAYER_IDS, DEFAULT_CONFIG) as EKGameState
      for (const pid of PLAYER_IDS) {
        const bombs = state.hands[pid].filter((c: Card) => c.type === 'exploding_kitten')
        expect(bombs).toHaveLength(0)
      }
    })

    it('turn order includes all players', () => {
      const state = ExplodingKittensPlugin.getInitialState(PLAYER_IDS, DEFAULT_CONFIG) as EKGameState
      expect(state.turnOrder).toEqual(PLAYER_IDS)
    })
  })

  describe('isGameOver', () => {
    it('returns false when multiple players still have hands', () => {
      const state = ExplodingKittensPlugin.getInitialState(PLAYER_IDS, DEFAULT_CONFIG) as EKGameState
      expect(ExplodingKittensPlugin.isGameOver(state)).toBe(false)
    })

    it('returns true when only one player remains', () => {
      const state = ExplodingKittensPlugin.getInitialState(PLAYER_IDS, DEFAULT_CONFIG) as EKGameState
      // Eliminate bob and carol
      delete (state.hands as any)['bob']
      delete (state.hands as any)['carol']
      expect(ExplodingKittensPlugin.isGameOver(state)).toBe(true)
    })

    it('returns false when two players remain', () => {
      const state = ExplodingKittensPlugin.getInitialState(PLAYER_IDS, DEFAULT_CONFIG) as EKGameState
      delete (state.hands as any)['carol']
      expect(ExplodingKittensPlugin.isGameOver(state)).toBe(false)
    })
  })

  describe('getWinner', () => {
    it('returns null when game is not over', () => {
      const state = ExplodingKittensPlugin.getInitialState(PLAYER_IDS, DEFAULT_CONFIG) as EKGameState
      expect(ExplodingKittensPlugin.getWinner(state)).toBeNull()
    })

    it('returns the surviving player id', () => {
      const state = ExplodingKittensPlugin.getInitialState(PLAYER_IDS, DEFAULT_CONFIG) as EKGameState
      delete (state.hands as any)['bob']
      delete (state.hands as any)['carol']
      expect(ExplodingKittensPlugin.getWinner(state)).toBe('alice')
    })
  })

  describe('2-player edge cases', () => {
    it('initialises correctly with 2 players', () => {
      const state = ExplodingKittensPlugin.getInitialState(['p1', 'p2'], DEFAULT_CONFIG) as EKGameState
      expect(state.deck.filter((c: Card) => c.type === 'exploding_kitten')).toHaveLength(1)
      expect(state.hands['p1']).toHaveLength(8)
      expect(state.hands['p2']).toHaveLength(8)
    })
  })

})
