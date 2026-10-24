import { CSSProperties, ReactNode } from 'react'
import { pct } from '../engine/walk'
import { Ghost, Tone } from './Ghost'
import { Travel, TRAVEL_MS } from './Travel'

// The corridor loops, so the rooms sit on a ring. In each room the ghost is
// drawn as a ghost: the bigger and brighter it is, the more likely you are to
// find it there. Rooms it cannot be in show a dashed outline.

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
  /** the chances before the last step: ghosts split and travel to the neighbours */
  moved?: { id: number; from: number[] } | null
  /** drawn over the track, under the rooms, in a 0..100 viewBox */
  overlay?: ReactNode
  children?: ReactNode
}

export function Ring({ probs, tone, hidden, lit, empty, found, disabled, onPick, roomLabel, moved, overlay, children }: Props) {
  const n = probs.length
  const slot = n > 8 ? 11 : 15
  const radius = 39
  const scale = Math.max(0.5, ...probs)
  const travel = moved && !hidden ? moved : null

  return (
    <div className="ring" style={{ '--slot': `${slot}%` } as CSSProperties}>
      <span className="ring-track" aria-hidden="true" style={{ inset: `${50 - radius}%` }} />
      {overlay}
      {probs.map((p, k) => {
        const a = (k * 2 * Math.PI) / n
        const at = (r: number) => ({ left: `${50 + r * Math.sin(a)}%`, top: `${50 - r * Math.cos(a)}%` })
        const side = Math.sin(a) > 0.3 ? 'is-right' : Math.sin(a) < -0.3 ? 'is-left' : ''
        const there = hidden || p >= 1e-4
        const share = hidden ? 0.55 : Math.sqrt(p / scale)
        // after a step, ghosts leaving a room shrink at once; arriving ones grow as the travellers land
        const arriving = travel != null && p > travel.from[k] + 1e-9
        const ghost: CSSProperties = {
          width: there ? `${34 + 66 * share}%` : '0%',
          opacity: there ? 0.5 + 0.5 * share : 0,
          transitionDuration: travel ? (arriving ? '520ms' : '280ms') : undefined,
          transitionDelay: arriving ? `${Math.round(TRAVEL_MS * 0.55)}ms` : '0ms',
        }
        const state = [k === lit && 'is-lit', k === found && 'is-found'].filter(Boolean).join(' ')
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
              <span className="slot-outline" style={{ opacity: there ? 0 : 1, transitionDelay: travel && !there ? '0ms' : undefined }}>
                <Ghost tone={tone} outline />
              </span>
              <span className="slot-ghost" style={ghost}>
                <Ghost tone={hidden ? 'white' : tone} />
              </span>
              {k === empty && <span className="slot-tag">empty</span>}
              {k === found && <span className="slot-tag is-light">caught</span>}
            </button>
            <span className={`slot-label ${side}`} style={{ ...at(radius + slot / 2 + (side ? 1.8 : 3.4)), ...enter }} aria-hidden="true">
              <b>{k + 1}</b>
              {/* keyed by value: a new number fades in, landing with the ghosts */}
              {!hidden && p >= 0.0005 && (
                <span key={pct(p)} className={travel ? 'pct-land' : undefined}>
                  {pct(p)}
                </span>
              )}
            </span>
          </div>
        )
      })}
      {travel && <Travel key={`travel:${travel.id}`} from={travel.from} tone={tone} radius={radius} slot={slot} />}
      <div className="ring-centre">{children}</div>
    </div>
  )
}
