// The ghost: a discrete-time quantum walk on a ring, the same unitary as
// ../../quantum_walk.py (Hadamard coin, coin 0 -> room - 1, coin 1 -> room + 1,
// start coin (|0> + i|1>)/sqrt(2)). Amplitudes are stored per room and coin.

export type Mode = 'quantum' | 'classical'

export interface Ghost {
  mode: Mode
  rooms: number
  // quantum: amplitude re/im for coin 0 and coin 1; classical: only `p` is used
  re0: number[]
  im0: number[]
  re1: number[]
  im1: number[]
  p: number[]
}

const S = Math.SQRT1_2
const zeros = (n: number) => new Array<number>(n).fill(0)

/** 0-based start index: 7 (room 8) for 16 rooms, 3 (room 4) for 8. */
export const startRoom = (rooms: number) => rooms / 2 - 1

export function newGhost(mode: Mode, rooms = 16, warmup = 3, s = startRoom(rooms)): Ghost {
  const g: Ghost = { mode, rooms, re0: zeros(rooms), im0: zeros(rooms), re1: zeros(rooms), im1: zeros(rooms), p: zeros(rooms) }
  g.re0[s] = S
  g.im1[s] = S
  g.p[s] = 1
  let out = g
  for (let i = 0; i < warmup; i++) out = step(out)
  return out
}

export function step(g: Ghost): Ghost {
  const n = g.rooms
  if (g.mode === 'classical') {
    return { ...g, p: g.p.map((_, k) => (g.p[(k - 1 + n) % n] + g.p[(k + 1) % n]) / 2) }
  }
  const out: Ghost = { ...g, re0: zeros(n), im0: zeros(n), re1: zeros(n), im1: zeros(n) }
  for (let k = 0; k < n; k++) {
    const left = (k - 1 + n) % n
    const right = (k + 1) % n
    out.re0[left] += (g.re0[k] + g.re1[k]) * S
    out.im0[left] += (g.im0[k] + g.im1[k]) * S
    out.re1[right] += (g.re0[k] - g.re1[k]) * S
    out.im1[right] += (g.im0[k] - g.im1[k]) * S
  }
  return out
}

export function probs(g: Ghost): number[] {
  if (g.mode === 'classical') return g.p.slice()
  return g.re0.map((_, k) => g.re0[k] ** 2 + g.im0[k] ** 2 + g.re1[k] ** 2 + g.im1[k] ** 2)
}

/** Projective measurement outcome: keep only rooms where `keep` is true, renormalise. */
export function project(g: Ghost, keep: (room: number) => boolean): Ghost {
  if (g.mode === 'classical') {
    const p = g.p.map((v, k) => (keep(k) ? v : 0))
    const total = p.reduce((a, b) => a + b, 0)
    return { ...g, p: p.map((v) => v / total) }
  }
  const mask = (xs: number[]) => xs.map((v, k) => (keep(k) ? v : 0))
  const kept = { ...g, re0: mask(g.re0), im0: mask(g.im0), re1: mask(g.re1), im1: mask(g.im1) }
  const norm = Math.sqrt(probs(kept).reduce((a, b) => a + b, 0))
  const scale = (xs: number[]) => xs.map((v) => v / norm)
  return { ...kept, re0: scale(kept.re0), im0: scale(kept.im0), re1: scale(kept.re1), im1: scale(kept.im1) }
}

/** What a coin-flipping ghost would do with these chances: the "no interference" baseline. */
export function classicalStep(p: number[]): number[] {
  const n = p.length
  return p.map((_, k) => (p[(k - 1 + n) % n] + p[(k + 1) % n]) / 2)
}

/** Draw a room from a distribution with a uniform number in [0, 1). */
export function sampleRoom(p: number[], roll: number): number {
  let r = roll
  for (let k = 0; k < p.length - 1; k++) {
    r -= p[k]
    if (r < 0) return k
  }
  return p.length - 1
}

export function pct(p: number): string {
  if (p >= 0.995) return '100%'
  if (p < 0.0005) return '0%'
  if (p < 0.01) return '<1%'
  return `${Math.round(p * 100)}%`
}
