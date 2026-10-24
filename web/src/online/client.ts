import { ConvexReactClient } from 'convex/react'

// Group play needs the Convex backend (VITE_CONVEX_URL in .env.local). Without
// it the site is the solo game only and the "Play online" button stays hidden.
const url = import.meta.env.VITE_CONVEX_URL as string | undefined

export const convex = url ? new ConvexReactClient(url) : null
