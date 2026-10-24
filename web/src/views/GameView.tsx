import { useEffect, useReducer, useState } from 'react'
import { Ghost } from '../components/Ghost'
import { Layer, Ring } from '../components/Ring'
import { Mode, pct, probs } from '../engine/walk'
import { Hunt, huntReducer, newHunt } from '../game/hunt'
import { LIGHTS } from '../game/rules'
import { loose, newTwin, TWINS, twinEmpty, twinLit, twinPhase, twinReducer, twinState, twinSub, twinTitle } from '../game/twin'
import { PlayOnlineButton } from '../online/PlayOnlineButton'

// 'both' puts a quantum and a coin-flipping ghost in the same rooms, hunted with one flashlight
type Choice = Mode | 'both'

const LABEL: Record<Choice, string> = { quantum: 'Quantum', classical: 'Coin-flip', both: 'Both' }

const RULES: Record<'one' | 'both', string[]> = {
  one: [
    'Bigger, brighter ghost means a better chance it is in that room.',
    'Click a room to shine a flashlight. A miss empties it and every other room grows.',
    'Then the ghost steps one room left and one room right at the same time. Its waves can cancel.',
  ],
  both: [
    'Every room holds two ghosts: blue is quantum, orange flips a coin. They start together and take the same steps.',
    'Click a room: one flashlight searches it for both. A miss empties it for both.',
    'Watch them step. The coin-flip ghost spreads into one hill; the waves of the quantum ghost cancel and add up, so it runs apart in two groups.',
  ],
}

function Lights({ lights, max }: { lights: number; max: number }) {
  return (
    <span className="lights" role="img" aria-label={`${lights} of ${max} flashlights left`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < lights ? 'is-on' : ''} />
      ))}
    </span>
  )
}

export function GameView() {
  const [mode, setMode] = useState<Choice>('quantum')
  const [fog, setFog] = useState(false)
  const [hunt, dispatch] = useReducer(huntReducer, undefined, () => newHunt('quantum', LIGHTS))
  const [twin, dispatchTwin] = useReducer(twinReducer, undefined, () => newTwin(LIGHTS))
  const both = mode === 'both'
  const act = both ? dispatchTwin : dispatch
  const phase = both ? twinPhase(twin) : hunt.phase

  useEffect(() => {
    if (phase !== 'reveal') return
    const t = setTimeout(() => act({ type: 'advance', roll: Math.random() }), 1300)
    return () => clearTimeout(t)
  }, [phase, hunt.turn, twin.nextId, both])

  const p = probs(hunt.ghost)
  const over = hunt.phase === 'won' || hunt.phase === 'lost'
  const hidden = fog && !over
  const parity = p.findIndex((v) => v > 1e-9) % 2
  const pick = (room: number) => act({ type: 'pick', room, roll: Math.random() })
  const restart = (m = mode) => {
    // the twin hunt always has one ghost of each, so it ignores the mode
    if (m === 'both') dispatchTwin({ type: 'restart', mode: 'quantum', lights: LIGHTS })
    else dispatch({ type: 'restart', mode: m, lights: LIGHTS })
  }

  const title = { aim: `Turn ${hunt.turn}`, reveal: 'Empty', won: 'Caught', lost: 'Escaped' }[hunt.phase]
  const sub = {
    aim: parity >= 0 ? `Only ${parity === 0 ? 'odd' : 'even'} rooms can hold it now` : '',
    reveal: 'The ghost is moving',
    won: `Room ${(hunt.found ?? 0) + 1}, turn ${hunt.turn}`,
    lost: `It was in room ${(hunt.found ?? 0) + 1}`,
  }[hunt.phase]
  const log = both ? twin.log : hunt.log

  // a caught or escaped ghost shows where it was, even in fog
  const layer = (h: Hunt): Layer => ({
    probs: probs(h.ghost),
    tone: h.ghost.mode,
    hidden: fog && loose(h),
    moved: h.moved,
    found: loose(h) ? null : h.found,
  })
  const [q, c] = [layer(twin.quantum), layer(twin.classical)]

  return (
    <main className="game">
      <div className="corner corner-tl">
        <a href="#/" className="wordmark">
          <Ghost tone="quantum" className="wordmark-ghost" />
          Ghost Walk
        </a>
        <span className="corner-actions">
          <a className="pill pill-small hide-narrow" href="#/docs">
            Docs
          </a>
          <PlayOnlineButton mode={both ? undefined : mode} />
        </span>
      </div>

      <div className="corner corner-tr">
        <section className="panel-card" aria-label="Ghost settings">
          <span className="card-label">Ghost</span>
          <div className="tabs" role="tablist" aria-label="Ghost type">
            {(['quantum', 'classical', 'both'] as const).map((m) => (
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
                {m === 'both' ? (
                  <span className="tab-pair">
                    <Ghost tone="quantum" className="tab-ghost" />
                    <Ghost tone="classical" className="tab-ghost" />
                  </span>
                ) : (
                  <Ghost tone={m} className="tab-ghost" />
                )}
                {LABEL[m]}
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
        {both ? (
          <Ring
            {...q}
            pair={c}
            lit={twinLit(twin)}
            empty={twinEmpty(twin)}
            disabled={phase !== 'aim'}
            onPick={pick}
            roomLabel={(k) =>
              q.hidden || c.hidden
                ? `Search room ${k + 1}`
                : `Search room ${k + 1}: quantum ghost ${pct(q.probs[k])}, coin-flip ghost ${pct(c.probs[k])}`
            }
          >
            <p className="centre-title">{twinTitle(twin)}</p>
            <p className="centre-sub">{twinSub(twin)}</p>
            <span className="pair-key">
              {TWINS.map((m) => (
                <span key={m} className={`pair-key-${m}`}>
                  <Ghost tone={m} className="tab-ghost" />
                  {LABEL[m]}
                  {twinState(twin[m]) && <em>{twinState(twin[m])}</em>}
                </span>
              ))}
            </span>
            <Lights lights={Math.min(twin.quantum.lights, twin.classical.lights)} max={twin.quantum.maxLights} />
            {phase === 'over' && (
              <button type="button" className="pill pill-light" onClick={() => restart()}>
                Hunt again
              </button>
            )}
          </Ring>
        ) : (
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
            <Lights lights={hunt.lights} max={hunt.maxLights} />
            {over && (
              <button type="button" className="pill pill-light" onClick={() => restart()}>
                Hunt again
              </button>
            )}
          </Ring>
        )}
      </section>

      <details className="corner corner-bl panel-card" open>
        <summary>How to play</summary>
        <ol className="rules">
          {RULES[both ? 'both' : 'one'].map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
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
          {log.slice(0, 3).map((entry, i) => (
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
