import type { CardType, Card } from './GameScreen'

export const CARD_EMOJI: Record<CardType, string> = {
  exploding_kitten: '💣',
  defuse: '🧯',
  skip: '⏭️',
  attack: '⚔️',
  nope: '🙅',
  see_the_future: '🔮',
  shuffle: '🔀',
  favor: '🙏',
}

export const CARD_LABEL: Record<CardType, string> = {
  exploding_kitten: 'Bomb',
  defuse: 'Defuse',
  skip: 'Skip',
  attack: 'Attack',
  nope: 'Nope',
  see_the_future: 'Future',
  shuffle: 'Shuffle',
  favor: 'Favor',
}

interface Props {
  card: Card
  selected?: boolean
  onClick?: () => void
  disabled?: boolean
}

export default function CardTile({ card, selected, onClick, disabled }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center w-16 h-24 rounded-xl border-2 text-2xl transition select-none
        ${selected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 -translate-y-2 shadow-lg'
          : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-500'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span>{CARD_EMOJI[card.type]}</span>
      <span className="text-[10px] mt-1 text-zinc-500 dark:text-zinc-400 font-medium">{CARD_LABEL[card.type]}</span>
    </button>
  )
}
