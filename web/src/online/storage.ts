import { useEffect, useState } from 'react'
import type { Id } from '../../convex/_generated/dataModel'
import { GAME_TTL_MS } from '../game/rules'

// Who this browser is in a game, per code, so a reload keeps the host screen
// and the phone's player. Entries older than a game's lifetime are ignored,
// because by then the code may belong to a new game.

export interface HostSeat {
  gameId: Id<'games'>
  hostKey: string
}

export interface PlayerSeat {
  gameId: Id<'games'>
  playerId: Id<'players'>
  name: string
}

const key = (role: 'host' | 'player', code: string) => `ghost-walk:${role}:${code}`

function read<T>(role: 'host' | 'player', code: string): T | null {
  try {
    const raw = localStorage.getItem(key(role, code))
    if (!raw) return null
    const { at, seat } = JSON.parse(raw) as { at: number; seat: T }
    return Date.now() - at < GAME_TTL_MS ? seat : null
  } catch {
    return null
  }
}

function write<T>(role: 'host' | 'player', code: string, seat: T | null) {
  try {
    if (seat) localStorage.setItem(key(role, code), JSON.stringify({ at: Date.now(), seat }))
    else localStorage.removeItem(key(role, code))
  } catch {
    // private mode: the seat lasts as long as the page
  }
}

export const readHost = (code: string) => read<HostSeat>('host', code)
export const saveHost = (code: string, seat: HostSeat | null) => write('host', code, seat)
export const readPlayer = (code: string) => read<PlayerSeat>('player', code)
export const savePlayer = (code: string, seat: PlayerSeat | null) => write('player', code, seat)

/** "#/join/1234" -> "1234" */
export function codeFromHash(prefix: string): string | null {
  const m = window.location.hash.slice(prefix.length).match(/^\/(\d{4})\b/)
  return m ? m[1] : null
}

export const joinUrl = (code: string) => `${window.location.origin}/#/join/${code}`
/** what people type: the host serves /1234 as the join page for game 1234 */
export const shortJoinUrl = (code: string) => `${window.location.host}/${code}`

/** The game code in the hash, kept current: App only re-renders when the route itself changes. */
export function useHashCode(prefix: string): string | null {
  const [code, setCode] = useState(() => codeFromHash(prefix))
  useEffect(() => {
    const onHash = () => setCode(codeFromHash(prefix))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [prefix])
  return code
}
