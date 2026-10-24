import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export const mode = v.union(v.literal('quantum'), v.literal('classical'))

export const ghost = v.object({
  mode,
  rooms: v.number(),
  re0: v.array(v.number()),
  im0: v.array(v.number()),
  re1: v.array(v.number()),
  im1: v.array(v.number()),
  p: v.array(v.number()),
})

const room = v.union(v.number(), v.null())

export const hunt = v.object({
  ghost,
  phase: v.union(v.literal('aim'), v.literal('reveal'), v.literal('won'), v.literal('lost')),
  turn: v.number(),
  lights: v.number(),
  maxLights: v.number(),
  lit: room,
  empty: room,
  found: room,
  log: v.array(v.object({ id: v.number(), turn: v.number(), text: v.string() })),
  nextId: v.number(),
  moved: v.union(v.object({ id: v.number(), from: v.array(v.number()) }), v.null()),
})

export default defineSchema({
  games: defineTable({
    code: v.string(),
    hostKey: v.string(),
    mode,
    voteMs: v.number(),
    hunt: v.union(hunt, v.null()),
    round: v.number(),
    caught: v.number(),
    closesAt: v.union(v.number(), v.null()),
    result: v.union(
      v.object({
        room: v.number(),
        votes: v.number(),
        voters: v.number(),
        tied: v.number(),
        random: v.boolean(),
        tally: v.array(v.number()),
      }),
      v.null(),
    ),
    lastActive: v.number(),
  })
    .index('by_code', ['code', 'lastActive'])
    .index('by_lastActive', ['lastActive']),

  players: defineTable({
    gameId: v.id('games'),
    name: v.string(),
  }).index('by_game', ['gameId']),

  votes: defineTable({
    gameId: v.id('games'),
    playerId: v.id('players'),
    round: v.number(),
    turn: v.number(),
    room: v.number(),
  })
    .index('by_turn', ['gameId', 'round', 'turn'])
    .index('by_player', ['playerId', 'round', 'turn']),
})
