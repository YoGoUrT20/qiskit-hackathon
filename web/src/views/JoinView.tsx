import { useMutation, useQuery } from 'convex/react'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../convex/_generated/api'
import { Ghost } from '../components/Ghost'
import { Ring } from '../components/Ring'
import { newGhost, pct, probs } from '../engine/walk'
import { ROOMS, WARMUP } from '../game/rules'
import { convex } from '../online/client'
import { type PlayerSeat, readPlayer, savePlayer, useHashCode } from '../online/storage'
import { useCountdown } from '../online/useCountdown'
import { Gone } from './HostView'

// The phone side of a group game: join by code (from the QR code or typed),
// then vote for a room each turn and watch what the flashlight found.

export function JoinView() {
  const code = useHashCode('#/join')
  if (!convex) return <Gone text="Online play is not set up on this site." />
  if (!code) return <CodeForm />
  return <Seat key={code} code={code} />
}

function CodeForm({ error }: { error?: string }) {
  const [value, setValue] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (/^\d{4}$/.test(value)) window.location.hash = `#/join/${value}`
  }
  return (
    <main className="start phone-join">
      <div className="start-ghost" aria-hidden="true">
        <Ghost tone="quantum" />
      </div>
      <h1 className="phone-h1">Join a hunt</h1>
      {error && <p className="start-lede">{error}</p>}
      <form className="code-form" onSubmit={submit}>
        <label htmlFor="code" className="note">
          Game code from the big screen
        </label>
        <input
          id="code"
          className="code-input"
          inputMode="numeric"
          autoComplete="off"
          pattern="\d{4}"
          maxLength={4}
          placeholder="0000"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
          autoFocus
        />
        <button type="submit" className="btn-plain" disabled={value.length !== 4}>
          Join
        </button>
      </form>
      <a className="text-link" href="#/">
        Or play alone
      </a>
    </main>
  )
}

/** Find this phone's player in the game, or join it once. */
function Seat({ code }: { code: string }) {
  const join = useMutation(api.players.join)
  const [seat, setSeat] = useState<PlayerSeat | null>(() => readPlayer(code))
  const [missing, setMissing] = useState(false)
  const joining = useRef(false)

  useEffect(() => {
    if (seat || joining.current) return
    joining.current = true
    join({ code })
      .then((s) => {
        if (!s) return setMissing(true)
        const fresh = { gameId: s.gameId, playerId: s.playerId, name: s.name }
        savePlayer(code, fresh)
        setSeat(fresh)
      })
      .catch(() => setMissing(true))
      .finally(() => {
        joining.current = false
      })
  }, [code, join, seat])

  if (missing) return <CodeForm error={`No game is running with code ${code}. Check the big screen.`} />
  if (!seat) return <main className="phone" aria-busy="true" />
  return (
    <Phone
      code={code}
      seat={seat}
      onLost={() => {
        // the saved player belongs to an old game: join the current one
        savePlayer(code, null)
        setSeat(null)
      }}
    />
  )
}

function Phone({ code, seat, onLost }: { code: string; seat: PlayerSeat; onLost: () => void }) {
  const game = useQuery(api.games.phone, { gameId: seat.gameId, playerId: seat.playerId })
  const vote = useMutation(api.games.vote)
  const [pending, setPending] = useState<{ turn: string; room: number } | null>(null)
  const [late, setLate] = useState<string | null>(null)
  const h = game?.hunt
  const left = useCountdown(h?.phase === 'aim' ? game?.closesAt : null)
  const mode = game?.mode ?? 'quantum'
  const preview = useMemo(() => probs(newGhost(mode, ROOMS, WARMUP)), [mode])

  useEffect(() => {
    if (game === null) onLost()
  }, [game, onLost])

  if (!game) return <main className="phone" aria-busy="true" />

  const turnKey = `${game.round}:${h?.turn}`
  const phase = h?.phase ?? 'lobby'
  const p = h?.probs ?? preview
  const over = phase === 'won' || phase === 'lost'
  const mine = pending?.turn === turnKey ? pending.room : game.myVote
  const canVote = phase === 'aim' && left !== 0
  const result = game.result

  const pick = (room: number) => {
    if (!h || !canVote) return
    setPending({ turn: turnKey, room })
    setLate(null)
    vote({ gameId: seat.gameId, playerId: seat.playerId, round: game.round, turn: h.turn, room })
      .then((r) => {
        if (!r.ok) setLate(turnKey)
      })
      .catch(() => setLate(turnKey))
  }

  const title = {
    lobby: 'You are in',
    aim: mine == null ? 'Pick a room' : `You voted room ${mine + 1}`,
    reveal: `Room ${(h?.lit ?? 0) + 1} was empty`,
    won: `Caught in room ${(h?.found ?? 0) + 1}`,
    lost: 'It escaped',
  }[phase]

  const sub = {
    lobby: 'Wait for the big screen to release the ghost.',
    aim:
      late === turnKey
        ? 'Too late: that vote had closed.'
        : mine == null
          ? `Tap the room to search. The most votes wins.`
          : `${pct(p[mine])} chance there. Tap another room to change.`,
    reveal: result?.random ? 'Nobody voted, so the light swung at random. The ghost is moving.' : 'The ghost is moving.',
    won: 'Wait for the next ghost.',
    lost: `It was in room ${(h?.found ?? 0) + 1}. Wait for the next ghost.`,
  }[phase]

  return (
    <main className="phone">
      <header className="phone-head">
        <a href="#/" className="wordmark wordmark-small">
          <Ghost tone="quantum" className="wordmark-ghost" />
          Ghost Walk
        </a>
        <span className="phone-me">
          {seat.name} · <b>{code}</b>
        </span>
      </header>

      <section className="phone-status" aria-live="polite">
        <h1 className="phone-title">{title}</h1>
        <p className="muted">{sub}</p>
      </section>

      <div className="phone-ring">
        <Ring
          probs={p}
          tone={mode}
          lit={phase === 'reveal' || phase === 'won' ? h?.lit : null}
          empty={h?.empty}
          found={over ? h?.found : null}
          picked={phase === 'aim' ? mine : null}
          disabled={!canVote}
          moved={h?.moved}
          onPick={pick}
          roomLabel={(k, v) => `Vote for room ${k + 1}, ${pct(v)} chance`}
        >
          {phase === 'aim' && <p className="centre-title countdown">{left}</p>}
          {h && (
            <span className="lights" role="img" aria-label={`${h.lights} of ${h.maxLights} flashlights left`}>
              {Array.from({ length: h.maxLights }, (_, i) => (
                <span key={i} className={i < h.lights ? 'is-on' : ''} />
              ))}
            </span>
          )}
        </Ring>
      </div>

      {h && h.log[0] && <p className="phone-log">{h.log[0].text}</p>}
      {game.round > 0 && (
        <p className="note phone-score">
          Ghost {game.round} · caught {game.caught}
        </p>
      )}
    </main>
  )
}
