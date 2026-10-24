import { useEffect, useLayoutEffect, useState } from 'react'
import { Corridor } from '../components/Corridor'
import { Ghost } from '../components/Ghost'
import { newGhost, probs } from '../engine/walk'
import { cap, LIGHTS, WARMUP, word } from '../game/rules'
import { ChipView } from './ChipView'

const quantum4 = probs(newGhost('quantum', 16, 4))
const classical4 = probs(newGhost('classical', 16, 4))

const IDEAS = [
  ['Superposition', 'The ghost is not in one room. Part of it is in each room the bars show, all at once.'],
  ['Measurement', 'A flashlight asks one question: is the ghost here? A miss removes that part of the ghost and the rest grows to fill the gap.'],
  ['Interference', 'Each route the ghost can take carries a plus or minus sign. Where routes meet, opposite signs cancel, like a wave crest meeting a trough.'],
  ['Decoherence', 'On a real chip, noise slowly wipes out those signs. The ghost leaks into rooms a perfect ghost can never reach.'],
] as const

function useReveal() {
  useLayoutEffect(() => {
    const blocks = document.querySelectorAll<HTMLElement>('.docs-intro, .docs-section > *')
    if (!('IntersectionObserver' in window)) return
    blocks.forEach((b) => b.classList.add('reveal'))
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          e.target.classList.add('is-in')
          io.unobserve(e.target)
        }),
      { rootMargin: '0px 0px -8% 0px' },
    )
    blocks.forEach((b) => io.observe(b))
    return () => io.disconnect()
  }, [])
}

const SECTIONS = [
  { id: 'how', label: 'How to play' },
  { id: 'quantum', label: 'Why it is quantum' },
  { id: 'circuit', label: 'The circuit' },
  { id: 'real-chip', label: 'Real chip' },
]

function useActiveSection() {
  const [active, setActive] = useState(SECTIONS[0].id)
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-35% 0px -60% 0px' },
    )
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) io.observe(el)
    })
    return () => io.disconnect()
  }, [])
  return active
}

export function DocsView() {
  useReveal()
  const active = useActiveSection()
  return (
    <main className="docs">
      <a href="#/" className="wordmark docs-corner docs-corner-tl">
        <Ghost tone="quantum" className="wordmark-ghost" />
        Ghost Walk
      </a>
      <a className="btn-plain docs-corner docs-corner-tr" href="#/play">
        Play
      </a>

      <nav className="docs-toc" aria-label="Sections">
        <ol>
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} aria-current={active === s.id ? 'location' : undefined}>
                {s.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="docs-body">
        <section className="docs-intro">
          <h1>Ghost Walk docs</h1>
          <p className="lede">
            A ghost hides in a corridor of sixteen rooms that loops back on itself. It is a quantum ghost: spread over many rooms at once, moving
            like a wave. Every flashlight you shine is a real measurement. Under the game is a Qiskit circuit, and the same circuit ran on an IBM
            quantum computer.
          </p>
        </section>

        <section id="how" className="docs-section" aria-labelledby="how-title">
          <h2 id="how-title" className="docs-h">
            How to play
          </h2>
          <ol className="steps">
            <li>
              <b>Read the ghosts.</b> The ghost started in room 8 and has already taken {word(WARMUP)} steps. In each room, the bigger and brighter the
              ghost, the better your chance of catching it there. The number next to a room is that exact chance.
            </li>
            <li>
              <b>Search a room.</b> Click it to shine a flashlight. If the ghost is there, you win. If not, that room empties and the other rooms
              grow, because the ghost must be somewhere else.
            </li>
            <li>
              <b>Watch it move.</b> The ghost steps one room left and one room right at the same time. It moves one room per step, so it is only
              ever in odd rooms or only in even rooms.
            </li>
            <li>
              <b>{cap(word(LIGHTS))} flashlights.</b> Run out and the ghost escapes. Fog mode hides the chances, so you have to predict where the waves went.
            </li>
            <li>
              <b>Play online.</b> The Play online button turns the hunt into a room vote: the big screen shows a QR code and a four-digit code,
              everyone joins on their phone and votes for the room to search, and the most-voted room gets the flashlight. The ghost lives on the
              server, so every screen sees the same one.
            </li>
          </ol>
        </section>

        <section id="quantum" className="docs-section" aria-labelledby="quantum-title">
          <h2 id="quantum-title" className="docs-h">
            Why the ghost is quantum
          </h2>
          <dl className="ideas">
            {IDEAS.map(([term, text]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{text}</dd>
              </div>
            ))}
          </dl>

          <h3 className="docs-h3">Quantum ghost against a coin-flipping ghost, after four steps</h3>
          <p className="muted">
            For three steps both ghosts look the same. From step four, the coin-flipping ghost is most likely back in the middle; the quantum ghost
            avoids the middle and splits into two groups running apart. Over time it spreads in proportion to the number of steps, the
            coin-flipping ghost only to its square root.
          </p>
          <div className="compare">
            <figure>
              <figcaption>
                <span className="swatch" style={{ background: 'var(--quantum)' }} />
                Quantum ghost
              </figcaption>
              <Corridor probs={quantum4} ink="var(--quantum)" disabled />
            </figure>
            <figure>
              <figcaption>
                <span className="swatch" style={{ background: 'var(--classical)' }} />
                Coin-flipping ghost
              </figcaption>
              <Corridor probs={classical4} ink="var(--classical)" disabled />
            </figure>
          </div>
        </section>

        <section id="circuit" className="docs-section" aria-labelledby="circuit-title">
          <h2 id="circuit-title" className="docs-h">
            The circuit
          </h2>
          <p className="muted lede">
            The ghost is a discrete-time quantum walk on a ring. Four qubits hold the room number, one qubit is the coin that decides the
            direction, and the flashlight uses one more qubit as a sensor.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Qubits</th>
                  <th scope="col">Role</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">0 to 3</th>
                  <td>Room number, 16 rooms</td>
                </tr>
                <tr>
                  <th scope="row">4</th>
                  <td>Coin: 0 steps left, 1 steps right</td>
                </tr>
                <tr>
                  <th scope="row">5</th>
                  <td>Flashlight sensor: flips only if the ghost is in the searched room</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="muted">
            One step is a Hadamard on the coin, then a shift. The shift is written as "everyone moves left, then moves two right if the coin is
            1". It is the same operation as the textbook version but needs about 62 two-qubit gates per step on an IBM chip instead of about 460,
            which is what made the real-chip run possible. The code is in <code>quantum_walk.py</code> and <code>run_on_ibm.py</code>.
          </p>
        </section>

        <ChipView />

        <footer className="footer">
          <span>Ghost Walk. A discrete-time quantum walk with a Hadamard coin, built with Qiskit.</span>
          <span>Qiskit Fall Fest, October 2026</span>
        </footer>
      </div>
    </main>
  )
}
