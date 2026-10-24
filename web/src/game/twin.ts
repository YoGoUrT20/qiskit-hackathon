import { Mode, pct, probs } from '../engine/walk'
import { Hunt, HuntAction, LogEntry, huntReducer, newHunt } from './hunt'
import { WARMUP, word } from './rules'

// "Both" mode: a quantum ghost and a coin-flipping ghost haunt the same rooms.
// Every flashlight searches its room for both, so the only difference left
// between them is how each one moves.

export interface Twin {
  quantum: Hunt
  classical: Hunt
  log: LogEntry[]
  nextId: number
}

export const TWINS = ['quantum', 'classical'] as const

const NAME: Record<Mode, string> = { quantum: 'quantum', classical: 'coin-flip' }

export const loose = (h: Hunt) => h.phase === 'aim' || h.phase === 'reveal'

export function newTwin(lights: number, warmup = WARMUP): Twin {
  return {
    quantum: newHunt('quantum', lights, warmup),
    classical: newHunt('classical', lights, warmup),
    nextId: 1,
    log: [
      {
        id: 0,
        turn: 1,
        text: `Two ghosts started in room 8 and took ${word(warmup)} steps: a quantum one (blue) and one that flips coins (orange). Each flashlight searches its room for both.`,
      },
    ],
  }
}

// both loose ghosts get the same actions, so they are always in the same phase
export function twinPhase(t: Twin): 'aim' | 'reveal' | 'over' {
  const live = TWINS.map((m) => t[m]).find(loose)
  return live ? (live.phase as 'aim' | 'reveal') : 'over'
}

export function twinReducer(t: Twin, a: HuntAction): Twin {
  if (a.type === 'restart') return newTwin(a.lights)
  // one roll for both: a room that is likelier for one ghost catches it at least as often
  const quantum = loose(t.quantum) ? huntReducer(t.quantum, a) : t.quantum
  const classical = loose(t.classical) ? huntReducer(t.classical, a) : t.classical
  if (quantum === t.quantum && classical === t.classical) return t
  const next = { ...t, quantum, classical }
  const text = a.type === 'pick' ? explainPick(t, next, a.room) : explainAdvance(t, next)
  const turn = Math.max(quantum.turn, classical.turn)
  return { ...next, log: [{ id: t.nextId, turn, text }, ...t.log].slice(0, 8), nextId: t.nextId + 1 }
}

// only one ghost still loose: reuse its own hunt's sentence
function solo(after: Twin, m: Mode): string {
  const text = after[m].log[0].text
  return `${m === 'quantum' ? 'Quantum' : 'Coin-flip'} ghost: ${text[0].toLowerCase()}${text.slice(1)}`
}

function explainPick(before: Twin, after: Twin, room: number): string {
  const live = TWINS.filter((m) => loose(before[m]))
  if (live.length === 1) return solo(after, live[0])
  const pq = pct(probs(before.quantum.ghost)[room])
  const pc = pct(probs(before.classical.ghost)[room])
  const r = room + 1
  const q = after.quantum.phase === 'won'
  const c = after.classical.phase === 'won'
  if (q && c) return `Caught both ghosts in room ${r}. The quantum ghost had ${pq} there, the coin-flip ghost ${pc}.`
  if (q) return `Caught the quantum ghost in room ${r} (${pq}). The coin-flip ghost, at ${pc}, was not there.`
  if (c) return `Caught the coin-flip ghost in room ${r} (${pc}). The quantum ghost, at ${pq}, was not there.`
  return `Room ${r} was empty. It held ${pq} of the quantum ghost and ${pc} of the coin-flip one; that now spreads over the other rooms.`
}

function explainAdvance(before: Twin, after: Twin): string {
  const live = TWINS.filter((m) => loose(before[m]))
  if (live.length === 1) return solo(after, live[0])
  if (after.quantum.phase === 'lost') {
    return `Out of flashlights. A final look found the quantum ghost in room ${(after.quantum.found ?? 0) + 1} and the coin-flip ghost in room ${(after.classical.found ?? 0) + 1}.`
  }
  const pq = probs(after.quantum.ghost)
  const pc = probs(after.classical.ghost)
  let room = 0
  let gap = 0
  pq.forEach((v, i) => {
    const d = Math.abs(v - pc[i])
    if (d > gap) {
      gap = d
      room = i
    }
  })
  if (gap < 0.07) return 'Both ghosts stepped one room left and one room right. So far they spread the same way.'
  return pq[room] > pc[room]
    ? `Both ghosts stepped. In room ${room + 1} the quantum waves added up to ${pct(pq[room])}; the coin-flip ghost has ${pct(pc[room])} there.`
    : `Both ghosts stepped. In room ${room + 1} the quantum waves cancelled to ${pct(pq[room])}; the coin-flip ghost has ${pct(pc[room])} there.`
}

// the searched room while the ghosts move, or where the hunt ended with a catch
export function twinLit(t: Twin): number | null {
  const phase = twinPhase(t)
  if (phase === 'reveal') return TWINS.map((m) => t[m]).find(loose)!.lit
  if (phase === 'aim' || TWINS.some((m) => t[m].phase === 'lost')) return null
  return t.quantum.turn >= t.classical.turn ? t.quantum.lit : t.classical.lit
}

export function twinEmpty(t: Twin): number | null {
  return twinPhase(t) === 'reveal' ? TWINS.map((m) => t[m]).find(loose)!.empty : null
}

export function twinTitle(t: Twin): string {
  if (twinPhase(t) !== 'over') return `Turn ${Math.max(t.quantum.turn, t.classical.turn)}`
  const caught = TWINS.filter((m) => t[m].phase === 'won')
  if (caught.length === 2) return 'Caught both'
  if (caught.length === 0) return 'Both escaped'
  return `Caught the ${NAME[caught[0]]} ghost`
}

export function twinSub(t: Twin): string {
  const live = TWINS.filter((m) => loose(t[m]))
  if (live.length === 0) {
    const [q, c] = [t.quantum, t.classical]
    if (q.phase === 'won' && c.phase === 'won') return `Quantum on turn ${q.turn}, coin-flip on turn ${c.turn}`
    if (q.phase === 'won' || c.phase === 'won') return `The ${NAME[q.phase === 'won' ? 'classical' : 'quantum']} ghost got away`
    return 'Out of flashlights'
  }
  if (twinPhase(t) === 'reveal') return live.length === 2 ? 'The ghosts are moving' : `The ${NAME[live[0]]} ghost is moving`
  // both ghosts start in one room and step together, so they share a parity
  const parity = probs(t[live[0]].ghost).findIndex((v) => v > 1e-9) % 2
  return `Only ${parity === 0 ? 'odd' : 'even'} rooms can hold ${live.length === 2 ? 'them' : 'it'} now`
}

// one ghost's state for the key under the title
export function twinState(h: Hunt): string | null {
  if (h.phase === 'won') return `caught in ${(h.found ?? 0) + 1}`
  if (h.phase === 'lost') return 'escaped'
  return null
}
