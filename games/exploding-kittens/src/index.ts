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
  hands: Record<string, Card[]>   // playerId -> cards in hand
  discardPile: Card[]
  turnOrder: string[]             // player ids in turn order
  currentPlayerIndex: number
  attacksRemaining: number        // for Attack card chaining
  pendingNope: boolean
}

function buildDeck(playerCount: number): Card[] {
  const cards: Card[] = []
  let id = 0
  const add = (type: CardType, count: number) => {
    for (let i = 0; i < count; i++) cards.push({ id: `${type}-${id++}`, type })
  }

  // Defuse cards go to players' hands, not the deck
  add('skip', 4)
  add('attack', 4)
  add('nope', 5)
  add('see_the_future', 5)
  add('shuffle', 4)
  add('favor', 4)
  // Exploding kittens = playerCount - 1
  add('exploding_kitten', playerCount - 1)

  return shuffle(cards)
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const ExplodingKittensPlugin: GamePlugin = {
  id: 'exploding-kittens',
  name: 'Exploding Kittens',
  minPlayers: 2,
  maxPlayers: 5,

  getInitialState(playerIds: string[], config: GameConfig): EKGameState {
    const deck = buildDeck(playerIds.length)
    const hands: Record<string, Card[]> = {}

    // Deal 7 cards + 1 defuse to each player
    for (const pid of playerIds) {
      hands[pid] = [
        { id: `defuse-start-${pid}`, type: 'defuse' },
        ...deck.splice(0, 7),
      ]
    }

    return {
      phase: 'playing',
      currentPlayerId: playerIds[0],
      winner: null,
      deck,
      hands,
      discardPile: [],
      turnOrder: [...playerIds],
      currentPlayerIndex: 0,
      attacksRemaining: 1,
      pendingNope: false,
    }
  },

  applyAction(state: GameState, action: PlayerAction, _config: GameConfig): EKGameState {
    const s = state as EKGameState
    // TODO: implement card play logic
    // action.type: 'play_card' | 'draw_card' | 'nope' | 'insert_kitten'
    return s
  },

  isGameOver(state: GameState): boolean {
    const s = state as EKGameState
    const alive = s.turnOrder.filter(pid => s.hands[pid] !== undefined)
    return alive.length <= 1
  },

  getWinner(state: GameState): string | null {
    const s = state as EKGameState
    const alive = s.turnOrder.filter(pid => s.hands[pid] !== undefined)
    return alive.length === 1 ? alive[0] : null
  },
}
