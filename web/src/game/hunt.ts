import { classicalStep, Ghost, Mode, newGhost, pct, probs, project, sampleRoom, step } from '../engine/walk'
import { ROOMS, WARMUP, word } from './rules'

export type Phase = 'aim' | 'reveal' | 'won' | 'lost'

export interface LogEntry {
  id: number
  turn: number
  text: string
}

export interface Hunt {
  ghost: Ghost
  phase: Phase
  turn: number
  lights: number
  maxLights: number
  lit: number | null
  empty: number | null
  found: number | null
  log: LogEntry[]
  nextId: number
  /** chances just before the last step, so the ring can animate the move */
  moved: { id: number; from: number[] } | null
}

export type HuntAction =
  | { type: 'pick'; room: number; roll: number }
  | { type: 'advance'; roll: number }
  | { type: 'restart'; mode: Mode; lights: number }

export function newHunt(mode: Mode, lights: number, warmup = WARMUP): Hunt {
  return {
    ghost: newGhost(mode, ROOMS, warmup),
    phase: 'aim',
    turn: 1,
    lights,
    maxLights: lights,
    lit: null,
    empty: null,
    found: null,
    nextId: 1,
    moved: null,
    log: [{ id: 0, turn: 1, text: `The ghost started in room 8 and has taken ${word(warmup)} steps. Shine a flashlight into a room.` }],
  }
}

function addLog(h: Hunt, text: string): Pick<Hunt, 'log' | 'nextId'> {
  return { log: [{ id: h.nextId, turn: h.turn, text }, ...h.log].slice(0, 8), nextId: h.nextId + 1 }
}

function explainStep(mode: Mode, before: number[], after: number[]): string {
  if (mode === 'classical') return 'The ghost flipped a coin in every room and stepped left or right. Its chances simply add up.'
  const plain = classicalStep(before)
  let room = 0
  let gap = 0
  after.forEach((v, i) => {
    const d = Math.abs(v - plain[i])
    if (d > gap) {
      gap = d
      room = i
    }
  })
  if (gap < 0.07) return 'The ghost stepped one room left and one room right at the same time.'
  return after[room] < plain[room]
    ? `Waves cancelled in room ${room + 1}. A coin-flipping ghost would be there ${pct(plain[room])} of the time; this one, ${pct(after[room])}.`
    : `Waves added up in room ${room + 1}: ${pct(after[room])}, where a coin-flipping ghost would have ${pct(plain[room])}.`
}

export function huntReducer(h: Hunt, a: HuntAction): Hunt {
  switch (a.type) {
    case 'restart':
      return newHunt(a.mode, a.lights)

    case 'pick': {
      if (h.phase !== 'aim') return h
      const pk = probs(h.ghost)[a.room]
      const lights = h.lights - 1
      if (a.roll < pk) {
        return {
          ...h,
          ...addLog(h, `Caught in room ${a.room + 1}. The odds there were ${pct(pk)}.`),
          ghost: project(h.ghost, (k) => k === a.room),
          phase: 'won',
          lights,
          lit: a.room,
          found: a.room,
          moved: null,
        }
      }
      const ghost = project(h.ghost, (k) => k !== a.room)
      const after = probs(ghost)
      const best = after.indexOf(Math.max(...after))
      const text = pk >= 0.0005
        ? `Room ${a.room + 1} was empty. Its ${pct(pk)} spread over the other rooms; room ${best + 1} is now ${pct(after[best])}.`
        : `Room ${a.room + 1} was empty, as the plan showed.`
      return { ...h, ...addLog(h, text), ghost, phase: 'reveal', lights, lit: a.room, empty: a.room, moved: null }
    }

    case 'advance': {
      if (h.phase !== 'reveal') return h
      if (h.lights <= 0) {
        const room = sampleRoom(probs(h.ghost), a.roll)
        return {
          ...h,
          ...addLog(h, `Out of flashlights. A final look found the ghost in room ${room + 1}.`),
          ghost: project(h.ghost, (k) => k === room),
          phase: 'lost',
          lit: null,
          empty: null,
          found: room,
        }
      }
      const before = probs(h.ghost)
      const ghost = step(h.ghost)
      const next = { ...h, turn: h.turn + 1 }
      return {
        ...next,
        ...addLog(next, explainStep(h.ghost.mode, before, probs(ghost))),
        ghost,
        phase: 'aim',
        lit: null,
        empty: null,
        moved: { id: next.turn, from: before },
      }
    }
  }
}
