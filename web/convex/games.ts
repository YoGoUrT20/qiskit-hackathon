import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { internalMutation, mutation, query, type DatabaseReader, type MutationCtx } from './_generated/server'
import { probs } from '../src/engine/walk'
import { huntReducer, newHunt } from '../src/game/hunt'
import { DEFAULT_VOTE_MS, GAME_TTL_MS, LIGHTS, REVEAL_MS, VOTE_SECONDS } from '../src/game/rules'
import { pickCode } from './codes'
import { mode } from './schema'

const token = () => Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10)).join('')

async function hostGame(ctx: MutationCtx, gameId: Id<'games'>, hostKey: string) {
  const game = await ctx.db.get(gameId)
  if (!game || game.hostKey !== hostKey) throw new ConvexError('Only the host screen can do that')
  return game
}

function publicView(game: Doc<'games'>) {
  const h = game.hunt
  return {
    code: game.code,
    mode: game.mode,
    voteMs: game.voteMs,
    round: game.round,
    caught: game.caught,
    closesAt: game.closesAt,
    result: game.result,
    hunt: h && {
      phase: h.phase,
      turn: h.turn,
      lights: h.lights,
      maxLights: h.maxLights,
      lit: h.lit,
      empty: h.empty,
      found: h.found,
      moved: h.moved,
      log: h.log.slice(0, 3),
      probs: probs(h.ghost),
    },
  }
}

export type PublicGame = ReturnType<typeof publicView>

const votesFor = (db: DatabaseReader, game: Doc<'games'>) =>
  db
    .query('votes')
    .withIndex('by_turn', (q) => q.eq('gameId', game._id).eq('round', game.round).eq('turn', game.hunt?.turn ?? 0))
    .collect()

// ------------------------------------------------------------------ host

export const create = mutation({
  args: { mode: v.optional(mode) },
  handler: async (ctx, args) => {
    const now = Date.now()
    const code = await pickCode(async (c) => {
      const active = await ctx.db
        .query('games')
        .withIndex('by_code', (q) => q.eq('code', c).gt('lastActive', now - GAME_TTL_MS))
        .first()
      return active !== null
    })
    const hostKey = token()
    const gameId = await ctx.db.insert('games', {
      code,
      hostKey,
      mode: args.mode ?? 'quantum',
      voteMs: DEFAULT_VOTE_MS,
      hunt: null,
      round: 0,
      caught: 0,
      closesAt: null,
      result: null,
      lastActive: now,
    })
    return { gameId, code, hostKey }
  },
})

export const setOptions = mutation({
  args: { gameId: v.id('games'), hostKey: v.string(), mode: v.optional(mode), voteSeconds: v.optional(v.number()) },
  handler: async (ctx, { gameId, hostKey, mode: m, voteSeconds }) => {
    const game = await hostGame(ctx, gameId, hostKey)
    const patch: Partial<Doc<'games'>> = { lastActive: Date.now() }
    if (m) patch.mode = m
    if (voteSeconds !== undefined) {
      if (!(VOTE_SECONDS as readonly number[]).includes(voteSeconds)) throw new ConvexError('Unknown vote length')
      patch.voteMs = voteSeconds * 1000
    }
    await ctx.db.patch(game._id, patch)
  },
})

export const newRound = mutation({
  args: { gameId: v.id('games'), hostKey: v.string() },
  handler: async (ctx, { gameId, hostKey }) => {
    const game = await hostGame(ctx, gameId, hostKey)
    const now = Date.now()
    const round = game.round + 1
    const hunt = newHunt(game.mode, LIGHTS)
    await ctx.db.patch(gameId, { hunt, round, closesAt: now + game.voteMs, result: null, lastActive: now })
    await ctx.scheduler.runAt(now + game.voteMs, internal.games.resolve, { gameId, round, turn: hunt.turn })
  },
})

export const closeVote = mutation({
  args: { gameId: v.id('games'), hostKey: v.string() },
  handler: async (ctx, { gameId, hostKey }) => {
    await resolveVote(ctx, await hostGame(ctx, gameId, hostKey))
  },
})

export const touch = mutation({
  args: { gameId: v.id('games'), hostKey: v.string() },
  handler: async (ctx, { gameId, hostKey }) => {
    await ctx.db.patch((await hostGame(ctx, gameId, hostKey))._id, { lastActive: Date.now() })
  },
})

export const host = query({
  args: { gameId: v.id('games'), hostKey: v.string() },
  handler: async (ctx, { gameId, hostKey }) => {
    const game = await ctx.db.get(gameId)
    if (!game || game.hostKey !== hostKey) return null
    const players = await ctx.db
      .query('players')
      .withIndex('by_game', (q) => q.eq('gameId', gameId))
      .take(500)
    let tally: number[] | null = null
    if (game.hunt?.phase === 'aim') {
      tally = new Array<number>(game.hunt.ghost.rooms).fill(0)
      for (const vote of await votesFor(ctx.db, game)) tally[vote.room]++
    }
    return { ...publicView(game), players: players.map((p) => p.name), tally }
  },
})

// --------------------------------------------------------------- players

export const phone = query({
  args: { gameId: v.id('games'), playerId: v.id('players') },
  handler: async (ctx, { gameId, playerId }) => {
    const [game, player] = await Promise.all([ctx.db.get(gameId), ctx.db.get(playerId)])
    if (!game || !player || player.gameId !== gameId) return null
    if (game.lastActive < Date.now() - GAME_TTL_MS) return null
    const turn = game.hunt?.turn
    const mine =
      turn === undefined
        ? null
        : await ctx.db
            .query('votes')
            .withIndex('by_player', (q) => q.eq('playerId', playerId).eq('round', game.round).eq('turn', turn))
            .unique()
    return { ...publicView(game), name: player.name, myVote: mine?.room ?? null }
  },
})

export const vote = mutation({
  args: { gameId: v.id('games'), playerId: v.id('players'), round: v.number(), turn: v.number(), room: v.number() },
  handler: async (ctx, a) => {
    const game = await ctx.db.get(a.gameId)
    const h = game?.hunt
    if (!game || !h || h.phase !== 'aim' || game.round !== a.round || h.turn !== a.turn) return { ok: false as const }
    if (!Number.isInteger(a.room) || a.room < 0 || a.room >= h.ghost.rooms) throw new ConvexError('No such room')
    const player = await ctx.db.get(a.playerId)
    if (!player || player.gameId !== a.gameId) throw new ConvexError('Not in this game')
    const mine = await ctx.db
      .query('votes')
      .withIndex('by_player', (q) => q.eq('playerId', a.playerId).eq('round', a.round).eq('turn', a.turn))
      .unique()
    if (mine) await ctx.db.patch(mine._id, { room: a.room })
    else await ctx.db.insert('votes', { gameId: a.gameId, playerId: a.playerId, round: a.round, turn: a.turn, room: a.room })
    return { ok: true as const }
  },
})

// ------------------------------------------------------------ turn engine

async function resolveVote(ctx: MutationCtx, game: Doc<'games'>) {
  const h = game.hunt
  if (!h || h.phase !== 'aim') return
  const rooms = h.ghost.rooms
  const tally = new Array<number>(rooms).fill(0)
  const votes = await votesFor(ctx.db, game)
  for (const vote of votes) tally[vote.room]++
  const top = Math.max(...tally)
  const best = tally.flatMap((n, k) => (n === top ? [k] : []))
  // nobody voted: the flashlight swings into a random room, and the turn still counts
  const room = top > 0 ? best[Math.floor(Math.random() * best.length)] : Math.floor(Math.random() * rooms)
  const hunt = huntReducer(h, { type: 'pick', room, roll: Math.random() })
  const now = Date.now()
  await ctx.db.patch(game._id, {
    hunt,
    closesAt: null,
    caught: game.caught + (hunt.phase === 'won' ? 1 : 0),
    result: { room, votes: top, voters: votes.length, tied: top > 0 ? best.length : 0, random: top === 0, tally },
    lastActive: now,
  })
  if (hunt.phase === 'reveal') {
    await ctx.scheduler.runAfter(REVEAL_MS, internal.games.advance, { gameId: game._id, round: game.round, turn: hunt.turn })
  }
}

const turnRef = { gameId: v.id('games'), round: v.number(), turn: v.number() }

export const resolve = internalMutation({
  args: turnRef,
  handler: async (ctx, { gameId, round, turn }) => {
    const game = await ctx.db.get(gameId)
    if (!game || game.round !== round || game.hunt?.turn !== turn) return
    await resolveVote(ctx, game)
  },
})

export const advance = internalMutation({
  args: turnRef,
  handler: async (ctx, { gameId, round, turn }) => {
    const game = await ctx.db.get(gameId)
    const h = game?.hunt
    if (!game || !h || game.round !== round || h.turn !== turn || h.phase !== 'reveal') return
    const hunt = huntReducer(h, { type: 'advance', roll: Math.random() })
    const now = Date.now()
    const open = hunt.phase === 'aim'
    await ctx.db.patch(gameId, { hunt, closesAt: open ? now + game.voteMs : null, lastActive: now })
    if (open) await ctx.scheduler.runAt(now + game.voteMs, internal.games.resolve, { gameId, round, turn: hunt.turn })
  },
})

// --------------------------------------------------------------- expiry

const BATCH = 20

/** Delete games idle for longer than GAME_TTL_MS, with their players and votes. Runs from crons.ts. */
export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const old = await ctx.db
      .query('games')
      .withIndex('by_lastActive', (q) => q.lt('lastActive', Date.now() - GAME_TTL_MS))
      .take(BATCH)
    let more = old.length === BATCH
    for (const game of old) {
      const votes = await ctx.db.query('votes').withIndex('by_turn', (q) => q.eq('gameId', game._id)).take(1000)
      const players = await ctx.db.query('players').withIndex('by_game', (q) => q.eq('gameId', game._id)).take(1000)
      await Promise.all([...votes, ...players].map((d) => ctx.db.delete(d._id)))
      if (votes.length === 1000 || players.length === 1000) more = true
      else await ctx.db.delete(game._id)
    }
    if (more) await ctx.scheduler.runAfter(0, internal.games.cleanup, {})
  },
})
