import type { GamePlugin, GameConfig, GameState, PlayerAction } from '@wgp/shared'
import type { EKGameState, EKAction } from './types'
import { shuffle, buildDeck, getAlivePlayers } from './utils'
import { applyDrawCard, applyInsertKitten, applyPlayCard, applyNope, applyGiveCard } from './actions'

export type { CardType, Card, EKGameState, EKAction } from './types'
export { shuffle, getAlivePlayers } from './utils'

export const ExplodingKittensPlugin: GamePlugin = {
  id: 'exploding-kittens',
  name: 'Exploding Kittens',
  minPlayers: 2,
  maxPlayers: 5,

  getInitialState(playerIds: string[], _config: GameConfig): EKGameState {
    const deck = buildDeck()
    const hands: Record<string, string[][]> = {}
    let cardId = 0

    const playerHands: Record<string, import('./types').Card[]> = {}
    for (const pid of playerIds) {
      playerHands[pid] = [
        { id: `defuse-start-${cardId++}`, type: 'defuse' },
        ...deck.splice(0, 7),
      ]
    }

    const bombs = Array.from({ length: playerIds.length - 1 }, (_, i) => ({
      id: `exploding_kitten-${cardId + i}`,
      type: 'exploding_kitten' as const,
    }))
    const finalDeck = shuffle([...deck, ...bombs])

    return {
      phase: 'playing',
      currentPlayerId: playerIds[0],
      winner: null,
      deck: finalDeck,
      hands: playerHands,
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
    const s = state as EKGameState
    const ekAction = action.payload as EKAction
    const { playerId } = action

    if (ekAction.type === 'draw_card') return applyDrawCard(s, playerId)
    if (ekAction.type === 'insert_kitten') return applyInsertKitten(s, playerId, ekAction)
    if (ekAction.type === 'play_card') return applyPlayCard(s, playerId, ekAction)
    if (ekAction.type === 'nope') return applyNope(s, playerId, ekAction)
    if (ekAction.type === 'give_card') return applyGiveCard(s, playerId, ekAction)
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
