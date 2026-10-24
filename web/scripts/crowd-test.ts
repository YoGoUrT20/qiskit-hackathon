// A showcase crowd against a real Convex deployment: one host, N phones that
// join and vote at the same moment.
//
//   node scripts/crowd-test.ts            # 100 phones, VITE_CONVEX_URL from .env.local
//   node scripts/crowd-test.ts 30
//
// Checks that every join and vote lands, that the host sees every vote, and
// that closing the vote searches the most-voted room.

import { readFileSync } from 'node:fs'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api.js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .flatMap((line) => (/^\w+=/.test(line) ? [line.trim().split(/=(.*)/s).slice(0, 2)] : [])),
)
const url = process.env.VITE_CONVEX_URL ?? env.VITE_CONVEX_URL
const n = Number(process.argv[2] ?? 100)
const client = () => new ConvexHttpClient(url)

const time = async <T>(f: () => Promise<T>) => {
  const t = performance.now()
  const value = await f()
  return { value, ms: performance.now() - t }
}
const stats = (ms: number[]) => {
  const s = [...ms].sort((a, b) => a - b)
  return `median ${s[Math.floor(s.length / 2)].toFixed(0)} ms, p95 ${s[Math.floor(s.length * 0.95)].toFixed(0)} ms, max ${s[s.length - 1].toFixed(0)} ms`
}

const host = client()
const game = await host.mutation(api.games.create, {})
const seat = { gameId: game.gameId, hostKey: game.hostKey }
console.log(`${url}: game ${game.code}, ${n} phones`)

const joins = await Promise.all(Array.from({ length: n }, () => time(() => client().mutation(api.players.join, { code: game.code }))))
if (joins.some((j) => !j.value)) throw new Error('a join failed')
console.log(`join: ${n} at once, ${stats(joins.map((j) => j.ms))}`)

await host.mutation(api.games.setOptions, { ...seat, voteSeconds: 30 })
await host.mutation(api.games.newRound, seat)
const state = await host.query(api.games.host, seat)
if (!state?.hunt) throw new Error('no hunt')
const p = state.hunt.probs
const ranked = p.map((v, k) => [v, k]).sort((a, b) => b[0] - a[0]).map(([, k]) => k)

// most phones pick the likeliest room, some the next ones
const choice = (i: number) => ranked[i % 10 < 6 ? 0 : i % 10 < 9 ? 1 : 2]
const votes = await Promise.all(
  joins.map((j, i) =>
    time(() =>
      client().mutation(api.games.vote, {
        gameId: j.value!.gameId,
        playerId: j.value!.playerId,
        round: state.round,
        turn: state.hunt!.turn,
        room: choice(i),
      }),
    ),
  ),
)
if (votes.some((v) => !v.value.ok)) throw new Error('a vote was refused')
console.log(`vote: ${n} at once, ${stats(votes.map((v) => v.ms))}`)

const live = await host.query(api.games.host, seat)
const counted = live?.tally?.reduce((a, b) => a + b, 0)
console.log(`host sees ${counted} of ${n} votes, ${live?.players.length} players`)
if (counted !== n) throw new Error('votes missing on the host screen')

await host.mutation(api.games.closeVote, seat)
const after = await host.query(api.games.host, seat)
const top = ranked[0]
console.log(`closed: searched room ${after!.result!.room + 1} (${after!.result!.votes} votes; expected room ${top + 1}), ${after!.hunt!.phase}`)
if (after!.result!.room !== top) throw new Error('the most-voted room was not searched')
console.log('ok')
