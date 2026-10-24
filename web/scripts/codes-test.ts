// Checks the game codes in convex/codes.ts:   node scripts/codes-test.ts
//   1. every code is four digits, and about 90% contain "67" at each of the three positions
//   2. a code that an active game holds is never handed out again, and when every
//      code is taken, creating a game fails instead of reusing one

import assert from 'node:assert/strict'
import { hasSixtySeven, pickCode, randomCode } from '../convex/codes.ts'

const N = 200_000
const at = [0, 0, 0]
let with67 = 0
for (let i = 0; i < N; i++) {
  const code = randomCode()
  assert.match(code, /^\d{4}$/)
  if (hasSixtySeven(code)) with67++
  for (const k of [0, 1, 2]) if (code.slice(k, k + 2) === '67') at[k]++
}
const share = with67 / N
console.log(`${N.toLocaleString('en-GB')} codes: ${(100 * share).toFixed(2)}% contain 67 (67xx ${at[0]}, x67x ${at[1]}, xx67 ${at[2]})`)
assert.ok(share > 0.89 && share < 0.915, 'about 90% should contain 67')

// Collisions: mark most codes as taken by active games and draw many new ones.
const taken = new Set<string>()
for (let i = 0; i < 10_000; i++) {
  const code = String(i).padStart(4, '0')
  if (i % 7 !== 0) taken.add(code)
}
const isTaken = async (code: string) => taken.has(code)
let rejected = 0
const counting = async (code: string) => {
  const t = await isTaken(code)
  if (t) rejected++
  return t
}
const fresh = new Set<string>()
for (let i = 0; i < 2_000; i++) {
  const code = await pickCode(counting, Math.random, 1_000)
  assert.ok(!taken.has(code), `handed out a taken code ${code}`)
  fresh.add(code)
}
console.log(`collisions: ${taken.size} codes active, 2000 new games, ${rejected} taken codes drawn and rejected, 0 handed out`)

// Every code taken: must throw, never return a taken one.
const all = async () => true
await assert.rejects(pickCode(all), /No free game code/)
console.log('all codes taken: create fails with "No free game code"')

// The live check from the mutation, with a real active code: it is drawn and refused.
let draws = 0
const fixed = () => {
  draws++
  return [0.1, 0.0, 0.6, 0.7, 0.0, 0.0][(draws - 1) % 6] // 0.1 < 0.9 -> "67" at position 0, digits 6 7 0 0 -> "6700"
}
taken.clear()
taken.add('6700')
await assert.rejects(pickCode(isTaken, fixed, 3))
console.log('a code held by an active game ("6700") is refused every time it is drawn')
console.log('ok')
