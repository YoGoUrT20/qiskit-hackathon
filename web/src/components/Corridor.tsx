import { pct } from '../engine/walk'

interface Props {
  probs: number[]
  ink: string
  hidden?: boolean
  lit?: number | null
  disabled?: boolean
  onPick?: (room: number) => void
}

// ring cut open at room 16 / room 1 and laid flat, one bar per room.
export function Corridor({ probs, ink, hidden, lit, disabled, onPick }: Props) {
  const scale = Math.max(0.5, ...probs)
  return (
    <div className="corridor" style={{ gridTemplateColumns: `repeat(${probs.length}, minmax(0, 1fr))` }}>
      {probs.map((p, k) => (
        <button
          key={k}
          type="button"
          className={`corridor-col${k === lit ? ' is-lit' : ''}`}
          disabled={disabled}
          onClick={() => onPick?.(k)}
          aria-label={hidden ? `Room ${k + 1}` : `Room ${k + 1}, ${pct(p)}`}
        >
          <span className="corridor-pct">{hidden ? '' : p >= 0.0005 ? pct(p) : ''}</span>
          <span className="corridor-track">
            <span className="corridor-bar" style={{ height: hidden ? 0 : `${(100 * p) / scale}%`, background: ink }} />
          </span>
          <span className="corridor-num">{k + 1}</span>
        </button>
      ))}
    </div>
  )
}
