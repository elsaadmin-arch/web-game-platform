import { useState } from 'react'
import CardTile, { CARD_EMOJI, CARD_LABEL } from './CardTile'
import type { EKGameState, Player, Card, CardType } from './types'

export type { EKGameState, CardType, Card }

interface Props {
  state: EKGameState
  players: Player[]
  myId: string
  isHost: boolean
  send: (msg: object) => void
  onReturnToLobby: () => void
  onLeave: () => void
}

export default function GameScreen({ state, players, myId, isHost, send, onReturnToLobby, onLeave }: Props) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [favorTargetId, setFavorTargetId] = useState<string | null>(null)

  const myHand = state.hands[myId] ?? []
  const isMyTurn = state.currentPlayerId === myId
  const isAlive = state.turnOrder.includes(myId)
  const alivePlayers = players.filter(p => state.turnOrder.includes(p.id))
  const selectedCard = myHand.find(c => c.id === selectedCardId)
  const lastDiscard = state.discardPile[state.discardPile.length - 1]

  function playCard() {
    if (!selectedCard) return
    const payload: Record<string, unknown> = { type: 'play_card', cardId: selectedCard.id }
    if (selectedCard.type === 'favor') {
      if (!favorTargetId) return
      payload.targetPlayerId = favorTargetId
    }
    send({ type: 'action', action: payload })
    setSelectedCardId(null)
    setFavorTargetId(null)
  }

  function drawCard() {
    send({ type: 'action', action: { type: 'draw_card' } })
    setSelectedCardId(null)
  }

  // --- Overlays ---

  if (state.phase === 'finished') {
    const winner = players.find(p => p.id === state.winner)
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col items-center justify-center gap-6 px-6">
        <div className="text-6xl">{state.winner === myId ? '🏆' : '💀'}</div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
          {state.winner === myId ? 'You won!' : `${winner?.name ?? 'Someone'} won!`}
        </h2>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {isHost && (
            <button onClick={() => send({ type: 'rematch' })}
              className="w-full py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold text-base hover:opacity-90 transition">
              🔄 Rematch
            </button>
          )}
          {!isHost && (
            <p className="text-center text-sm text-zinc-400">Waiting for host to start a rematch…</p>
          )}
          <button onClick={onReturnToLobby}
            className="w-full py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition">
            Back to Lobby
          </button>
          <button onClick={onLeave} className="text-xs text-zinc-400 hover:text-zinc-600 transition text-center">
            Leave Room
          </button>
        </div>
      </div>
    )
  }

  if (state.phase === 'inserting_kitten' && myId === state.currentPlayerId) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col items-center justify-center gap-6 px-6">
        <div className="text-5xl">💣</div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Place the bomb back in the deck</h2>
        <p className="text-sm text-zinc-400">Deck has {state.deck.length} cards. Choose a position (0 = top):</p>
        <div className="flex flex-wrap gap-2 justify-center max-w-xs">
          {Array.from({ length: state.deck.length + 1 }, (_, i) => (
            <button key={i} onClick={() => send({ type: 'action', action: { type: 'insert_kitten', position: i } })}
              className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm font-mono hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">
              {i}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (state.phase === 'inserting_kitten' && myId !== state.currentPlayerId) {
    const bomber = players.find(p => p.id === state.currentPlayerId)
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col items-center justify-center gap-6 px-6">
        <div className="text-5xl">😅</div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{bomber?.name ?? 'Someone'} defused the bomb!</h2>
        <p className="text-sm text-zinc-400">Waiting for them to place it back in the deck…</p>
      </div>
    )
  }

  if (state.pendingFavor === myId) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col items-center justify-center gap-6 px-6">
        <div className="text-5xl">🙏</div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Give a card</h2>
        <div className="flex flex-wrap gap-2 justify-center">
          {myHand.map(card => (
            <CardTile key={card.id} card={card} onClick={() => send({ type: 'action', action: { type: 'give_card', cardId: card.id } })} />
          ))}
        </div>
      </div>
    )
  }

  if (state.topThree && isMyTurn) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col items-center justify-center gap-6 px-6">
        <div className="text-5xl">🔮</div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Top 3 cards</h2>
        <div className="flex gap-3">{state.topThree.map(card => <CardTile key={card.id} card={card} disabled />)}</div>
        <button onClick={drawCard} className="px-6 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold text-sm hover:opacity-90 transition">OK</button>
      </div>
    )
  }

  // --- Main game UI ---

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col">

      {/* Players + deck */}
      <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {alivePlayers.map(p => (
            <div key={p.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border
              ${p.id === state.currentPlayerId
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-transparent'
                : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'}`}>
              {p.id === myId ? '👤' : '🙂'} {p.name}
              <span className="opacity-60">·{state.hands[p.id]?.length ?? 0}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center shrink-0">
          <div className="w-10 h-14 rounded-lg bg-zinc-800 dark:bg-zinc-700 flex items-center justify-center text-white text-xs font-bold shadow">{state.deck.length}</div>
          <span className="text-[10px] text-zinc-400 mt-1">deck</span>
        </div>
      </div>

      {/* Discard + turn indicator */}
      {lastDiscard && (
        <div className="px-4 pb-1 flex items-center gap-2">
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Last:</span>
          <span className="text-lg">{CARD_EMOJI[lastDiscard.type]}</span>
          <span className="text-xs text-zinc-500">{CARD_LABEL[lastDiscard.type]}</span>
        </div>
      )}
      <div className="px-4 py-1">
        {isMyTurn
          ? <p className="text-sm font-semibold text-emerald-500">Your turn{state.attacksRemaining > 1 ? ` (×${state.attacksRemaining})` : ''}</p>
          : <p className="text-sm text-zinc-400">{players.find(p => p.id === state.currentPlayerId)?.name}'s turn…</p>}
      </div>

      {/* Log */}
      {state.log.length > 0 && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-500 dark:text-zinc-400 max-h-16 overflow-y-auto">
          {[...state.log].reverse().slice(0, 4).map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}

      <div className="flex-1" />

      {/* Nope button */}
      {!isMyTurn && myHand.some(c => c.type === 'nope') && state.pendingNope && (
        <div className="px-4 pb-2 flex justify-center">
          <button onClick={() => { const c = myHand.find(x => x.type === 'nope')!; send({ type: 'action', action: { type: 'nope', cardId: c.id } }) }}
            className="px-8 py-3 rounded-xl bg-red-500 text-white font-bold text-base hover:bg-red-600 transition animate-pulse">
            🙅 NOPE!
          </button>
        </div>
      )}

      {/* Hand */}
      {isAlive && (
        <div className="px-4 pb-2">
          <p className="text-[10px] uppercase tracking-wider text-zinc-400 mb-2">Your hand ({myHand.length})</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {myHand.map(card => (
              <CardTile key={card.id} card={card}
                selected={selectedCardId === card.id}
                disabled={!isMyTurn || card.type === 'exploding_kitten'}
                onClick={() => setSelectedCardId(selectedCardId === card.id ? null : card.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Favor target picker */}
      {selectedCard?.type === 'favor' && (
        <div className="px-4 pb-2">
          <p className="text-xs text-zinc-400 mb-1">Pick target:</p>
          <div className="flex gap-2">
            {alivePlayers.filter(p => p.id !== myId).map(p => (
              <button key={p.id} onClick={() => setFavorTargetId(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition
                  ${favorTargetId === p.id ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-transparent' : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'}`}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      {isMyTurn && isAlive && (
        <div className="px-4 pb-6 flex gap-3">
          {selectedCard ? (
            <>
              <button onClick={playCard} disabled={selectedCard.type === 'favor' && !favorTargetId}
                className="flex-1 py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold text-sm hover:opacity-90 transition disabled:opacity-30">
                Play {CARD_EMOJI[selectedCard.type]} {CARD_LABEL[selectedCard.type]}
              </button>
              <button onClick={() => setSelectedCardId(null)}
                className="px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-500 dark:text-zinc-400">
                Cancel
              </button>
            </>
          ) : (
            <button onClick={drawCard} className="flex-1 py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold text-sm hover:opacity-90 transition">
              Draw Card
            </button>
          )}
        </div>
      )}

      {!isAlive && (
        <div className="px-4 pb-6 text-center text-sm text-zinc-400">
          💀 Eliminated. Watching…
          <button onClick={onLeave} className="block mx-auto mt-2 text-xs underline">Leave</button>
        </div>
      )}
    </div>
  )
}
