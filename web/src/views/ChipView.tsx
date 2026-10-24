import { useState } from 'react'
import { LeakChart } from '../components/LeakChart'
import { Ring } from '../components/Ring'
import { StepChart } from '../components/StepChart'
import { chip, circuit, series } from '../data/chip'
import { pct, sampleRoom } from '../engine/walk'

const FINALE_STEPS = 5

const NOTES = [
  'One step: half the ghost in room 3, half in room 5. The quantum and the coin-flipping ghost look the same, and the chip matches both.',
  'Still the same for both ghosts. The chip matches.',
  'Still the same: 1/8, 3/8, 3/8, 1/8. The two ghosts part ways at the next step.',
  'The chip follows the quantum ghost. Two waves run apart and the start room stays low, where a coin-flipping ghost would most likely be.',
  'Same at step 5. Rooms 1 and 7 hold most of the ghost, as the quantum ghost predicts, not rooms 3 and 5.',
  'This circuit ran on weaker qubits and the waves are mostly washed out. A rerun on other qubits did not fix it.',
  'Also on the weaker qubits: lopsided and washed out. Same circuit, different qubits, different ghost.',
  'Interference piles the ghost into room 8, on the far side of the ring. 48% on the chip, 62% ideal, 22% for a coin-flipping ghost.',
]

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

const seconds = (a: string | null, b: string | null) =>
  a && b ? Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 1000)) : null

export function ChipView() {
  const run = chip.first
  const finale = circuit(run, 8, FINALE_STEPS)!
  const [picked, setPicked] = useState<number | null>(null)
  const [shot, setShot] = useState<number | null>(null)
  const [step, setStep] = useState(FINALE_STEPS)
  const current = circuit(run, 8, step)!
  const done = shot != null && picked != null
  const total = finale.counts.reduce((a, b) => a + b, 0)
  const queue = seconds(run.created, run.running)

  const pick = (room: number) => {
    setPicked(room)
    setShot(sampleRoom(finale.counts.map((c) => c / total), Math.random()))
  }

  const rerunRows = [
    { label: '16 rooms, step 3', rooms: 16, steps: 3 },
    { label: '16 rooms, step 5', rooms: 16, steps: 5 },
    { label: '8 rooms, step 6', rooms: 8, steps: 6 },
    { label: '8 rooms, step 7', rooms: 8, steps: 7 },
  ].map((r) => ({ ...r, first: circuit(run, r.rooms, r.steps), again: circuit(chip.rerun, r.rooms, r.steps) }))

  return (
    <section id="real-chip" className="docs-section" aria-labelledby="chip-title">
      <div className="hero">
        <h2 id="chip-title" className="docs-h">
          The same ghost, on a real quantum computer
        </h2>
        <div className="hero-side">
          <p>
            This ghost walked {FINALE_STEPS} steps around an 8-room ring on {run.backend}, an IBM quantum computer. Where it is comes from
            one of the {total.toLocaleString('en-GB')} measurements the chip sent back. You get one flashlight.
          </p>
          <ul className="chips" aria-label="Run details">
            <li>Job {run.jobId}</li>
            <li>{fmtDate(run.created)}</li>
            {queue != null && <li>Queue {queue} s</li>}
            {run.qpuSeconds != null && <li>QPU {run.qpuSeconds} s</li>}
            <li>Qubits {finale.qubits.join(', ')}</li>
          </ul>
        </div>
      </div>

      <section className="board" aria-label="One flashlight">
        <div className="board-ring">
          <Ring
            probs={finale.real}
            tone="chip"
            hidden={!done}
            lit={picked}
            found={done ? shot : null}
            disabled={done}
            onPick={pick}
            roomLabel={(k, v) => (done ? `Room ${k + 1}, ${pct(v)} of the real ghost` : `Search room ${k + 1}`)}
          >
            <p className="centre-title">{done ? (shot === picked ? 'Caught' : 'Missed') : `${FINALE_STEPS} steps`}</p>
            <p className="centre-sub">{done ? `The chip put it in room ${shot + 1}` : 'It started in room 4'}</p>
          </Ring>
        </div>

        <div className="board-side result">
          {!done ? (
            <>
              <h2>Where did the chip leave it?</h2>
              <p className="muted">
                After {FINALE_STEPS} steps the ideal quantum ghost sits mostly in rooms 1 and 7, 38% each. A coin-flipping ghost would sit
                mostly in rooms 3 and 5, 31% each. The real chip adds noise. Pick a room on the ring.
              </p>
            </>
          ) : (
            <>
              <h2>{shot === picked ? 'Caught on a real quantum computer' : 'Missed'}</h2>
              <p aria-live="polite">
                You searched room {picked + 1}. The measurement put the ghost in room {shot + 1}. On the chip, room {picked + 1} held{' '}
                {pct(finale.real[picked])} of the ghost; the ideal quantum ghost has {pct(finale.ideal[picked])} there.
              </p>
              <p className="muted">
                Rooms 1 and 7 hold {pct(finale.real[0] + finale.real[6])} of the real ghost: two waves that ran apart from the start, like
                the ideal quantum ghost. Rooms 3 and 5, where a coin-flipping ghost would gather, stay low.
              </p>
              <button
                type="button"
                className="pill pill-dark"
                onClick={() => {
                  setPicked(null)
                  setShot(null)
                }}
              >
                Draw another measurement
              </button>
            </>
          )}
        </div>
      </section>

      <section className="section" aria-labelledby="steps-title">
        <div className="section-head">
          <h2 id="steps-title">Step through the real run</h2>
          <div className="tabs tabs-compact" role="tablist" aria-label="Number of steps">
            {series(run, 8).map((c) => (
              <button
                key={c.steps}
                type="button"
                role="tab"
                aria-selected={step === c.steps}
                aria-label={`${c.steps} step${c.steps > 1 ? 's' : ''}`}
                className={step === c.steps ? 'is-on' : ''}
                onClick={() => setStep(c.steps)}
              >
                {c.steps}
              </button>
            ))}
          </div>
        </div>
        <div className="facts">
          <p className="fact">
            <span className="fact-num">{current.distQuantum.toFixed(2)}</span>
            <span className="fact-label">from the quantum ghost</span>
          </p>
          <p className="fact">
            <span className="fact-num">{current.distClassical.toFixed(2)}</span>
            <span className="fact-label">from the coin-flipping ghost</span>
          </p>
          <p className="fact-note">{NOTES[step - 1]}</p>
        </div>
        <div className="panel">
          <StepChart c={current} />
        </div>
        <p className="muted small">
          Distance is the share of the ghost you would have to move to turn one picture into the other: 0 means identical, 1 means nothing in
          common. 2000 measurements per step.
        </p>
      </section>

      <section className="section" aria-labelledby="noise-title">
        <div className="section-head">
          <h2 id="noise-title">Noise leaks the ghost into rooms it can never be in</h2>
        </div>
        <p className="muted lede">
          The ghost moves one room per step, so it can only be in every other room. A perfect ghost, quantum or coin-flipping, is never in the
          others. The bars show how much of the real ghost ended up there anyway. The 16-room ghost needs about four times more gates per
          step, and by step 3 it is closer to evenly spread than to the quantum ghost.
        </p>
        <div className="panel">
          <LeakChart
            rows={[
              { title: '8 rooms', detail: `${circuit(run, 8, 1)?.twoQubitGates ?? 16} two-qubit gates per step`, values: series(run, 8).map((c) => c.leak) },
              { title: '16 rooms', detail: `about ${circuit(run, 16, 1)?.twoQubitGates ?? 60} two-qubit gates per step`, values: series(run, 16).map((c) => c.leak) },
            ]}
          />
        </div>
      </section>

      {chip.rerun && (
        <section className="section" aria-labelledby="rerun-title">
          <div className="section-head">
            <h2 id="rerun-title">Same circuit, other qubits</h2>
          </div>
          <p className="muted lede">
            The weak circuits all ran on one group of qubits, one of which loses its quantum state fast. A second job moved them to qubits that
            looked better on paper. Distance from the quantum ghost, lower is better:
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Circuit</th>
                  <th scope="col">First job</th>
                  <th scope="col">Rerun</th>
                </tr>
              </thead>
              <tbody>
                {rerunRows.map((r) => (
                  <tr key={r.label}>
                    <th scope="row">{r.label}</th>
                    <td>{r.first?.distQuantum.toFixed(2) ?? 'n/a'}</td>
                    <td>{r.again?.distQuantum.toFixed(2) ?? 'n/a'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">Rerun job {chip.rerun.jobId}. Calibration numbers do not fully predict which qubits keep the ghost quantum.</p>
        </section>
      )}
    </section>
  )
}
