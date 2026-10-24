import { useMutation, useQuery } from 'convex/react'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useMemo } from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { Ghost } from '../components/Ghost'
import { Ring } from '../components/Ring'
import { Mode, newGhost, pct, probs } from '../engine/walk'
import { cap, LIGHTS, ROOMS, VOTE_SECONDS, WARMUP, word } from '../game/rules'
import { BackButton } from '../online/BackButton'
import { convex } from '../online/client'
import { joinUrl, readHost, shortJoinUrl, useHashCode } from '../online/storage'
import { useCountdown } from '../online/useCountdown'

export function HostView() {
  const code = useHashCode('#/host')
  const seat = code ? readHost(code) : null
  if (!convex) return <Gone text="Online play is not set up on this site." />
  if (!code || !seat) return <Gone text="This game is hosted on another screen, or it has ended." />
  return <HostScreen key={seat.gameId} code={code} gameId={seat.gameId} hostKey={seat.hostKey} />
}

export function Gone({ text }: { text: string }) {
  return (
    <main className="start">
      <div className="start-ghost" aria-hidden="true">
        <Ghost tone="quantum" />
      </div>
      <p className="start-lede">{text}</p>
      <div className="actions">
        <a className="btn-plain" href="#/">
          Home
        </a>
        <a className="btn-plain" href="#/join">
          Join a game
        </a>
      </div>
    </main>
  )
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function HostScreen({ code, gameId, hostKey }: { code: string; gameId: Id<'games'>; hostKey: string }) {
  const game = useQuery(api.games.host, { gameId, hostKey })
  const newRound = useMutation(api.games.newRound)
  const closeVote = useMutation(api.games.closeVote)
  const setOptions = useMutation(api.games.setOptions)
  const touch = useMutation(api.games.touch)
  const left = useCountdown(game?.hunt?.phase === 'aim' ? game.closesAt : null)

  // keep the game alive while the projector shows it
  useEffect(() => {
    const ping = () => void touch({ gameId, hostKey }).catch(() => {})
    const t = setInterval(ping, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [gameId, hostKey, touch])

  const mode: Mode = game?.mode ?? 'quantum'
  const preview = useMemo(() => probs(newGhost(mode, ROOMS, WARMUP)), [mode])

  if (game === undefined) return <main className="game" aria-busy="true" />
  if (game === null) return <Gone text="This game has ended." />

  const h = game.hunt
  const phase = h?.phase ?? 'lobby'
  const p = h?.probs ?? preview
  const over = phase === 'won' || phase === 'lost'
  const between = phase === 'lobby' || over
  const players = game.players
  const voted = game.tally?.reduce((a, b) => a + b, 0) ?? 0
  const result = game.result
  const finished = game.round - (between ? 0 : 1)
  const parity = p.findIndex((v) => v > 1e-9) % 2
  const act = (f: () => Promise<unknown>) => () => void f().catch(() => {})

  const title = {
    lobby: 'Join in',
    aim: left === null ? '' : String(left),
    reveal: 'Empty',
    won: 'Caught',
    lost: 'Escaped',
  }[phase]

  const searched = result
    ? result.random
      ? `Nobody voted, so the light swung into room ${result.room + 1}`
      : result.tied > 1
        ? `Tie of ${result.tied} rooms: room ${result.room + 1} drawn`
        : `Room ${result.room + 1}, ${plural(result.votes, 'vote')}`
    : ''

  const sub = {
    lobby: `${plural(players.length, 'hunter')} in. Scan the code to join.`,
    aim: `Turn ${h?.turn}: vote on your phone. ${voted} of ${players.length} voted.`,
    reveal: `${searched}. The ghost is moving.`,
    won: `${searched}. Turn ${h?.turn}.`,
    lost: `It was in room ${(h?.found ?? 0) + 1}.`,
  }[phase]

  return (
    <main className="game host">
      <div className="corner corner-tl">
        <BackButton />
        <a href="#/" className="wordmark">
          <Ghost tone="quantum" className="wordmark-ghost" />
          Ghost Walk
        </a>
        <a className="pill pill-small" href="#/play">
          Solo
        </a>
      </div>

      <section className="corner corner-tr panel-card join-card" aria-label="Join this game">
        <span className="card-label">Scan to join</span>
        <a className="qr" href={joinUrl(code)} target="_blank" rel="noreferrer" aria-label={`Join link for game ${code}`}>
          <QRCodeSVG value={joinUrl(code)} size={512} marginSize={2} title={`Join game ${code}`} />
        </a>
        <p className="join-code" aria-label={`Game code ${code.split('').join(' ')}`}>
          {code}
        </p>
        <p className="join-url">{shortJoinUrl(code)}</p>
      </section>

      <section className="game-stage" aria-label="The haunted corridor">
        <Ring
          probs={p}
          tone={mode}
          lit={phase === 'reveal' || phase === 'won' ? h?.lit : null}
          empty={h?.empty}
          found={over ? h?.found : null}
          disabled
          moved={h?.moved}
          counts={phase === 'aim' ? game.tally : phase === 'reveal' ? result?.tally : null}
          roomLabel={(k, v) => `Room ${k + 1}, ${pct(v)} chance`}
        >
          <p className={`centre-title ${phase === 'aim' ? 'countdown' : ''}`}>{title}</p>
          <p className="centre-sub">{sub}</p>
          {phase === 'aim' && parity >= 0 && <p className="centre-sub">Only {parity === 0 ? 'odd' : 'even'} rooms can hold it</p>}
          {h && (
            <span className="lights" role="img" aria-label={`${h.lights} of ${h.maxLights} flashlights left`}>
              {Array.from({ length: h.maxLights }, (_, i) => (
                <span key={i} className={i < h.lights ? 'is-on' : ''} />
              ))}
            </span>
          )}
          {phase === 'aim' && (
            <button type="button" className="pill pill-small" onClick={act(() => closeVote({ gameId, hostKey }))}>
              Close the vote
            </button>
          )}
          {between && (
            <button type="button" className="pill pill-light" onClick={act(() => newRound({ gameId, hostKey }))}>
              {phase === 'lobby' ? 'Release the ghost' : 'Next ghost'}
            </button>
          )}
        </Ring>
      </section>

      <section className="corner corner-bl panel-card" aria-label="Hunters">
        <span className="card-label">Hunters · {players.length}</span>
        {players.length === 0 ? (
          <p className="note">Nobody yet. Phones join with the QR code or the code {code}.</p>
        ) : (
          <ul className="hunters">
            {players.slice(-40).map((name, i) => (
              <li key={`${i}:${name}`}>{name}</li>
            ))}
            {players.length > 40 && <li className="is-more">+{players.length - 40}</li>}
          </ul>
        )}
        {between && (
          <>
            <div className="tabs" role="tablist" aria-label="Ghost type">
              {(['quantum', 'classical'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  className={mode === m ? 'is-on' : ''}
                  onClick={act(() => setOptions({ gameId, hostKey, mode: m }))}
                >
                  <Ghost tone={m} className="tab-ghost" />
                  {m === 'quantum' ? 'Quantum' : 'Coin-flip'}
                </button>
              ))}
            </div>
            <div className="option-row">
              <span className="note">Vote time</span>
              <div className="tabs tabs-compact" role="tablist" aria-label="Vote time in seconds">
                {VOTE_SECONDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="tab"
                    aria-selected={game.voteMs === s * 1000}
                    className={game.voteMs === s * 1000 ? 'is-on' : ''}
                    onClick={act(() => setOptions({ gameId, hostKey, voteSeconds: s }))}
                  >
                    {s}s
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      <section className="corner corner-br panel-card" aria-label="What happened">
        <span className="card-label">
          {finished > 0 ? `Ghosts caught: ${game.caught} of ${finished}` : 'What happened'}
        </span>
        {h ? (
          <ol className="log" aria-live="polite">
            {h.log.map((entry, i) => (
              <li key={entry.id} className={i === 0 ? 'is-new' : ''}>
                <span className="log-turn">T{entry.turn}</span>
                <span>{entry.text}</span>
              </li>
            ))}
          </ol>
        ) : (
          <ol className="rules">
            <li>Everyone votes for a room on their phone.</li>
            <li>When the vote closes, the most-voted room gets the flashlight. A real measurement: caught, or that room empties and the rest grows.</li>
            <li>Then the ghost steps both ways at once, and the next vote opens. {cap(word(LIGHTS))} flashlights per ghost.</li>
          </ol>
        )}
      </section>
    </main>
  )
}
