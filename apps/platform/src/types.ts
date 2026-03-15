import type { GameState } from '@wgp/shared'

export type CardType =
  | 'exploding_kitten' | 'defuse' | 'skip' | 'attack'
  | 'nope' | 'see_the_future' | 'shuffle' | 'favor'

export interface Card { id: string; type: CardType }

export interface EKGameState extends GameState {
  deck: Card[]
  hands: Record<string, Card[]>
  discardPile: Card[]
  turnOrder: string[]
  currentPlayerIndex: number
  attacksRemaining: number
  pendingNope: boolean
  topThree: Card[] | null
  pendingFavor: string | null
  log: string[]
}

export interface Player { id: string; name: string; connected: boolean }

export interface GameScreenProps {
  state: EKGameState
  players: Player[]
  myId: string
  isHost: boolean
  send: (msg: object) => void
  onLeave: () => void
}
