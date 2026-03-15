import { describe, it, expect } from 'vitest'
import { ExplodingKittensPlugin, getAlivePlayers, shuffle, type EKGameState, type Card, type EKAction } from '../index'

const PLAYERS = ['alice', 'bob', 'carol']
const TWO_PLAYERS = ['alice', 'bob']
const CONFIG = { maxPlayers: 5 }

function makeAction(playerId: string, payload: EKAction) {
  return { type: 'ek', playerId, payload }
}

function stateWith(overrides: Partial<EKGameState>): EKGameState {
  const base = ExplodingKittensPlugin.getInitialState(PLAYERS, CONFIG) as EKGameState
  return { ...base, ...overrides }
}

// ─── Initial state ─────────────────────────────────────────────────────────

describe('getInitialState', () => {
  it('sets phase to playing', () => {
    const s = ExplodingKittensPlugin.getInitialState(PLAYERS, CONFIG) as EKGameState
    expect(s.phase).toBe('playing')
  })

  it('deals 8 cards to each player (7 + 1 defuse)', () => {
    const s = ExplodingKittensPlugin.getInitialState(PLAYERS, CONFIG) as EKGameState
    for (const pid of PLAYERS) expect(s.hands[pid]).toHaveLength(8)
  })

  it('each player starts with exactly 1 defuse', () => {
    const s = ExplodingKittensPlugin.getInitialState(PLAYERS, CONFIG) as EKGameState
    for (const pid of PLAYERS) {
      expect(s.hands[pid].filter(c => c.type === 'defuse')).toHaveLength(1)
    }
  })

  it('no exploding kittens in starting hands', () => {
    const s = ExplodingKittensPlugin.getInitialState(PLAYERS, CONFIG) as EKGameState
    for (const pid of PLAYERS) {
      expect(s.hands[pid].filter(c => c.type === 'exploding_kitten')).toHaveLength(0)
    }
  })

  it('puts playerCount - 1 bombs in the deck', () => {
    const s = ExplodingKittensPlugin.getInitialState(PLAYERS, CONFIG) as EKGameState
    expect(s.deck.filter(c => c.type === 'exploding_kitten')).toHaveLength(PLAYERS.length - 1)
  })

  it('first player is current player', () => {
    const s = ExplodingKittensPlugin.getInitialState(PLAYERS, CONFIG) as EKGameState
    expect(s.currentPlayerId).toBe(PLAYERS[0])
  })
})

// ─── Draw card ─────────────────────────────────────────────────────────────

describe('draw_card', () => {
  it('draws the top card into hand', () => {
    const base = ExplodingKittensPlugin.getInitialState(PLAYERS, CONFIG) as EKGameState
    const topCard: Card = { id: 'skip-99', type: 'skip' }
    const s = stateWith({ deck: [topCard, ...base.deck.filter(c => c.type !== 'exploding_kitten')] })
    const result = ExplodingKittensPlugin.applyAction(s, makeAction('alice', { type: 'draw_card' }), CONFIG) as EKGameState
    expect(result.hands['alice']).toContainEqual(topCard)
  })

  it('advances turn to next player after drawing', () => {
    const base = ExplodingKittensPlugin.getInitialState(PLAYERS, CONFIG) as EKGameState
    const safeDeck = base.deck.filter(c => c.type !== 'exploding_kitten')
    const s = stateWith({ deck: safeDeck })
    const result = ExplodingKittensPlugin.applyAction(s, makeAction('alice', { type: 'draw_card' }), CONFIG) as EKGameState
    expect(result.currentPlayerId).toBe('bob')
  })

  it('non-current player cannot draw', () => {
    const s = ExplodingKittensPlugin.getInitialState(PLAYERS, CONFIG) as EKGameState
    const result = ExplodingKittensPlugin.applyAction(s, makeAction('bob', { type: 'draw_card' }), CONFIG) as EKGameState
    expect(result.currentPlayerId).toBe('alice')  // turn unchanged
  })

  it('drawing a bomb without defuse eliminates the player', () => {
    const base = ExplodingKittensPlugin.getInitialState(PLAYERS, CONFIG) as EKGameState
    const bomb: Card = { id: 'exploding_kitten-test', type: 'exploding_kitten' }
    // Remove alice's defuse so she has none
    const handWithoutDefuse = base.hands['alice'].filter(c => c.type !== 'defuse')
    const s = stateWith({ deck: [bomb], hands: { ...base.hands, alice: handWithoutDefuse } })
    const result = ExplodingKittensPlugin.applyAction(s, makeAction('alice', { type: 'draw_card' }), CONFIG) as EKGameState
    expect(result.hands['alice']).toBeUndefined()
    expect(getAlivePlayers(result)).not.toContain('alice')
  })

  it('drawing a bomb with defuse uses defuse and enters inserting_kitten phase', () => {
    const base = ExplodingKittensPlugin.getInitialState(PLAYERS, CONFIG) as EKGameState
    const bomb: Card = { id: 'exploding_kitten-test', type: 'exploding_kitten' }
    // Ensure alice has a defuse
    const handWithDefuse = [...base.hands['alice'].filter(c => c.type !== 'defuse'), { id: 'defuse-test', type: 'defuse' as const }]
    const s = stateWith({ deck: [bomb], hands: { ...base.hands, alice: handWithDefuse } })
    const result = ExplodingKittensPlugin.applyAction(s, makeAction('alice', { type: 'draw_card' }), CONFIG) as EKGameState
    expect(result.phase).toBe('inserting_kitten')
    expect(result.hands['alice'].filter(c => c.type === 'defuse')).toHaveLength(0)  // defuse used
    expect(getAlivePlayers(result)).toContain('alice')  // still alive
  })

  it('insert_kitten puts bomb back at specified position', () => {
    const base = ExplodingKittensPlugin.getInitialState(PLAYERS, CONFIG) as EKGameState
    const safeDeck: Card[] = [
      { id: 'skip-1', type: 'skip' },
      { id: 'skip-2', type: 'skip' },
      { id: 'skip-3', type: 'skip' },
    ]
    const s = stateWith({ phase: 'inserting_kitten', deck: safeDeck, currentPlayerId: 'alice' })
    const result = ExplodingKittensPlugin.applyAction(s, makeAction('alice', { type: 'insert_kitten', position: 1 }), CONFIG) as EKGameState
    expect(result.deck[1].type).toBe('exploding_kitten')
    expect(result.phase).toBe('playing')
  })
})

// ─── Skip ──────────────────────────────────────────────────────────────────

describe('skip card', () => {
  it('ends turn without drawing', () => {
    const base = ExplodingKittensPlugin.getInitialState(PLAYERS, CONFIG) as EKGameState
    const skipCard: Card = { id: 'skip-test', type: 'skip' }
    const hand = [...base.hands['alice'], skipCard]
    const s = stateWith({ hands: { ...base.hands, alice: hand } })
    const result = ExplodingKittensPlugin.applyAction(s, makeAction('alice', { type: 'play_card', cardId: 'skip-test' }), CONFIG) as EKGameState
    expect(result.currentPlayerId).toBe('bob')
  })

  it('skip during attack reduces attack count', () => {
    const base = ExplodingKittensPlugin.getInitialState(PLAYERS, CONFIG) as EKGameState
    const skipCard: Card = { id: 'skip-test', type: 'skip' }
    const hand = [...base.hands['alice'], skipCard]
    const s = stateWith({ hands: { ...base.hands, alice: hand }, attacksRemaining: 2, currentPlayerId: 'alice' })
    const result = ExplodingKittensPlugin.applyAction(s, makeAction('alice', { type: 'play_card', cardId: 'skip-test' }), CONFIG) as EKGameState
    // Should still be alice's turn with 1 attack remaining
    expect(result.currentPlayerId).toBe('alice')
    expect(result.attacksRemaining).toBe(1)
  })
})

// ─── Attack ────────────────────────────────────────────────────────────────

describe('attack card', () => {
  it('passes turn to next player with 2 attacks', () => {
    const base = ExplodingKittensPlugin.getInitialState(PLAYERS, CONFIG) as EKGameState
    const attackCard: Card = { id: 'attack-test', type: 'attack' }
    const hand = [...base.hands['alice'], attackCard]
    const s = stateWith({ hands: { ...base.hands, alice: hand } })
    const result = ExplodingKittensPlugin.applyAction(s, makeAction('alice', { type: 'play_card', cardId: 'attack-test' }), CONFIG) as EKGameState
    expect(result.currentPlayerId).toBe('bob')
    expect(result.attacksRemaining).toBe(2)
  })
})

// ─── See the Future ────────────────────────────────────────────────────────

describe('see_the_future card', () => {
  it('reveals top 3 cards', () => {
    const base = ExplodingKittensPlugin.getInitialState(PLAYERS, CONFIG) as EKGameState
    const stfCard: Card = { id: 'stf-test', type: 'see_the_future' }
    const top3: Card[] = [
      { id: 'a', type: 'skip' },
      { id: 'b', type: 'shuffle' },
      { id: 'c', type: 'nope' },
    ]
    const hand = [...base.hands['alice'], stfCard]
    const s = stateWith({ hands: { ...base.hands, alice: hand }, deck: [...top3, ...base.deck] })
    const result = ExplodingKittensPlugin.applyAction(s, makeAction('alice', { type: 'play_card', cardId: 'stf-test' }), CONFIG) as EKGameState
    expect(result.topThree).toEqual(top3)
    expect(result.currentPlayerId).toBe('alice')  // turn NOT ended
  })
})

// ─── Shuffle ───────────────────────────────────────────────────────────────

describe('shuffle card', () => {
  it('clears topThree and keeps same deck size', () => {
    const base = ExplodingKittensPlugin.getInitialState(PLAYERS, CONFIG) as EKGameState
    const shuffleCard: Card = { id: 'shuffle-test', type: 'shuffle' }
    const hand = [...base.hands['alice'], shuffleCard]
    const top3: Card[] = [{ id: 'x', type: 'skip' }, { id: 'y', type: 'nope' }, { id: 'z', type: 'favor' }]
    const s = stateWith({ hands: { ...base.hands, alice: hand }, topThree: top3 })
    const deckSize = s.deck.length
    const result = ExplodingKittensPlugin.applyAction(s, makeAction('alice', { type: 'play_card', cardId: 'shuffle-test' }), CONFIG) as EKGameState
    expect(result.topThree).toBeNull()
    expect(result.deck).toHaveLength(deckSize)
  })
})

// ─── Nope ─────────────────────────────────────────────────────────────────

describe('nope card', () => {
  it('any player can play nope', () => {
    const base = ExplodingKittensPlugin.getInitialState(PLAYERS, CONFIG) as EKGameState
    const nopeCard: Card = { id: 'nope-test', type: 'nope' }
    const bobHand = [...base.hands['bob'], nopeCard]
    const s = stateWith({ hands: { ...base.hands, bob: bobHand } })
    const result = ExplodingKittensPlugin.applyAction(s, makeAction('bob', { type: 'nope', cardId: 'nope-test' }), CONFIG) as EKGameState
    expect(result.pendingNope).toBe(true)
    expect(result.hands['bob']).not.toContainEqual(nopeCard)
  })

  it('double nope cancels out', () => {
    const base = ExplodingKittensPlugin.getInitialState(PLAYERS, CONFIG) as EKGameState
    const nope1: Card = { id: 'nope-1', type: 'nope' }
    const nope2: Card = { id: 'nope-2', type: 'nope' }
    const bobHand = [...base.hands['bob'], nope1]
    const carolHand = [...base.hands['carol'], nope2]
    const s = stateWith({ hands: { ...base.hands, bob: bobHand, carol: carolHand }, pendingNope: true })
    const result = ExplodingKittensPlugin.applyAction(s, makeAction('carol', { type: 'nope', cardId: 'nope-2' }), CONFIG) as EKGameState
    expect(result.pendingNope).toBe(false)
  })
})

// ─── Win condition ─────────────────────────────────────────────────────────

describe('win condition', () => {
  it('game over when 1 player remains', () => {
    const base = ExplodingKittensPlugin.getInitialState(PLAYERS, CONFIG) as EKGameState
    const { bob: _, carol: __, ...remaining } = base.hands
    const s = stateWith({ hands: remaining })
    expect(ExplodingKittensPlugin.isGameOver(s)).toBe(true)
    expect(ExplodingKittensPlugin.getWinner(s)).toBe('alice')
  })

  it('not over with 2 players left', () => {
    const base = ExplodingKittensPlugin.getInitialState(PLAYERS, CONFIG) as EKGameState
    const { carol: _, ...remaining } = base.hands
    const s = stateWith({ hands: remaining })
    expect(ExplodingKittensPlugin.isGameOver(s)).toBe(false)
  })

  it('draw sets game phase to finished', () => {
    const base = ExplodingKittensPlugin.getInitialState(TWO_PLAYERS, CONFIG) as EKGameState
    const bomb: Card = { id: 'bomb', type: 'exploding_kitten' }
    const handWithoutDefuse = base.hands['alice'].filter(c => c.type !== 'defuse')
    const s = stateWith({ ...base, deck: [bomb], hands: { ...base.hands, alice: handWithoutDefuse } })
    const result = ExplodingKittensPlugin.applyAction(s, makeAction('alice', { type: 'draw_card' }), CONFIG) as EKGameState
    expect(result.phase).toBe('finished')
    expect(result.winner).toBe('bob')
  })
})

// ─── Turn order ────────────────────────────────────────────────────────────

describe('turn order', () => {
  it('wraps around to first player after last player', () => {
    const base = ExplodingKittensPlugin.getInitialState(PLAYERS, CONFIG) as EKGameState
    const safeDeck = base.deck.filter(c => c.type !== 'exploding_kitten')
    // carol's turn
    const s = stateWith({ ...base, currentPlayerId: 'carol', currentPlayerIndex: 2, deck: safeDeck })
    const result = ExplodingKittensPlugin.applyAction(s, makeAction('carol', { type: 'draw_card' }), CONFIG) as EKGameState
    expect(result.currentPlayerId).toBe('alice')
  })

  it('skips eliminated players in turn order', () => {
    const base = ExplodingKittensPlugin.getInitialState(PLAYERS, CONFIG) as EKGameState
    const safeDeck = base.deck.filter(c => c.type !== 'exploding_kitten')
    const { bob: _, ...handsWithoutBob } = base.hands
    const s = stateWith({ ...base, hands: handsWithoutBob, deck: safeDeck })
    const result = ExplodingKittensPlugin.applyAction(s, makeAction('alice', { type: 'draw_card' }), CONFIG) as EKGameState
    expect(result.currentPlayerId).toBe('carol')
  })
})
