import { CSSProperties, ReactNode } from 'react'
import { pct } from '../engine/walk'
import { Ghost, Tone } from './Ghost'
import { Travel, TRAVEL_MS } from './Travel'

// one ghost drawn in the ring
export interface Layer {
  probs: number[]
  tone: Tone
  hidden?: boolean
  moved?: { id: number; from: number[] } | null
  found?: number | null
}

interface Props {
  probs: number[]
  tone: Tone
  hidden?: boolean
  lit?: number | null
  empty?: number | null
  found?: number | null
  disabled?: boolean
  onPick?: (room: number) => void
  roomLabel?: (room: number, p: number) => string
  moved?: { id: number; from: number[] } | null
  counts?: number[] | null
  picked?: number | null
  // a second ghost in the same rooms, drawn beside the first on one scale
  pair?: Layer
  overlay?: ReactNode
  children?: ReactNode
}

export function Ring({ probs, tone, hidden, lit, empty, found, disabled, onPick, roomLabel, moved, counts, picked, pair, overlay, children }: Props) {
  const layers: Layer[] = [{ probs, tone, hidden, moved, found }, ...(pair ? [pair] : [])]
  const n = probs.length
  const slot = pair ? 13 : n > 8 ? 11 : 15
  const radius = 39
  const scale = Math.max(0.5, ...layers.flatMap((l) => (l.hidden ? [] : l.probs)))
  // a pair shares each room: first ghost on the left, second on the right
  const spot = pair ? [28, 72] : [50]
  const [lo, hi] = pair ? [18, 36] : [34, 66]
  const travels = layers.map((l) => (l.moved && !l.hidden ? l.moved : null))
  const most = counts ? Math.max(0, ...counts) : 0

  return (
    <div className="ring" style={{ '--slot': `${slot}%` } as CSSProperties}>
      <span className="ring-track" aria-hidden="true" style={{ inset: `${50 - radius}%` }} />
      {overlay}
      {probs.map((p, k) => {
        const a = (k * 2 * Math.PI) / n
        const at = (r: number) => ({ left: `${50 + r * Math.sin(a)}%`, top: `${50 - r * Math.cos(a)}%` })
        const side = Math.sin(a) > 0.3 ? 'is-right' : Math.sin(a) < -0.3 ? 'is-left' : ''
        const there = layers.map((l) => l.hidden || l.probs[k] >= 1e-4)
        const anyone = there.some(Boolean)
        const caught = layers.some((l) => l.found === k)
        const state = [k === lit && 'is-lit', caught && 'is-found', k === picked && 'is-picked'].filter(Boolean).join(' ')
        const votes = counts?.[k] ?? 0
        const label = layers.some((l) => !l.hidden && l.probs[k] >= 0.0005)
        // rooms pop in one after another around the ring
        const enter = { animationDelay: `${120 + k * (480 / n)}ms` }
        return (
          <div key={k}>
            <button
              type="button"
              className={`slot ${state}`}
              style={{ ...at(radius), ...enter }}
              disabled={disabled}
              onClick={() => onPick?.(k)}
              aria-label={roomLabel ? roomLabel(k, p) : `Room ${k + 1}`}
            >
              <span className="slot-outline" style={{ opacity: anyone ? 0 : 1, transitionDelay: travels.some(Boolean) && !anyone ? '0ms' : undefined }}>
                <Ghost tone={tone} outline />
              </span>
              {layers.map((l, i) => {
                const v = l.probs[k]
                const share = l.hidden ? 0.55 : Math.sqrt(v / scale)
                const travel = travels[i]
                // after a step, ghosts leaving a room shrink at once; arriving ones grow as the travellers land
                const arriving = travel != null && v > travel.from[k] + 1e-9
                const ghost: CSSProperties = {
                  left: pair ? `${spot[i]}%` : undefined,
                  width: there[i] ? `${lo + hi * share}%` : '0%',
                  opacity: there[i] ? 0.5 + 0.5 * share : 0,
                  transitionDuration: travel ? (arriving ? '520ms' : '280ms') : undefined,
                  transitionDelay: arriving ? `${Math.round(TRAVEL_MS * 0.55)}ms` : '0ms',
                }
                return (
                  <span key={i} className="slot-ghost" style={ghost}>
                    {/* fog hides a lone ghost's colour too; a pair keeps theirs to tell them apart */}
                    <Ghost tone={l.hidden && !pair ? 'white' : l.tone} />
                  </span>
                )
              })}
              {votes > 0 && <span className={`slot-count ${votes === most ? 'is-top' : ''}`}>{votes}</span>}
              {k === empty && !caught && <span className="slot-tag">empty</span>}
              {caught && <span className="slot-tag is-light">caught</span>}
            </button>
            <span className={`slot-label ${side}`} style={{ ...at(radius + slot / 2 + (side ? 1.8 : 3.4)), ...enter }} aria-hidden="true">
              <b>{k + 1}</b>
              {/* keyed by value: a new number fades in, landing with the ghosts */}
              {label &&
                layers.map((l, i) =>
                  l.hidden ? null : (
                    <span key={`${i}:${pct(l.probs[k])}`} className={[travels[i] && 'pct-land', pair && `pct-${l.tone}`].filter(Boolean).join(' ') || undefined}>
                      {pct(l.probs[k])}
                    </span>
                  ),
                )}
            </span>
          </div>
        )
      })}
      {travels.map(
        (t, i) =>
          t && (
            <Travel
              key={`travel:${i}:${t.id}`}
              from={t.from}
              tone={layers[i].tone}
              radius={radius}
              slot={slot}
              dx={((spot[i] - 50) / 100) * slot}
              fit={hi / 66}
            />
          ),
      )}
      <div className="ring-centre">{children}</div>
    </div>
  )
}
