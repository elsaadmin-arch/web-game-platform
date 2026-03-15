import type { GameState } from '@wgp/shared'

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
  log: string[]
}

export type EKAction =
  | { type: 'play_card'; cardId: string; targetPlayerId?: string }
  | { type: 'draw_card' }
  | { type: 'nope'; cardId: string }
  | { type: 'insert_kitten'; position: number }
  | { type: 'give_card'; cardId: string }
