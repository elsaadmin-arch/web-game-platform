import type { EKGameState, EKAction } from './types'
import { shuffle, addLog, endTurn } from './utils'

export function applyDrawCard(s: EKGameState, playerId: string): EKGameState {
  if (playerId !== s.currentPlayerId) return s
  if (s.pendingFavor) return s

  s = { ...s, topThree: null }
  const [drawn, ...rest] = s.deck
  s = { ...s, deck: rest }

  if (drawn.type === 'exploding_kitten') {
    const hand = s.hands[playerId]
    const defuseIndex = hand.findIndex(c => c.type === 'defuse')
    if (defuseIndex === -1) {
      const { [playerId]: _, ...remainingHands } = s.hands
      s = { ...s, hands: remainingHands }
      s = addLog(s, `💥 ${playerId} drew an Exploding Kitten and was eliminated!`)
      s = { ...s, discardPile: [drawn, ...s.discardPile] }
    } else {
      const newHand = [...hand]
      newHand.splice(defuseIndex, 1)
      s = { ...s, hands: { ...s.hands, [playerId]: newHand } }
      s = addLog(s, `😅 ${playerId} drew an Exploding Kitten but used a Defuse!`)
      s = { ...s, discardPile: [drawn, ...s.discardPile], phase: 'inserting_kitten' }
      return { ...s, currentPlayerId: playerId }
    }
  } else {
    s = { ...s, hands: { ...s.hands, [playerId]: [...s.hands[playerId], drawn] } }
    s = addLog(s, `${playerId} drew a card`)
  }

  return endTurn(s)
}

export function applyInsertKitten(s: EKGameState, playerId: string, action: Extract<EKAction, { type: 'insert_kitten' }>): EKGameState {
  if (playerId !== s.currentPlayerId) return s
  const bomb = { id: `exploding_kitten-reinsert-${Date.now()}`, type: 'exploding_kitten' as const }
  const pos = Math.max(0, Math.min(action.position, s.deck.length))
  const newDeck = [...s.deck.slice(0, pos), bomb, ...s.deck.slice(pos)]
  s = { ...s, deck: newDeck, phase: 'playing' }
  s = addLog(s, `${playerId} inserted the Exploding Kitten back into the deck`)
  return endTurn(s)
}

export function applyPlayCard(s: EKGameState, playerId: string, action: Extract<EKAction, { type: 'play_card' }>): EKGameState {
  if (playerId !== s.currentPlayerId) return s
  const hand = s.hands[playerId]
  const cardIndex = hand.findIndex(c => c.id === action.cardId)
  if (cardIndex === -1) return s

  const card = hand[cardIndex]
  const newHand = [...hand]
  newHand.splice(cardIndex, 1)
  s = { ...s, hands: { ...s.hands, [playerId]: newHand }, discardPile: [card, ...s.discardPile] }

  if (card.type === 'skip') {
    s = addLog(s, `${playerId} played Skip`)
    const remaining = s.attacksRemaining - 1
    return remaining <= 0 ? endTurn({ ...s, attacksRemaining: 1 }) : { ...s, attacksRemaining: remaining }
  }

  if (card.type === 'attack') {
    s = addLog(s, `${playerId} played Attack!`)
    const nextIdx = s.turnOrder.indexOf(
      s.turnOrder.filter(id => s.hands[id]).find((_, i, arr) => {
        const curIdx = arr.indexOf(s.turnOrder[s.currentPlayerIndex])
        return i === (curIdx + 1) % arr.length
      }) ?? s.turnOrder[0]
    )
    return { ...s, currentPlayerIndex: nextIdx, currentPlayerId: s.turnOrder[nextIdx], attacksRemaining: s.attacksRemaining + 1 }
  }

  if (card.type === 'see_the_future') {
    return addLog({ ...s, topThree: s.deck.slice(0, 3) }, `${playerId} played See the Future`)
  }

  if (card.type === 'shuffle') {
    return addLog({ ...s, deck: shuffle(s.deck), topThree: null }, `${playerId} played Shuffle`)
  }

  if (card.type === 'favor') {
    if (!action.targetPlayerId || !s.hands[action.targetPlayerId]) return s
    return addLog({ ...s, pendingFavor: action.targetPlayerId }, `${playerId} played Favor on ${action.targetPlayerId}`)
  }

  return s
}

export function applyNope(s: EKGameState, playerId: string, action: Extract<EKAction, { type: 'nope' }>): EKGameState {
  const hand = s.hands[playerId]
  if (!hand) return s
  const cardIndex = hand.findIndex(c => c.id === action.cardId && c.type === 'nope')
  if (cardIndex === -1) return s
  const newHand = [...hand]
  const card = newHand.splice(cardIndex, 1)[0]
  s = { ...s, hands: { ...s.hands, [playerId]: newHand }, discardPile: [card, ...s.discardPile] }
  return addLog({ ...s, pendingNope: !s.pendingNope }, `${playerId} played Nope!`)
}

export function applyGiveCard(s: EKGameState, playerId: string, action: Extract<EKAction, { type: 'give_card' }>): EKGameState {
  if (playerId !== s.pendingFavor) return s
  const hand = s.hands[playerId]
  const cardIndex = hand.findIndex(c => c.id === action.cardId)
  if (cardIndex === -1) return s
  const newHand = [...hand]
  const card = newHand.splice(cardIndex, 1)[0]
  s = { ...s, hands: { ...s.hands, [playerId]: newHand } }
  s = { ...s, hands: { ...s.hands, [s.currentPlayerId!]: [...s.hands[s.currentPlayerId!], card] } }
  return addLog({ ...s, pendingFavor: null }, `${playerId} gave a card to ${s.currentPlayerId}`)
}
