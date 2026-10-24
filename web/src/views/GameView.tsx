import { useEffect, useReducer, useState } from 'react'
import { Ghost } from '../components/Ghost'
import { Ring } from '../components/Ring'
import { Mode, pct, probs } from '../engine/walk'
import { huntReducer, newHunt } from '../game/hunt'
import { LIGHTS } from '../game/rules'
import { PlayOnlineButton } from '../online/PlayOnlineButton'

export function GameView() {
  const [mode, setMode] = useState<Mode>('quantum')
  const [fog, setFog] = useState(false)
  const [hunt, dispatch] = useReducer(huntReducer, undefined, () => newHunt('quantum', LIGHTS))

  useEffect(() => {
    if (hunt.phase !== 'reveal') return
    const t = setTimeout(() => dispatch({ type: 'advance', roll: Math.random() }), 1300)
    return () => clearTimeout(t)
  }, [hunt.phase, hunt.turn])

  const p = probs(hunt.ghost)
  const over = hunt.phase === 'won' || hunt.phase === 'lost'
  const hidden = fog && !over
  const parity = p.findIndex((v) => v > 1e-9) % 2
  const pick = (room: number) => dispatch({ type: 'pick', room, roll: Math.random() })
  const restart = (m = mode) => dispatch({ type: 'restart', mode: m, lights: LIGHTS })

  const title = { aim: `Turn ${hunt.turn}`, reveal: 'Empty', won: 'Caught', lost: 'Escaped' }[hunt.phase]
  const sub = {
    aim: parity >= 0 ? `Only ${parity === 0 ? 'odd' : 'even'} rooms can hold it now` : '',
    reveal: 'The ghost is moving',
    won: `Room ${(hunt.found ?? 0) + 1}, turn ${hunt.turn}`,
    lost: `It was in room ${(hunt.found ?? 0) + 1}`,
  }[hunt.phase]

  return (
    <main className="game">
      <div className="corner corner-tl">
        <a href="#/" className="wordmark">
          <Ghost tone="quantum" className="wordmark-ghost" />
          Ghost Walk
        </a>
        <span className="corner-actions">
          {/* on a narrow screen the button joins this row instead of sitting above the settings */}
          <span className="only-stacked">
            <PlayOnlineButton mode={mode} />
          </span>
          <a className="pill pill-small hide-narrow" href="#/docs">
            Docs
          </a>
        </span>
      </div>

      <div className="corner corner-tr corner-stack">
        <span className="only-wide">
          <PlayOnlineButton mode={mode} />
        </span>
        <section className="panel-card" aria-label="Ghost settings">
          <span className="card-label">Ghost</span>
          <div className="tabs" role="tablist" aria-label="Ghost type">
            {(['quantum', 'classical'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                className={mode === m ? 'is-on' : ''}
                onClick={() => {
                  setMode(m)
                  restart(m)
                }}
              >
                <Ghost tone={m} className="tab-ghost" />
                {m === 'quantum' ? 'Quantum' : 'Coin-flip'}
              </button>
            ))}
          </div>
          <label className="switch">
            <input type="checkbox" checked={fog} onChange={(e) => setFog(e.target.checked)} />
            <span className="switch-track" aria-hidden="true" />
            Fog: hide the chances
          </label>
        </section>
      </div>

      <section className="game-stage" aria-label="The haunted corridor">
        <Ring
          probs={p}
          tone={mode}
          hidden={hidden}
          lit={hunt.phase === 'reveal' || hunt.phase === 'won' ? hunt.lit : null}
          empty={hunt.empty}
          found={over ? hunt.found : null}
          disabled={hunt.phase !== 'aim'}
          moved={hunt.moved}
          onPick={pick}
          roomLabel={(k, v) => (hidden ? `Search room ${k + 1}` : `Search room ${k + 1}, ${pct(v)} chance`)}
        >
          <p className="centre-title">{title}</p>
          {sub && <p className="centre-sub">{sub}</p>}
          <span className="lights" role="img" aria-label={`${hunt.lights} of ${hunt.maxLights} flashlights left`}>
            {Array.from({ length: hunt.maxLights }, (_, i) => (
              <span key={i} className={i < hunt.lights ? 'is-on' : ''} />
            ))}
          </span>
          {over && (
            <button type="button" className="pill pill-light" onClick={() => restart()}>
              Hunt again
            </button>
          )}
        </Ring>
      </section>

      <details className="corner corner-bl panel-card" open>
        <summary>How to play</summary>
        <ol className="rules">
          <li>Bigger, brighter ghost means a better chance it is in that room.</li>
          <li>Click a room to shine a flashlight. A miss empties it and every other room grows.</li>
          <li>Then the ghost steps one room left and one room right at the same time. Its waves can cancel.</li>
        </ol>
        <span className="card-links">
          <a href="#/tutorial" className="text-link">
            Take the tutorial
          </a>
          <a href="#/docs" className="text-link">
            Read the docs
          </a>
        </span>
      </details>

      <section className="corner corner-br panel-card" aria-label="What happened">
        <span className="card-label">What happened</span>
        <ol className="log" aria-live="polite">
          {hunt.log.slice(0, 3).map((entry, i) => (
            <li key={entry.id} className={i === 0 ? 'is-new' : ''}>
              <span className="log-turn">T{entry.turn}</span>
              <span>{entry.text}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
