import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.interval('delete expired games', { minutes: 15 }, internal.games.cleanup, {})

export default crons
