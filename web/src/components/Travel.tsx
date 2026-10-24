import { useEffect, useRef } from 'react'
import { Ghost, Tone } from './Ghost'

export const TRAVEL_MS = 700
const SAMPLES = 8

interface Props {
  from: number[]
  tone: Tone
  radius: number
  slot: number
  // sideways shift and size factor for a ghost that shares its room with another
  dx?: number
  fit?: number
}

interface SpriteProps {
  room: number
  dir: -1 | 1
  n: number
  radius: number
  size: number
  tone: Tone
  dx: number
}

function Sprite({ room, dir, n, radius, size, tone, dx }: SpriteProps) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const step = (2 * Math.PI) / n
    const frames: Keyframe[] = []
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES
      const a = room * step + dir * t * step
      const x = 50 + dx + radius * Math.sin(a)
      const y = 50 - radius * Math.cos(a)
      frames.push({
        offset: t,
        transform: `translate(${x}cqw, ${y}cqw) translate(-50%, -50%) scale(${0.85 + 0.15 * Math.sin(Math.PI * t)})`,
        opacity: t < 0.12 ? t / 0.12 : t > 0.7 ? Math.max(0, (1 - t) / 0.3) : 1,
      })
    }
    const anim = el.animate(frames, { duration: TRAVEL_MS, easing: 'cubic-bezier(0.45, 0, 0.25, 1)', fill: 'forwards' })
    return () => anim.cancel()
  }, [room, dir, n, radius, dx])

  return (
    <span ref={ref} className="sprite" style={{ width: `${size}cqw` }}>
      <Ghost tone={tone} />
    </span>
  )
}

export function Travel({ from, tone, radius, slot, dx = 0, fit = 1 }: Props) {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null
  const n = from.length
  const scale = Math.max(0.5, ...from)
  return (
    <div className="travel" aria-hidden="true">
      {from.flatMap((p, room) => {
        if (p < 1e-4) return []
        // each half carries half the ghost: smaller than the ghost it left
        const size = (fit * slot * (30 + 50 * Math.sqrt(p / 2 / scale))) / 100
        return ([-1, 1] as const).map((dir) => (
          <Sprite key={`${room}:${dir}`} room={room} dir={dir} n={n} radius={radius} size={size} tone={tone} dx={dx} />
        ))
      })}
    </div>
  )
}
