import type { GamePlugin, GameConfig, GameState, PlayerAction } from '@wgp/shared'

// Card types
export type CardType =
  | 'exploding_kitten'
  | 'defuse'
  | 'skip'
  | 'attack'
  | 'nope'
  | 'see_the_future'
  | 'shuffle'
  | 'favor'

export interface Card {
  id: string
  type: CardType
}

export interface EKGameState extends GameState {
  deck: Card[]
  hands: Record<string, Card[]>
  discardPile: Card[]
  turnOrder: string[]
  currentPlayerIndex: number
  attacksRemaining: number      // >1 means chained Attack cards
  pendingNope: boolean
  topThree: Card[] | null       // revealed by See the Future, null otherwise
  pendingFavor: string | null   // playerId who must give a card
  log: string[]                 // human-readable action log
}

export type EKAction =
  | { type: 'play_card'; cardId: string; targetPlayerId?: string }
  | { type: 'draw_card' }
  | { type: 'nope'; cardId: string }
  | { type: 'insert_kitten'; position: number }  // host chooses where to put defused bomb back
  | { type: 'give_card'; cardId: string }        // response to favor

function buildDeck(): Card[] {
  const cards: Card[] = []
  let id = 0
  const add = (type: CardType, count: number) => {
    for (let i = 0; i < count; i++) cards.push({ id: `${type}-${id++}`, type })
  }
  add('skip', 4)
  add('attack', 4)
  add('nope', 5)
  add('see_the_future', 5)
  add('shuffle', 4)
  add('favor', 4)
  return shuffle(cards)
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function nextPlayerIndex(state: EKGameState): number {
  const alive = getAlivePlayers(state)
  const currentId = state.turnOrder[state.currentPlayerIndex]
  const currentAliveIndex = alive.indexOf(currentId)
  return state.turnOrder.indexOf(alive[(currentAliveIndex + 1) % alive.length])
}

export function getAlivePlayers(state: EKGameState): string[] {
  return state.turnOrder.filter(pid => state.hands[pid] !== undefined)
}

function addLog(state: EKGameState, msg: string): EKGameState {
  return { ...state, log: [...state.log, msg] }
}

export const ExplodingKittensPlugin: GamePlugin = {
  id: 'exploding-kittens',
  name: 'Exploding Kittens',
  minPlayers: 2,
  maxPlayers: 5,

  getInitialState(playerIds: string[], config: GameConfig): EKGameState {
    const deck = buildDeck()
    const hands: Record<string, Card[]> = {}
    let cardId = 0

    for (const pid of playerIds) {
      hands[pid] = [
        { id: `defuse-start-${cardId++}`, type: 'defuse' },
        ...deck.splice(0, 7),
      ]
    }

    // Insert bombs after dealing
    const bombs: Card[] = Array.from({ length: playerIds.length - 1 }, (_, i) => ({
      id: `exploding_kitten-${cardId + i}`,
      type: 'exploding_kitten' as CardType,
    }))
    const finalDeck = shuffle([...deck, ...bombs])

    return {
      phase: 'playing',
      currentPlayerId: playerIds[0],
      winner: null,
      deck: finalDeck,
      hands,
      discardPile: [],
      turnOrder: [...playerIds],
      currentPlayerIndex: 0,
      attacksRemaining: 1,
      pendingNope: false,
      topThree: null,
      pendingFavor: null,
      log: [],
    }
  },

  applyAction(state: GameState, action: PlayerAction, _config: GameConfig): EKGameState {
    let s = { ...(state as EKGameState), log: [...(state as EKGameState).log] }
    const { playerId } = action
    const ekAction = action.payload as EKAction

    // Only current player can act (except nope and give_card)
    const isCurrentPlayer = playerId === s.currentPlayerId
    const currentPlayerName = playerId

    if (ekAction.type === 'draw_card') {
      if (!isCurrentPlayer) return s
      if (s.pendingFavor) return s  // must resolve favor first

      s = { ...s, topThree: null }  // clear see-the-future reveal

      const [drawn, ...rest] = s.deck
      s = { ...s, deck: rest }

      if (drawn.type === 'exploding_kitten') {
        // Check for defuse in hand
        const hand = s.hands[playerId]
        const defuseIndex = hand.findIndex(c => c.type === 'defuse')

        if (defuseIndex === -1) {
          // No defuse — player is eliminated
          const { [playerId]: _, ...remainingHands } = s.hands
          s = { ...s, hands: remainingHands }
          s = addLog(s, `💥 ${currentPlayerName} drew an Exploding Kitten and was eliminated!`)
          s = { ...s, discardPile: [drawn, ...s.discardPile] }
        } else {
          // Has defuse — use it
          const newHand = [...hand]
          newHand.splice(defuseIndex, 1)
          s = { ...s, hands: { ...s.hands, [playerId]: newHand } }
          s = addLog(s, `😅 ${currentPlayerName} drew an Exploding Kitten but used a Defuse!`)
          s = { ...s, discardPile: [drawn, ...s.discardPile], phase: 'inserting_kitten' }
          // Player must now choose where to insert the bomb — handled by insert_kitten action
          return { ...s, currentPlayerId: playerId }
        }
      } else {
        // Normal card — add to hand
        s = { ...s, hands: { ...s.hands, [playerId]: [...s.hands[playerId], drawn] } }
        s = addLog(s, `${currentPlayerName} drew a card`)
      }

      // End turn
      s = endTurn(s)
      return s
    }

    if (ekAction.type === 'insert_kitten') {
      if (playerId !== s.currentPlayerId) return s
      const bomb: Card = { id: `exploding_kitten-reinsert-${Date.now()}`, type: 'exploding_kitten' }
      const pos = Math.max(0, Math.min(ekAction.position, s.deck.length))
      const newDeck = [...s.deck.slice(0, pos), bomb, ...s.deck.slice(pos)]
      s = { ...s, deck: newDeck, phase: 'playing' }
      s = addLog(s, `${currentPlayerName} inserted the Exploding Kitten back into the deck`)
      s = endTurn(s)
      return s
    }

    if (ekAction.type === 'play_card') {
      if (!isCurrentPlayer) return s
      const hand = s.hands[playerId]
      const cardIndex = hand.findIndex(c => c.id === ekAction.cardId)
      if (cardIndex === -1) return s

      const card = hand[cardIndex]
      const newHand = [...hand]
      newHand.splice(cardIndex, 1)
      s = { ...s, hands: { ...s.hands, [playerId]: newHand } }
      s = { ...s, discardPile: [card, ...s.discardPile] }

      if (card.type === 'skip') {
        s = addLog(s, `${currentPlayerName} played Skip`)
        const remaining = s.attacksRemaining - 1
        if (remaining <= 0) {
          // All forced draws skipped — end turn normally
          s = endTurn({ ...s, attacksRemaining: 1 })
        } else {
          // Still has forced draws remaining — stay on this player's turn
          s = { ...s, attacksRemaining: remaining }
        }
      }

      if (card.type === 'attack') {
        s = addLog(s, `${currentPlayerName} played Attack!`)
        // Next player must take 2 turns (or more if chained)
        const nextIdx = nextPlayerIndex(s)
        s = {
          ...s,
          currentPlayerIndex: nextIdx,
          currentPlayerId: s.turnOrder[nextIdx],
          attacksRemaining: s.attacksRemaining + 1,
        }
      }

      if (card.type === 'see_the_future') {
        const top = s.deck.slice(0, 3)
        s = { ...s, topThree: top }
        s = addLog(s, `${currentPlayerName} played See the Future`)
      }

      if (card.type === 'shuffle') {
        s = { ...s, deck: shuffle(s.deck), topThree: null }
        s = addLog(s, `${currentPlayerName} played Shuffle`)
      }

      if (card.type === 'favor') {
        if (!ekAction.targetPlayerId || !s.hands[ekAction.targetPlayerId]) return s
        s = { ...s, pendingFavor: ekAction.targetPlayerId }
        s = addLog(s, `${currentPlayerName} played Favor on ${ekAction.targetPlayerId}`)
      }

      return s
    }

    if (ekAction.type === 'nope') {
      // Any player (except the one being noped) can play Nope
      const hand = s.hands[playerId]
      if (!hand) return s
      const cardIndex = hand.findIndex(c => c.id === ekAction.cardId && c.type === 'nope')
      if (cardIndex === -1) return s

      const newHand = [...hand]
      const card = newHand.splice(cardIndex, 1)[0]
      s = { ...s, hands: { ...s.hands, [playerId]: newHand } }
      s = { ...s, discardPile: [card, ...s.discardPile] }
      s = { ...s, pendingNope: !s.pendingNope }
      s = addLog(s, `${playerId} played Nope!`)
      return s
    }

    if (ekAction.type === 'give_card') {
      if (playerId !== s.pendingFavor) return s
      const hand = s.hands[playerId]
      const cardIndex = hand.findIndex(c => c.id === ekAction.cardId)
      if (cardIndex === -1) return s

      const newHand = [...hand]
      const card = newHand.splice(cardIndex, 1)[0]
      s = { ...s, hands: { ...s.hands, [playerId]: newHand } }
      // Give card to current player
      s = { ...s, hands: { ...s.hands, [s.currentPlayerId!]: [...s.hands[s.currentPlayerId!], card] } }
      s = { ...s, pendingFavor: null }
      s = addLog(s, `${playerId} gave a card to ${s.currentPlayerId}`)
      return s
    }

    return s
  },

  isGameOver(state: GameState): boolean {
    return getAlivePlayers(state as EKGameState).length <= 1
  },

  getWinner(state: GameState): string | null {
    const alive = getAlivePlayers(state as EKGameState)
    return alive.length === 1 ? alive[0] : null
  },
}

function endTurn(s: EKGameState): EKGameState {
  // Check win condition
  const alive = getAlivePlayers(s)
  if (alive.length <= 1) {
    return {
      ...s,
      phase: 'finished',
      winner: alive[0] ?? null,
      currentPlayerId: null,
    }
  }

  // Handle attack chaining — current player draws more than once
  if (s.attacksRemaining > 1) {
    return { ...s, attacksRemaining: s.attacksRemaining - 1 }
  }

  const nextIdx = nextPlayerIndex(s)
  return {
    ...s,
    currentPlayerIndex: nextIdx,
    currentPlayerId: s.turnOrder[nextIdx],
    attacksRemaining: 1,
    topThree: null,
  }
}
