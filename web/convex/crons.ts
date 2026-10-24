import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Codes free up as soon as a game is idle for GAME_TTL_MS (create checks
// lastActive); this only clears the old rows away.
crons.interval('delete expired games', { minutes: 15 }, internal.games.cleanup, {})

export default crons
