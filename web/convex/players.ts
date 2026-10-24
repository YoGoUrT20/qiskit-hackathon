import { v } from 'convex/values'
import { mutation } from './_generated/server'
import { GAME_TTL_MS } from '../src/game/rules'
import { randomName } from './names'

/** Join the active game with this code. Returns null if there is none (wrong code, or it expired). */
export const join = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const game = await ctx.db
      .query('games')
      .withIndex('by_code', (q) => q.eq('code', code).gt('lastActive', Date.now() - GAME_TTL_MS))
      .order('desc')
      .first()
    if (!game) return null
    // Names are not checked for repeats: that would make every join read every
    // other player, and 100 phones joining at once would keep conflicting.
    const name = randomName()
    const playerId = await ctx.db.insert('players', { gameId: game._id, name })
    return { gameId: game._id, playerId, name, code }
  },
})
