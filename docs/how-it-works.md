# How Ghost Walk works

The ghost is a **discrete-time quantum walk with a Hadamard coin** on a ring of rooms. This page goes from the state of the ghost to the circuits that ran on IBM hardware and the code that runs the game. The [tutorial notebook](../ghost_walk_tutorial.ipynb) runs every claim here.

Contents

1. [The ghost's state](#1-the-ghosts-state)
2. [One step: coin, then shift](#2-one-step-coin-then-shift)
3. [Why the quantum ghost is different](#3-why-the-quantum-ghost-is-different)
4. [The flashlight is a measurement](#4-the-flashlight-is-a-measurement)
5. [Making the step fit on a real chip](#5-making-the-step-fit-on-a-real-chip)
6. [Why the game runs in the browser](#6-why-the-game-runs-in-the-browser)
7. [The game loop](#7-the-game-loop)
8. [Where things are in the code](#8-where-things-are-in-the-code)

---

## 1. The ghost's state

| Qubits | Role |
|---|---|
| 0 … n−1 | Room index, least significant bit first. n = 4 for 16 rooms, n = 3 for 8 rooms. Index k is room k + 1 in the game. |
| n | Coin: 0 = step left, 1 = step right |
| n + 1 | Flashlight sensor (only in the flashlight circuit, section 4) |

The ghost is the state

|ψ⟩ = Σ<sub>k</sub> Σ<sub>c</sub> a<sub>k,c</sub> |k⟩|c⟩

with one complex amplitude per room k and coin value c. The bar or ghost size the player sees above room k is

P(k) = |a<sub>k,0</sub>|² + |a<sub>k,1</sub>|²

which is exactly the chance that a flashlight in room k catches the ghost.

**Start state.** Room index 2<sup>n−1</sup> − 1 (room 8 of 16, room 4 of 8) with the coin in (|0⟩ + i|1⟩)/√2:

```python
def start_state(n_room=4):
    qc = QuantumCircuit(n_room + 1, name="start")
    qc.x(range(n_room - 1))  # index 0111 = 7 for 4 room qubits
    qc.h(n_room)
    qc.s(n_room)             # coin = (|0> + i|1>) / sqrt(2)
    return qc
```

A Hadamard walk started with the coin in |0⟩ or |1⟩ drifts to one side. With the extra phase i the left-moving and right-moving parts never interfere with each other, so the ghost stays symmetric around its start (the mean position stays exactly 0, checked up to 30 steps in the notebook).

## 2. One step: coin, then shift

One step is U = S · (H on the coin).

- **Coin:** H|0⟩ = (|0⟩ + |1⟩)/√2, H|1⟩ = (|0⟩ − |1⟩)/√2.
- **Shift:** |k, 0⟩ → |k − 1, 0⟩ and |k, 1⟩ → |k + 1, 1⟩, modulo the number of rooms.

The ring comes for free: a binary adder on n qubits wraps from 2<sup>n</sup> − 1 back to 0.

Written out per amplitude, which is exactly what the browser engine does:

a′<sub>k−1,0</sub> += (a<sub>k,0</sub> + a<sub>k,1</sub>) / √2
a′<sub>k+1,1</sub> += (a<sub>k,0</sub> − a<sub>k,1</sub>) / √2

The minus sign in the second line is where all interference comes from.

## 3. Why the quantum ghost is different

**Routes and signs.** After t steps the ghost has taken 2<sup>t</sup> routes. A coin-flipping ghost adds up the chances of the routes that end in a room. The quantum ghost adds up their amplitudes, and each route carries a sign from the Hadamard's minus. Opposite signs cancel.

For three steps the two ghosts are identical: ½ ½, then ¼ ½ ¼, then ⅛ ⅜ ⅜ ⅛. At step four the routes back to the start cancel:

| Room (16-room ring, start in room 8) | 4 | 6 | 8 | 10 | 12 |
|---|---|---|---|---|---|
| Coin-flipping ghost, step 4 | 6 % | 25 % | **38 %** | 25 % | 6 % |
| Quantum ghost, step 4 | 6 % | **38 %** | 13 % | **38 %** | 6 % |

The quantum ghost avoids the middle and splits into two groups running apart.

**Spread.** On a ring large enough not to wrap, the standard deviation of the quantum ghost grows linearly, σ ≈ 0.54 t (theory: √(1 − 1/√2) t). The coin-flipping ghost grows as √t. After 30 steps that is 16.3 rooms against 5.5.

**Parity.** The ghost moves exactly one room per step, so after t steps only rooms whose index has the parity of (start + t) can hold it. The game tells the player ("Only odd rooms can hold it now") and draws the impossible rooms dashed. On real hardware this rule breaks, which gives a clean noise measure: the share of the ghost in rooms that must be empty ([real-chip.md](real-chip.md)).

## 4. The flashlight is a measurement

A flashlight in room r asks a single yes/no question. That is a two-outcome projective measurement with projector

P<sub>r</sub> = |r⟩⟨r| ⊗ I<sub>coin</sub>

- **Caught**, with probability ⟨ψ|P<sub>r</sub>|ψ⟩ = P(r). The state becomes P<sub>r</sub>|ψ⟩ / ‖P<sub>r</sub>|ψ⟩‖: the ghost is in room r. The player wins.
- **Miss**, with probability 1 − P(r). The state becomes (I − P<sub>r</sub>)|ψ⟩ / ‖…‖: both amplitudes of room r are zeroed and every other amplitude is scaled by 1/√(1 − P(r)).

The probabilities after a miss look like a classical Bayesian update. The difference is what happens next: the remaining amplitudes keep their signs and phases, so the next step interferes differently from a ghost nobody looked at. The notebook shows the two diverge after one step.

**As a circuit.** A sensor qubit flips only if the ghost is in room r. Measuring only the sensor answers yes or no and reveals nothing else about the ghost:

```python
def flashlight_circuit(room, n_room=4):
    sensor = n_room + 1
    qc = QuantumCircuit(n_room + 2)
    zeros = [i for i in range(n_room) if not (room >> i) & 1]
    if zeros:
        qc.x(zeros)
    qc.mcx(list(range(n_room)), sensor)  # sensor flips only if the ghost is in `room`
    if zeros:
        qc.x(zeros)
    return qc

state = state.evolve(flashlight_circuit(room))
outcome, state = state.measure([n_room + 1])   # "1" = caught
```

After a miss the sensor is back in |0⟩ and can be reused next turn. The notebook checks that this circuit plus Qiskit's measurement gives exactly the state (I − P<sub>r</sub>)|ψ⟩ / ‖…‖.

**In the game.** The browser applies P<sub>r</sub> or I − P<sub>r</sub> directly and renormalises (`project` in [`web/src/engine/walk.ts`](../web/src/engine/walk.ts)), with the outcome drawn as `Math.random() < P(r)`. It is the same map as the sensor circuit, without simulating the sixth qubit.

**Coin-flip mode.** The classical ghost is a list of 16 chances. A step is p′<sub>k</sub> = (p<sub>k−1</sub> + p<sub>k+1</sub>) / 2; a miss zeroes room r and renormalises.

## 5. Making the step fit on a real chip

The textbook shift is a controlled +1 (coin = 1) and a controlled −1 (coin = 0) on the room register. Each is a ladder of multi-controlled X gates with up to n controls (the coin plus n − 1 room bits), and IBM chips only have nearest-neighbour two-qubit gates, so the transpiler expands them into a lot of CNOT-type gates.

[`quantum_walk.py`](../quantum_walk.py) writes the same shift as **"everyone −1, then +2 if the coin is 1"**:

- coin 0: −1 → one room left
- coin 1: −1 + 2 → one room right

```python
def walk_step(n_room=4):
    qc = QuantumCircuit(n_room + 1, name="step")
    room = list(range(n_room))
    coin = n_room
    qc.h(coin)
    qc.x(room)                            # -1 = NOT, +1, NOT
    _increment(qc, room)
    qc.x(room)
    _increment(qc, room[1:], ctrl=coin)   # +2 if coin = 1
    return qc
```

Why it is cheaper:

- **−1 for everyone is not controlled.** In two's complement NOT(x) = −x − 1, so NOT(NOT(x) + 1) = x − 1. An uncontrolled increment is small.
- **+2 never touches the lowest room bit.** It is a +1 on bits 1 … n−1, so the only controlled adder works on one qubit fewer, and its largest gate has one control fewer.

Two-qubit gates per step after transpiling for an IBM Heron chip (FakeTorino, optimisation level 3):

| | Textbook shift | Our shift |
|---|---|---|
| 16 rooms | 458 | 60 |
| 8 rooms | 141 | 16 |

On the real ibm_kingston jobs the 16-room walk used 60 two-qubit gates for one step and 507 for eight; the 8-room walk 16 and 128.

Both versions are the **same unitary**: `Operator(walk_step(n)).equiv(Operator(textbook_step(n)))` is `True` for 8 and 16 rooms (notebook section 6). Without this change the 16-room walk would need about 2300 two-qubit gates for five steps, far beyond what current hardware can run before the signal is gone.

## 6. Why the game runs in the browser

Every click has to answer instantly. Real hardware cannot:

- Jobs wait in a shared queue, from seconds to hours. Ours waited 1–3 s on a Friday evening; that is not something to count on.
- The free Open Plan gives 10 minutes of QPU time per 28 days, and sessions (a reserved QPU window) are not available on it.
- The hardware is noisy (the point of [real-chip.md](real-chip.md)).

So the hunt is an exact simulation. [`web/src/engine/walk.ts`](../web/src/engine/walk.ts) stores four arrays per ghost (real and imaginary amplitude for coin 0 and coin 1, one entry per room) and applies the update from section 2. For both rings and 0–8 steps its probabilities match Qiskit's `Statevector` to within 2 × 10⁻¹⁵.

The real chip is used where it makes sense: a pre-recorded finale that uses its actual measurements.

## 7. The game loop

[`web/src/game/hunt.ts`](../web/src/game/hunt.ts) is a reducer with four phases:

```
start: 16 rooms, ghost in room 8, 3 warm-up steps, 4 flashlights

aim     player clicks room r, roll = Math.random()
          roll < P(r)  -> project onto room r -> won
          otherwise    -> project out room r  -> reveal
reveal  after 1.3 s:
          flashlights left -> one walk step -> aim
          none left        -> draw a room from P, project onto it -> lost
```

**"What happened" text.** After each step the game compares the new chances with what a coin-flipping ghost would make from the same chances one step earlier (`classicalStep`). It picks the room with the largest gap. Below a 7-point gap it just says the ghost stepped both ways; otherwise it reports where waves cancelled or added up, with both numbers. This isolates the effect of interference in that one step, including after the flashlight has reshaped the ghost.

**Tutorial.** [`TutorialView.tsx`](../web/src/views/TutorialView.tsx) starts the ghost alone in room 1 with no warm-up, shows the left/right split with arrows, offers the coin-flip comparison at step four, and ends with a practice flashlight.

**Real-chip round.** [`ChipView.tsx`](../web/src/views/ChipView.tsx) loads the saved ibm_kingston results ([`web/src/data/chip.json`](../web/src/data/chip.json)). The player's one flashlight is checked against a room drawn from the chip's 2000 measured shots for the 8-room, 5-step circuit.

## 8. Where things are in the code

| What | Python | Browser |
|---|---|---|
| Start state | `start_state`, `start_room` | `newGhost`, `startRoom` |
| One step | `walk_step` | `step` |
| Whole walk | `ghost_walk(steps, n_room)` | `newGhost(mode, rooms, warmup)` |
| Exact chances | `ideal_probs` | `probs` |
| Coin-flip ghost | `classical_probs` | `step` in classical mode, `classicalStep` |
| Flashlight | `flashlight_circuit` in the notebook | `project` |
