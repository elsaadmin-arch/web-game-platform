import type { Card, CardType, EKGameState } from './types'

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function buildDeck(): Card[] {
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

export function getAlivePlayers(state: EKGameState): string[] {
  return state.turnOrder.filter(pid => state.hands[pid] !== undefined)
}

export function nextPlayerIndex(state: EKGameState): number {
  const alive = getAlivePlayers(state)
  const currentId = state.turnOrder[state.currentPlayerIndex]
  const currentAliveIndex = alive.indexOf(currentId)
  return state.turnOrder.indexOf(alive[(currentAliveIndex + 1) % alive.length])
}

export function addLog(state: EKGameState, msg: string): EKGameState {
  return { ...state, log: [...state.log, msg] }
}

export function endTurn(s: EKGameState): EKGameState {
  const alive = getAlivePlayers(s)
  if (alive.length <= 1) {
    return { ...s, phase: 'finished', winner: alive[0] ?? null, currentPlayerId: null }
  }
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
