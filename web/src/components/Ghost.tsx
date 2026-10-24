import { useId } from 'react'

export type Tone = 'quantum' | 'classical' | 'chip' | 'white'

const FILL: Record<Tone, [string, string]> = {
  quantum: ['#e4e8ff', '#8b9cff'],
  classical: ['#ffe3cc', '#ec8648'],
  chip: ['#d6f6ec', '#3dbd9c'],
  white: ['#ffffff', '#c9c9cf'],
}

const BODY =
  'M8 34C8 17 18.5 6 32 6s24 11 24 28v30c0 2.4-2.6 3.6-4.4 2.1L46 61.5l-5.7 4.8a3.5 3.5 0 0 1-4.6 0L32 63l-3.7 3.3a3.5 3.5 0 0 1-4.6 0L18 61.5l-5.6 4.6C10.6 67.6 8 66.4 8 64z'

interface Props {
  tone: Tone
  /** draw only a dashed outline: a room where the ghost cannot be */
  outline?: boolean
  className?: string
}

/** A ghost: rounded head, scalloped hem, two eyes. Scales to its box. */
export function Ghost({ tone, outline, className }: Props) {
  const id = useId()
  const [top, bottom] = FILL[tone]
  if (outline) {
    return (
      <svg viewBox="0 0 64 72" className={className} aria-hidden="true">
        <path d={BODY} fill="none" stroke="#3b3b40" strokeWidth="2" strokeDasharray="4 4" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 64 72" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
      </defs>
      <path d={BODY} fill={`url(#${id})`} />
      <ellipse cx="24" cy="33" rx="3.6" ry="5" fill="#0b0b0c" />
      <ellipse cx="40" cy="33" rx="3.6" ry="5" fill="#0b0b0c" />
    </svg>
  )
}
