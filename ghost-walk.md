# Ghost Walk — quantum ghost hunting game

> **The plan, written at the start of the hackathon.** Kept as a record of how the project was scoped. The game as built differs in places: 4 flashlights instead of 8 and 7 warm-up steps instead of 3 (tuned by simulation), a tutorial and fog mode were added, audience voting became an online group mode with phones and a QR code, and the noise slider, spread chart, 2-player mode and 2D mansion were not built. For the current state see the [README](README.md), [docs/how-it-works.md](docs/how-it-works.md) and [docs/real-chip.md](docs/real-chip.md).

> Working title. "Quantum Ghost Hunt" is already taken by a 2020 Aalto University student project, so we need our own name. Ideas: *Ghost Walk*, *Haunted Qubits*, *Spooky Corridor*.

Hackathon: Qiskit Fall Fest, online, Friday 23 – Sunday 25 October (48 h). Showcase: Warsaw, Monday 26 October.

---

## 1. Pitch

A ghost is hiding in a haunted corridor. You have a few flashlights to catch it. The catch: it is a **quantum ghost**. It is not in one room — it is spread across many rooms at once, moves like a wave, and its waves can cancel each other out. Every flashlight you shine is a real quantum measurement that collapses the ghost.

The player never sees a circuit or an equation. They click rooms. Qiskit is the physics engine underneath, like gravity in Angry Birds.

---

## 2. How to play

**Goal:** catch the ghost before you run out of flashlights.

**Setup**

- 16 rooms in a corridor that loops (room 16 connects back to room 1).
- The ghost starts in room 8 and takes 3 steps before the game begins, so it is already spread out.
- You get 8 flashlights.

**What you see**

A purple bar above each room = how much of the ghost is in that room = your exact chance of catching it there right now.

**One turn**

1. Look at the bars.
2. Click a room. Your flashlight shines there immediately.
3. Result:
   - **Caught** — you win. The ghost collapses to 100 % in that room.
   - **Miss** — the ghost is definitely not in that room. That bar drops to 0 % and all other bars grow, because the ghost must be somewhere else.
4. The ghost moves one step: each room's ghost spreads one room left and one room right.
5. Repeat until caught or out of flashlights.

**Why every other room is empty:** the ghost moves exactly one room per step, so it alternates between odd and even rooms (like a bishop in chess staying on one colour). Useful hint for the next turn.

### Example

Start of the game (after the 3 warm-up steps):

| Room   | 5    | 6 | 7    | 8 | 9    | 10 | 11   |
|--------|------|---|------|---|------|----|------|
| Chance | 13 % | – | 38 % | – | 38 % | –  | 13 % |

Why 4 rooms: 3 left/right steps give 2 × 2 × 2 = 8 routes. The number of right-steps decides the final room: 0 → room 5 (1 route), 1 → room 7 (3 routes), 2 → room 9 (3 routes), 3 → room 11 (1 route). So 1/8, 3/8, 3/8, 1/8.

You click room 7 (38 %) and miss. Room 7 drops to 0 %, rooms 5, 9 and 11 grow (9 becomes ~60 %). Then the ghost steps and the bars move.

---

## 3. Where the quantum part is

| Quantum idea | In the game |
|---|---|
| **Superposition** | The ghost is in many rooms at once (the fog). |
| **Measurement / collapse** | A flashlight asks "is the ghost here?". A miss removes that room from the ghost and reshapes it. |
| **Interference** | The ghost moves as waves. Waves arriving in the same room can add up or cancel. |
| **Decoherence** | On noisy hardware the waves wash out and the ghost leaks into every room, even the ones the rules say are empty (measured on a real IBM chip, section 5). |

### Quantum ghost vs classical ghost

A classical ghost flips a coin each step: left or right. Its chances simply add up, so it spreads like a drop of ink — one blob in the middle.

A quantum ghost carries a "+" or "−" sign on each route. When routes meet in the same room, + and − cancel (like a wave crest meeting a trough). For the first 3 steps both ghosts look identical. From step 4 they differ:

| Room              | 4   | 6        | 8        | 10       | 12  |
|-------------------|-----|----------|----------|----------|-----|
| Classical, step 4 | 6 % | 25 %     | **38 %** | 25 %     | 6 % |
| Quantum, step 4   | 6 % | **38 %** | **13 %** | **38 %** | 6 % |

The classical ghost is most likely back in the middle. The quantum ghost avoids the middle and splits into two groups running apart. As the game goes on, the quantum ghost spreads proportionally to the number of steps, the classical one only proportionally to its square root.

Winning means learning how quantum things move — by playing, not by reading.

---

## 4. Under the hood (Qiskit)

The ghost is a **discrete-time quantum walk** on a ring of 16 positions.

| Qubits | Role |
|---|---|
| 0–3 | Room number (4 qubits = 16 rooms) |
| 4 | Coin — decides direction (0 = left, 1 = right) |
| 5 | Flashlight sensor (ancilla) |

### Start state

Room 8 (index 7 = `0111`) with the coin in (|0⟩ + i|1⟩)/√2, which makes the walk symmetric.

```python
from qiskit import QuantumCircuit

N_ROOM = 4
COIN = N_ROOM
SENSOR = N_ROOM + 1

def start_state():
    qc = QuantumCircuit(N_ROOM + 2)
    qc.x([0, 1, 2])  # room index 7 = room 8
    qc.h(COIN)
    qc.s(COIN)       # coin = (|0> + i|1>) / sqrt(2)
    return qc
```

### One ghost step = coin flip + move

```python
def increment(n):
    qc = QuantumCircuit(n, name="+1")
    for i in reversed(range(1, n)):
        qc.mcx(list(range(i)), i)
    qc.x(0)
    return qc

def walk_step(n=N_ROOM):
    qc = QuantumCircuit(n + 2)
    room = list(range(n))
    qc.h(COIN)                                           # Hadamard coin
    inc = increment(n).to_gate()
    qc.append(inc.control(1), [COIN] + room)             # coin = 1 -> room + 1
    qc.x(COIN)
    qc.append(inc.inverse().control(1), [COIN] + room)   # coin = 0 -> room - 1
    qc.x(COIN)
    return qc
```

The increment wraps 15 → 0, which gives the looping corridor for free.

### Flashlight = real quantum measurement

The sensor qubit flips only if the ghost is in the chosen room. Measuring only the sensor answers "yes / no" without revealing where else the ghost is — exactly the game rule. On a miss, Qiskit's measurement itself collapses the ghost; no hand-written "set to zero and renormalise" code.

```python
from qiskit.quantum_info import Statevector

def flashlight(state: Statevector, room: int, n: int = N_ROOM):
    qc = QuantumCircuit(n + 2)
    zeros = [i for i in range(n) if not (room >> i) & 1]
    if zeros:
        qc.x(zeros)
    qc.mcx(list(range(n)), SENSOR)  # sensor flips only if ghost is in `room`
    if zeros:
        qc.x(zeros)
    state = state.evolve(qc)
    outcome, state = state.measure([SENSOR])
    return outcome == "1", state
```

After a miss the sensor is back in |0⟩, so it can be reused next turn.

### Game loop

```
state = Statevector(start_state())
for 3 warm-up steps: state = state.evolve(walk_step())
loop:
    show bars = state.probabilities(qargs=[0, 1, 2, 3])
    room = player click
    caught, state = flashlight(state, room)
    if caught: win
    state = state.evolve(walk_step())
```

### Classical mode (for comparison)

Same game, but the ghost is a plain random walk: `p_new[k] = (p[k-1] + p[k+1]) / 2`. A few lines of NumPy. Lets players compare directly.

---

## 5. Simulator vs real IBM quantum computer

**Gameplay runs on the simulator.** Every click must answer instantly. Real hardware cannot do that:

- Jobs wait in a shared worldwide queue — minutes to hours, unpredictable. (Our two jobs waited 1–3 s on a Friday evening; don't count on that.)
- Free Open Plan: about 10 minutes of QPU time per 28 days.
- Execution modes are job, batch and session. Sessions (dedicated QPU window) are **not available** on the Open Plan. Batch does **not** shorten the wait for the first job.
- Real hardware adds noise.

**The real chip is used for a one-shot finale**, recorded in advance with [`run_on_ibm.py`](run_on_ibm.py):

1. Build the walk for each ring size and step count, measure the room qubits.
2. Send every circuit in **one** job, 2000 shots each → only one queue wait.
3. Save the job ID straight away (proof on the IBM dashboard), fetch the results later.

```bash
python run_on_ibm.py submit --backend ibm_kingston --dry-run   # compile only, nothing sent
python run_on_ibm.py submit --backend ibm_kingston             # one job, id saved to hardware/job.json
python run_on_ibm.py fetch --wait                              # results to hardware/results.json
```

`--circuits 16:1-8 8:6-7` picks a subset, `--avoid 17 25` keeps qubits out, `--tag rerun` saves next to earlier jobs instead of over them.

### Making the circuit fit the chip

The walk step from section 4 (controlled +1, controlled −1) compiles to about 460 two-qubit gates per step on IBM Heron chips. Far too many. The hardware version in [`quantum_walk.py`](quantum_walk.py) does "everyone −1, then +2 if coin = 1". Same unitary (checked exactly), but +2 never touches the lowest room bit, so the controlled part is one qubit smaller.

| Version | Two-qubit gates per step | After 5 steps |
|---|---|---|
| 16 rooms, section 4 step | ~460 | ~2300 |
| 16 rooms, hardware step | ~62 | 315 |
| 8 rooms, hardware step | 16 | 80 |

### Real-chip results

Two jobs on **ibm_kingston** (156-qubit IBM Heron), Friday 23 October 2026:

| Job ID | Circuits | Queue | QPU time |
|---|---|---|---|
| `dbdqmq7gdj9s73fko830` | 16 and 8 rooms, 1–8 steps each | 3 s | 11 s |
| `dbdqq5nsstms73fb1c2g` (rerun) | 16 rooms 1–8, 8 rooms 6–7, on other qubits | 1 s | 8 s |

Data: `hardware/results.json` and `results_rerun.json` — every single shot, plus ideal, classical and real bars for each circuit.

"Distance" below = how much of the ghost sits in the wrong place compared with a reference (total variation distance: 0 = identical, 1 = nothing in common).

**8 rooms: the real chip shows interference.** The ghost starts in room 4. After 4 steps (rooms 2, 4, 6, 8):

| | Room 2 | Room 4 (start) | Room 6 | Room 8 |
|---|---|---|---|---|
| Quantum (ideal) | 38 % | 12 % | 38 % | 12 % |
| Classical | 25 % | 38 % | 25 % | 12 % |
| **Real chip** | **31 %** | **15 %** | **32 %** | **17 %** |

The classical ghost is most likely back at the start. The quantum ghost avoids it, and so does the real one. After 5 steps (rooms 1, 3, 5, 7): quantum 38 / 12 / 12 / 38 %, classical 19 / 31 / 31 / 19 %, real chip **32 / 15 / 11 / 34 %**.

| Step (8 rooms, first job) | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Distance from quantum ghost | 0.07 | 0.06 | 0.07 | 0.13 | **0.10** | 0.33 | 0.35 | 0.18 |
| Distance from classical ghost | 0.07 | 0.06 | 0.07 | 0.23 | **0.37** | 0.23 | 0.25 | 0.41 |

For 3 steps both ghosts are identical, so both distances are equal. From step 4 the real ghost is clearly the quantum one, except steps 6–7 (see run-to-run variance below). At step 8 interference piles the ghost into room 8, on the far side of the ring: the real chip puts 48 % there (quantum 62 %, classical 22 %).

**16 rooms: decoherence.** About 4× more two-qubit gates per step than the 8-room ring.

| Step (16 rooms, first job) | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Distance from quantum ghost | 0.20 | 0.31 | 0.43 | 0.50 | 0.53 | 0.49 | 0.43 | 0.41 |
| Distance from "evenly everywhere" | 0.68 | 0.51 | 0.39 | 0.31 | 0.28 | 0.25 | 0.25 | 0.21 |
| Ghost in rooms that must be empty | 4 % | 12 % | 15 % | 21 % | 22 % | 25 % | 25 % | 29 % |

By step 3 the real ghost is closer to "evenly spread over all 16 rooms" than to the quantum ghost.

**Noise does not make the ghost classical.** A perfect ghost, quantum or classical, is never in a room of the wrong parity (section 2). On the real chip up to 29 % of it is. Noise leaks the ghost into every room and washes it out towards "evenly everywhere", not towards the classical bell curve. Pitch line: "the ghost leaks into every room", not "the ghost turns classical".

**Run-to-run variance.** All weak circuits in the first job sat on one group of qubits (17, 25–29); qubit 25 had T2 ≈ 32 µs against 90–200 µs elsewhere. The rerun moved them to qubits with better calibration numbers (the script now also charges every qubit for dephasing, duration / T2):

| Circuit | Distance from quantum, first job | Rerun |
|---|---|---|
| 16 rooms, steps 2–6 | 0.31–0.53 | 0.26–0.44, slightly better |
| 16 rooms, steps 1 / 7 / 8 | 0.20 / 0.43 / 0.41 | 0.26 / 0.41 / 0.43, same or worse |
| 8 rooms, step 6 | 0.33 | 0.42, worse (now closest to classical: 0.17) |
| 8 rooms, step 7 | 0.35 | 0.44, worse (lopsided: 42 % in room 3) |

Lesson: same circuit, different qubits on the same chip → different ghost, and calibration numbers do not fully predict which (crosstalk, drift and systematic gate errors are not in them). A simulator using Kingston's calibration was also too optimistic: it predicted 0.20 for 16 rooms at step 4, the chip gave 0.50. If the presentation shows the best run per circuit, say so.

**Finale gameplay:** the ghost walks **5 steps on the 8-room ring** on the real chip (first job, qubits 54, 55, 59, 75). The player gets one flashlight at the end. Where the ghost actually is comes from one of the 2000 real measurements. Then the game shows "ideal ghost vs real chip ghost" side by side: at 5 steps the real ghost is 0.10 from the quantum ghost and 0.37 from the classical one, so the two running waves are clearly visible. Then the 16-room run as the decoherence demo: same chip, bigger ghost, waves gone by step 3.

At the showcase: play from saved data. A fresh job can still be submitted when the event starts (`--tag showcase`) and revealed at the end if it finished. One job costs about 10 s of QPU time; about 580 s of the 600 s allowance are left.

---

## 6. Game modes and features

| Feature | Description |
|---|---|
| Single-player hunt | The core game above. |
| Quantum / classical toggle | Same game with a classical ghost, for comparison. |
| "What happened" panel | One-line explanation after every turn, e.g. "Waves from rooms 7 and 9 cancelled in room 8". |
| Noise slider | Simulator with a real IBM chip noise profile (`AerSimulator.from_backend(FakeSherbrooke())`). More noise → the waves wash out and the ghost leaks into every room. |
| Spread chart | Live chart of how far the ghost has spread: grows with steps (quantum) vs square root of steps (classical). |
| Real chip finale | One-shot round using saved results from a real IBM QPU. |
| 2-player mode | One player is the ghost and picks the coin each turn (shapes the interference to hide), the other hunts. |
| 2D mansion | 4 × 4 grid of rooms, 2 coin qubits (4 directions). |
| Live audience round | Showcase audience votes which room to light. |

---

## 7. Judging criteria

Rubric: IBM Qiskit Fall Fest, four criteria at 25 % each.

### Originality and uniqueness

Related work exists (see section 8), so the basic idea alone is not new. What is new here:

- Flashlight as a partial measurement (yes/no) that reshapes the wave and changes future interference.
- Side-by-side quantum vs classical ghost.
- Noise slider and real-chip finale showing decoherence.
- 2-player mode where the ghost player uses interference on purpose.

### Usefulness and complexity

**Usefulness** — present it three ways:

1. A teaching tool. Quantum walks are a building block of real quantum algorithms (search and others with proven speed-ups).
2. A visual benchmark. The same ghost on different IBM chips shows which keeps it "quantum" longest.
3. A reusable Qiskit quantum-walk module others can build on.

**Complexity:**

- Walk implemented as a real circuit (controlled increment/decrement on a 4-qubit register).
- Flashlight as a projective measurement through an ancilla, not faked in code.
- Noise models from real backends.
- Real hardware run with transpilation to the chip.

### Quantum community benefit

- Open-source repo with a clean README (required anyway).
- Jupyter notebook: "Build a quantum ghost in Qiskit" — reusable in workshops and classes.
- `quantum_walk.py` module with docs and tests.
- Published real-chip data and job IDs, so results are reproducible.
- Playable in a browser with no install.
- Polish + English.

### Presentation

- 30-second hook: classical ghost vs quantum ghost side by side.
- Live audience round.
- Closing line: "This is a real IBM quantum computer losing its quantumness, live on screen."

### Rough self-estimate (1–10)

| Criterion | Basic version | Upgraded version |
|---|---|---|
| Originality and uniqueness | 4–5 | 7 |
| Usefulness and complexity | 3–4 | 7–8 |
| Quantum community benefit | 6 | 8 |
| Presentation | 6–7 | 8–9 |
| **Overall** | **~5** | **~7.5–8** |

Basic = JS-style demo only. Upgraded = must-have + should-have from section 9.

---

## 8. Prior art

| Project | What it is | Difference from ours |
|---|---|---|
| [Merry Qhristmas](https://mariaisfan.itch.io/merry-qhristmas) | Quantum walk on a grid; the walk stops and collapses when Santa is observed. Cirq, prototype. | Closest mechanic. No partial yes/no measurements reshaping the wave, no classical comparison, no hardware/noise, Cirq not Qiskit. |
| Schrödinger cat and hounds (Gordon & Gordon, *Physics Education*, 2012) | Quantum version of the board game fox and hounds: superposition, interference, measurement, entanglement. | Turn-based board game, not a measurement hunt on a quantum walk; no real hardware. |
| [Quantum Ghost Hunt](https://quantumgames.aalto.fi/game-quantum-ghost-hunt/) (Aalto, 2020) | You are a ghost escaping photons on an 8 × 8 pixel console; Qiskit for entanglement. | Same name only. Different game. |
| [Qubit the Barbarian](https://exca.itch.io/qubit-the-barbarian) | Dungeon game, press space to measure nearby qubits. | Different mechanic. |

Credit these in the presentation and state clearly what is new.

---

## 9. 48-hour scope

**Must have (day 1)**

- Qiskit walk circuit + flashlight measurement.
- 1D corridor game with bars.
- Quantum / classical toggle.
- "What happened" explanations.

**Should have (day 2)**

- Noise slider with a real backend noise model.
- Spread chart.
- Real chip finale — **done** Friday 23 October: two jobs on ibm_kingston, results saved (section 5).
- Jupyter notebook tutorial.
- README, open-source licence.

**Nice to have**

- 2D mansion.
- 2-player mode.
- Polish translation.
- Live audience voting.

### Suggested split (3–4 people)

| Person | Work |
|---|---|
| Quantum | Walk circuit, flashlight, noise model, hardware job, notebook |
| Frontend | Game screen, bars, animations, toggle, chart |
| Backend / glue | API between game and Qiskit, saved hardware data, deployment |
| Presentation | Explanations text, README, slides, demo script, rehearsal |

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| IBM queue too slow | Resolved: both jobs ran Friday 23 October after a 1–3 s queue, results saved. Showcase plays from saved data; a fresh job there is optional. |
| Hardware results are mostly noise after 3–4 steps | Make it part of the story: that is decoherence. Main gameplay stays on the simulator. |
| Players don't understand the rules | Tutorial level + "what happened" panel. Test on someone outside the team. |
| Challenge prompt at kick-off doesn't fit a game | Re-scope at kick-off; the walk module and notebook still apply. |
| Too much scope | Stick to must-have first; everything else is optional. |

---

## 11. Before Friday

1. Create a free account on [IBM Quantum Platform](https://quantum.cloud.ibm.com) and an Open Plan instance (us-east region only).
2. Get an API key and save it with `QiskitRuntimeService.save_account(...)` (see IBM docs).
3. `pip install qiskit qiskit-aer qiskit-ibm-runtime`
4. Send one tiny test job to see real queue times.
5. Check the hackathon resources channel for extra IBM access.
6. Pick the frontend stack (pygame, Streamlit, or web + FastAPI).

---

## Sources

- [IBM Quantum plans overview](https://quantum.cloud.ibm.com/docs/guides/plans-overview)
- [IBM Quantum execution modes](https://quantum.cloud.ibm.com/docs/guides/execution-modes)
- [IBM Quantum pricing](https://www.ibm.com/quantum/pricing)
- [Merry Qhristmas](https://mariaisfan.itch.io/merry-qhristmas)
- [Quantum Ghost Hunt, Aalto](https://quantumgames.aalto.fi/game-quantum-ghost-hunt/)
- [Schrödinger cat and hounds](https://cris.iucc.ac.il/en/publications/quantum-computer-games-schr%C3%B6dinger-cat-and-hounds-2/)
- [Qubit the Barbarian](https://exca.itch.io/qubit-the-barbarian)
