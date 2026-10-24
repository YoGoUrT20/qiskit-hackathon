// Game codes: four digits as a string, leading zeros allowed. Nine codes in
// ten contain "67" at a random position (67xx, x67x, xx67); the rest are any
// four digits. Pure functions, so scripts/codes-test.ts can check them.

export type Rng = () => number

const digit = (rnd: Rng) => String(Math.floor(rnd() * 10))

export function randomCode(rnd: Rng = Math.random): string {
  if (rnd() < 0.9) {
    const at = Math.floor(rnd() * 3)
    const d = [digit(rnd), digit(rnd), digit(rnd), digit(rnd)]
    d[at] = '6'
    d[at + 1] = '7'
    return d.join('')
  }
  return Array.from({ length: 4 }, () => digit(rnd)).join('')
}

export const hasSixtySeven = (code: string) => code.includes('67')

/**
 * Draw codes until one is free. `taken` answers "is a still-active game using
 * this code?"; it runs inside the creating mutation, so two games created at
 * once cannot both pass the check (the second one's transaction conflicts and
 * retries).
 */
export async function pickCode(taken: (code: string) => Promise<boolean>, rnd: Rng = Math.random, tries = 64): Promise<string> {
  for (let i = 0; i < tries; i++) {
    const code = randomCode(rnd)
    if (!(await taken(code))) return code
  }
  throw new Error('No free game code, try again')
}
