import { type Ghost, type Mode, newGhost, probs, project, step } from '../src/engine/walk.ts'
import { LIGHTS, WARMUP } from '../src/game/rules.ts'

type Policy = 'greedy' | 'random-possible' | 'random-any'

// exact win probability for "search the most likely room", ties split evenly.
function greedyWin(g: Ghost, lights: number): number {
  const p = probs(g)
  const top = Math.max(...p)
  const best = p.flatMap((v, k) => (v > top - 1e-12 ? [k] : []))
  let total = 0
  for (const room of best) {
    const caught = p[room]
    if (lights === 1 || caught > 1 - 1e-12) {
      total += caught
      continue
    }
    const next = step(project(g, (k) => k !== room))
    total += caught + (1 - caught) * greedyWin(next, lights - 1)
  }
  return total / best.length
}

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomWin(mode: Mode, lights: number, warmup: number, policy: Policy, games: number, seed = 1): number {
  const rnd = mulberry32(seed)
  const start = newGhost(mode, 16, warmup)
  let wins = 0
  for (let i = 0; i < games; i++) {
    let g = start
    for (let left = lights; left > 0; left--) {
      const p = probs(g)
      const choices = policy === 'random-any' ? p.map((_, k) => k) : p.flatMap((v, k) => (v > 1e-12 ? [k] : []))
      const room = choices[Math.floor(rnd() * choices.length)]
      if (rnd() < p[room]) {
        wins++
        break
      }
      g = project(g, (k) => k !== room)
      if (left > 1) g = step(g)
    }
  }
  return wins / games
}

const pct = (x: number) => `${(100 * x).toFixed(1)}%`.padStart(6)

const greedyCell = (mode: Mode, lights: number, warmup: number) => `${Math.round(100 * greedyWin(newGhost(mode, 16, warmup), lights))}`.padStart(4)

function row(lights: number, warmup: number, games: number) {
  const cells = (['quantum', 'classical'] as const).map((mode) => {
    const greedy = greedyWin(newGhost(mode, 16, warmup), lights)
    const possible = randomWin(mode, lights, warmup, 'random-possible', games)
    const any = randomWin(mode, lights, warmup, 'random-any', games)
    return `${pct(greedy)} ${pct(possible)} ${pct(any)}`
  })
  return `${String(lights).padStart(6)} ${String(warmup).padStart(6)}   ${cells.join('   ')}`
}

const args = process.argv.slice(2).map(Number)
const games = 200_000
const head = 'lights warmup   quantum: greedy rnd-possible rnd-any   coin-flip: greedy rnd-possible rnd-any'
if (args.length >= 2) {
  console.log(head)
  console.log(row(args[0], args[1], games))
} else {
  console.log(`Win rates, ${games.toLocaleString('en-GB')} random games per cell. greedy = always search the most likely room (exact);`)
  console.log('rnd-possible = a random room that can hold the ghost; rnd-any = any random room.\n')
  console.log(head)
  console.log(`${row(4, 3, games)}   before`)
  console.log(`${row(LIGHTS, WARMUP, games)}   now (src/game/rules.ts)\n`)
  const ls = [2, 3, 4, 5, 6, 7, 8]
  console.log(`greedy win %, quantum | coin-flip, flashlights ${ls.join(' ')}`)
  for (let w = 1; w <= 12; w++) {
    const q = ls.map((l) => greedyCell('quantum', l, w)).join('')
    const c = ls.map((l) => greedyCell('classical', l, w)).join('')
    console.log(`warm-up ${String(w).padStart(2)}  ${q}  | ${c}`)
  }
}
