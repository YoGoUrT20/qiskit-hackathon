// The hunt's rules, shared by solo play, group play (convex/) and the
// simulation (scripts/simulate.ts). Tuned with that simulation: with 3 warm-up
// steps the ghost sits in only four rooms and "always search the most likely
// room" won 88% of quantum hunts. After 7 steps it covers eight rooms and the
// quantum ghost already shows its two running peaks. With 4 flashlights the
// same play won 64% (quantum) and 68.5% (coin-flip) and random play 41%,
// which felt too hard for new players; 5 flashlights give 71% and 74.7%
// against 48.6% for picking at random.

export const ROOMS = 16
export const LIGHTS = 5
export const WARMUP = 7

// Group play (convex/games.ts): the crowd votes, the most-voted room is searched.
export const VOTE_SECONDS = [10, 20, 30] as const
export const DEFAULT_VOTE_MS = 20_000
/** how long everyone sees the searched room before the ghost steps */
export const REVEAL_MS = 3_500
/** a game nobody has touched for this long is over and its code is free again */
export const GAME_TTL_MS = 2 * 60 * 60 * 1000

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']

/** 7 -> "seven", for the texts that say how many steps or flashlights. */
export const word = (n: number) => WORDS[n] ?? String(n)

/** "seven" -> "Seven", for the start of a sentence */
export const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
