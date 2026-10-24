import { useEffect, useState } from 'react'

// seconds until `closesAt` (on a server) ticking while a vote is open.
export function useCountdown(closesAt: number | null | undefined): number | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (closesAt == null) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [closesAt])
  if (closesAt == null) return null
  return Math.max(0, Math.ceil((closesAt - now) / 1000))
}
