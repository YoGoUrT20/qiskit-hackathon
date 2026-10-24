import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { Mode } from '../engine/walk'
import { convex } from './client'
import { saveHost } from './storage'

export function PlayOnlineButton({ mode }: { mode?: Mode }) {
  return convex ? <CreateGame mode={mode} /> : null
}

function CreateGame({ mode }: { mode?: Mode }) {
  const create = useMutation(api.games.create)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const start = async () => {
    setBusy(true)
    setFailed(false)
    try {
      const game = await create({ mode })
      saveHost(game.code, { gameId: game.gameId, hostKey: game.hostKey })
      window.location.hash = `#/host/${game.code}`
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button type="button" className="pill pill-small pill-light" disabled={busy} onClick={start}>
      {failed ? 'No connection, try again' : busy ? 'Opening…' : 'Play online'}
    </button>
  )
}
