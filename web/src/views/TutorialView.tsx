import { useState } from 'react'
import { Ghost } from '../components/Ghost'
import { Ring } from '../components/Ring'
import { StepArrows } from '../components/StepArrows'
import { Ghost as Walker, Mode, newGhost, pct, probs, project } from '../engine/walk'

// A guided walk-through: the ghost starts alone in room 1 and the player
// watches it split left and right, step by step, until the waves cancel.

const ROOMS = 16
const at = (steps: number, mode: Mode = 'quantum') => newGhost(mode, ROOMS, steps, 0)

interface Step {
  title: string
  body: string
  walk: number
  arrows?: boolean
  compare?: boolean
  flashlight?: boolean
}

const STEPS: Step[] = [
  {
    title: 'Meet the ghost',
    body: 'The ghost starts in room 1. Right now there is a 100% chance it is there. Rooms with a dashed outline cannot hold it.',
    walk: 0,
  },
  {
    title: 'Left and right at once',
    body: 'Each step the ghost moves one room left and one room right at the same time. The corridor loops, so left of room 1 is room 16. Now it is 50% in room 16 and 50% in room 2.',
    walk: 1,
    arrows: true,
  },
  {
    title: 'Count the routes',
    body: 'From room 16 it can go to 15 or 1. From room 2, to 1 or 3. Two routes lead back to room 1 and one to each of the others, so the chances are 25%, 50% and 25%.',
    walk: 2,
    arrows: true,
  },
  {
    title: 'Three steps',
    body: 'Eight routes now. 1, 3, 3 and 1 of them end in rooms 14, 16, 2 and 4: 13%, 38%, 38%, 13%. A coin-flipping ghost would look exactly the same so far.',
    walk: 3,
    arrows: true,
  },
  {
    title: 'Step four: waves cancel',
    body: 'Every route carries a plus or minus sign. In room 1 the signs cancel, so the quantum ghost has only 13% there, where a coin-flipping ghost would have 38%. The quantum ghost splits into two groups running apart.',
    walk: 4,
    arrows: true,
    compare: true,
  },
  {
    title: 'Shine a flashlight',
    body: 'Click any room with a ghost. If the ghost is not there, that room empties and every other room grows, because the ghost must be somewhere else.',
    walk: 4,
    flashlight: true,
  },
  {
    title: 'Ready to hunt',
    body: 'In the real hunt the ghost starts in room 8 and has already taken three steps. You get four flashlights. After every miss it takes another step.',
    walk: 4,
  },
]

interface Shot {
  room: number
  chance: number
  caught: boolean
  after: Walker
}

export function TutorialView() {
  const [index, setIndex] = useState(0)
  const [compare, setCompare] = useState(false)
  const [shot, setShot] = useState<Shot | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const step = STEPS[index]
  const last = index === STEPS.length - 1

  const ghost = at(step.walk)
  const showClassical = step.compare && compare
  const shown = step.flashlight && shot ? probs(shot.after) : probs(showClassical ? at(step.walk, 'classical') : ghost)
  const tone: Mode = showClassical ? 'classical' : 'quantum'

  const go = (to: number) => {
    setIndex(to)
    setCompare(false)
    setShot(null)
    setHint(null)
  }

  const shine = (room: number) => {
    const p = probs(ghost)
    if (p[room] < 1e-9) {
      setHint(`Room ${room + 1} has a dashed outline: the ghost cannot be there. Try a room with a ghost.`)
      return
    }
    const caught = Math.random() < p[room]
    setHint(null)
    setShot({ room, chance: p[room], caught, after: project(ghost, (k) => (caught ? k === room : k !== room)) })
  }

  let result: string | null = null
  if (shot) {
    const after = probs(shot.after)
    const best = after.indexOf(Math.max(...after))
    result = shot.caught
      ? `Caught! Room ${shot.room + 1} had a ${pct(shot.chance)} chance. In the real hunt that would win the game.`
      : `Room ${shot.room + 1} was empty. Its ${pct(shot.chance)} moved into the other rooms: room ${best + 1} is now ${pct(after[best])}.`
  }

  const centre = step.flashlight ? 'Your turn' : step.walk === 0 ? 'Start' : `${step.walk} step${step.walk > 1 ? 's' : ''}`

  return (
    <main className="game tutorial">
      <div className="corner corner-tl">
        <a href="#/" className="wordmark">
          <Ghost tone="quantum" className="wordmark-ghost" />
          Ghost Walk
        </a>
        <a className="pill pill-small" href="#/play">
          Skip tutorial
        </a>
      </div>

      <section className="game-stage" aria-label="Tutorial corridor">
        <Ring
          probs={shown}
          tone={tone}
          lit={shot ? shot.room : null}
          empty={shot && !shot.caught ? shot.room : null}
          found={shot?.caught ? shot.room : null}
          disabled={!step.flashlight || shot != null}
          onPick={shine}
          roomLabel={(k, v) => `Room ${k + 1}, ${pct(v)} chance`}
          moved={step.arrows && !showClassical ? { id: index, from: probs(at(step.walk - 1)) } : null}
          overlay={step.arrows && !showClassical ? <StepArrows key={index} from={probs(at(step.walk - 1))} /> : null}
        >
          <p className="centre-title">{centre}</p>
          {showClassical && <p className="centre-sub">Coin-flipping ghost</p>}
        </Ring>
      </section>

      <section className="panel-card tut-card" aria-live="polite" aria-labelledby="tut-title">
        <div className="tut-progress">
          <span className="card-label">
            Tutorial {index + 1} of {STEPS.length}
          </span>
          <span className="tut-dots" aria-hidden="true">
            {STEPS.map((_, i) => (
              <span key={i} className={i <= index ? 'is-on' : ''} />
            ))}
          </span>
        </div>
        <h2 id="tut-title" className="tut-title">
          {step.title}
        </h2>
        <p className="tut-body">{step.body}</p>

        {step.compare && (
          <button type="button" className="pill pill-small" onClick={() => setCompare(!compare)}>
            {compare ? 'Back to the quantum ghost' : 'Compare with a coin-flipping ghost'}
          </button>
        )}
        {hint && <p className="tut-note">{hint}</p>}
        {result && <p className="tut-note is-result">{result}</p>}

        <div className="tut-nav">
          {index > 0 ? (
            <button type="button" className="text-button" onClick={() => go(index - 1)}>
              Back
            </button>
          ) : (
            <span />
          )}
          {last ? (
            <a className="btn-plain" href="#/play">
              Start hunting
            </a>
          ) : (
            <button type="button" className="btn-plain" onClick={() => go(index + 1)}>
              Next
            </button>
          )}
        </div>
      </section>
    </main>
  )
}
