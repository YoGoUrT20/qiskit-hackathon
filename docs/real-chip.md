# The ghost on a real quantum computer

We ran the ghost walk on **ibm_kingston**, a 156-qubit IBM Heron chip, on Friday 23 October 2026: two jobs, 26 circuits, 2000 shots each, 19 s of QPU time. Every shot is saved in [`hardware/`](../hardware/), and the game's real-chip round plays from those shots.

Contents

1. [What we ran](#1-what-we-ran)
2. [How the circuits get onto the chip](#2-how-the-circuits-get-onto-the-chip)
3. [How we score a run](#3-how-we-score-a-run)
4. [8 rooms: the chip shows interference](#4-8-rooms-the-chip-shows-interference)
5. [16 rooms: decoherence](#5-16-rooms-decoherence)
6. [Same circuit, other qubits](#6-same-circuit-other-qubits)
7. [Simulator against the chip](#7-simulator-against-the-chip)
8. [Data files](#8-data-files)
9. [Run it yourself](#9-run-it-yourself)

---

## 1. What we ran

| Job ID | Circuits | Submitted (UTC) | Queue | QPU time |
|---|---|---|---|---|
| `dbdqmq7gdj9s73fko830` | 16 rooms, 1–8 steps; 8 rooms, 1–8 steps | 23 Oct 2026 18:46 | 3 s | 11 s |
| `dbdqq5nsstms73fb1c2g` (rerun) | 16 rooms, 1–8 steps; 8 rooms, 6–7 steps, on other qubits | 23 Oct 2026 18:53 | 1 s | 8 s |

Each circuit is the start state, t walk steps ([how-it-works.md](how-it-works.md), section 5) and a measurement of the room qubits. No flashlight: the measurement at the end *is* the flashlight, used in the game's real-chip round. Queue and QPU times come from IBM's job metrics, saved with the results.

## 2. How the circuits get onto the chip

[`run_on_ibm.py`](../run_on_ibm.py) does the following for one `submit`:

1. **Build** one circuit per ring size and step count (`--circuits 16:1-8 8:1-8`).
2. **Transpile** for the backend with Qiskit's preset pass manager, optimisation level 3, fixed seed.
3. **Re-layout** each circuit (`best_layout`). The transpiler picks qubits by gate and readout error only. We search up to 50 000 placements of the routed circuit on the chip's coupling graph (rustworkx VF2 subgraph matching) and score each one by

   log success = Σ<sub>gates</sub> log(1 − gate error) − Σ<sub>used qubits</sub> duration / T2

   so a qubit that dephases fast is charged for the whole run. `--avoid` excludes qubits outright. This step was added after the first job; see section 6.
4. **Dynamical decoupling** (XY4) on idle qubits.
5. **Submit all circuits in one job** with `SamplerV2`, so there is a single queue wait.
6. **Save the job ID straight away** to `hardware/job*.json`, before waiting. A closed terminal loses nothing; `fetch` picks the job up by ID.
7. **Fetch** saves every single shot, the counts, the ideal and classical predictions, the scores below and IBM's job metrics to `hardware/results*.json`.

`--dry-run` stops before step 5 and prints, per circuit, the two-qubit gate count, depth, estimated duration, the estimated success before and after re-layout, and the physical qubits.

## 3. How we score a run

**Distance** is the total variation distance between two room distributions: TVD(p, q) = ½ Σ<sub>k</sub> |p<sub>k</sub> − q<sub>k</sub>|. It is the share of the ghost you would have to move to turn one picture into the other: 0 = identical, 1 = nothing in common. We measure the real ghost against three references:

- the **quantum ghost** (exact statevector, `ideal_probs`),
- the **coin-flipping ghost** (classical random walk, `classical_probs`),
- **evenly everywhere** (uniform over all rooms, what total noise looks like).

**Leak** is the share of shots in rooms of the wrong parity. A perfect ghost, quantum or classical, is never there (it moves one room per step), so every shot there is noise.

With 2000 shots, sampling alone puts a distance off by about 0.02 for 8 rooms and 0.03 for 16 rooms on average (0.03 and 0.045 in 95 % of resamples), so smaller differences mean nothing.

## 4. 8 rooms: the chip shows interference

First job. The ghost starts in room 4.

| Steps | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Two-qubit gates | 16 | 32 | 48 | 64 | 80 | 94 | 110 | 128 |
| Distance from quantum ghost | 0.07 | 0.06 | 0.07 | 0.13 | **0.10** | 0.33 | 0.34 | 0.18 |
| Distance from coin-flip ghost | 0.07 | 0.06 | 0.07 | 0.23 | **0.37** | 0.23 | 0.24 | 0.41 |
| Distance from evenly everywhere | 0.68 | 0.57 | 0.46 | 0.44 | 0.44 | 0.38 | 0.41 | 0.39 |
| Leak | 1 % | 4 % | 5 % | 6 % | 8 % | 12 % | 14 % | 15 % |

For three steps the quantum and the classical ghost are the same, so both distances are equal. From step four the real ghost is clearly the quantum one, except at steps 6 and 7, which ran on weaker qubits (section 6).

**Step 4** (rooms 2, 4, 6, 8):

| | Room 2 | Room 4 (start) | Room 6 | Room 8 |
|---|---|---|---|---|
| Quantum ghost | 38 % | 13 % | 38 % | 13 % |
| Coin-flipping ghost | 25 % | 38 % | 25 % | 13 % |
| **ibm_kingston** | **31 %** | **15 %** | **32 %** | **17 %** |

The coin-flipping ghost is most likely back at the start. The quantum ghost avoids it, and so does the real one.

**Step 5** (rooms 1, 3, 5, 7), the game's real-chip round:

| | Room 1 | Room 3 | Room 5 | Room 7 |
|---|---|---|---|---|
| Quantum ghost | 38 % | 13 % | 13 % | 38 % |
| Coin-flipping ghost | 19 % | 31 % | 31 % | 19 % |
| **ibm_kingston** | **32 %** | **15 %** | **11 %** | **34 %** |

Two waves running apart, as the quantum ghost predicts. Physical qubits 75, 55, 59, 54.

**Step 8**: interference piles the ghost into room 8, the far side of the ring. Quantum 62.5 %, coin-flipping 22 %, ibm_kingston 48 %.

Percentages on this page are rounded half up, as in the game; the exact values are in the data files.

## 5. 16 rooms: decoherence

First job. About four times more two-qubit gates per step than the 8-room ring.

| Steps | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Two-qubit gates | 60 | 128 | 185 | 249 | 315 | 379 | 441 | 507 |
| Distance from quantum ghost | 0.20 | 0.31 | 0.43 | 0.50 | 0.53 | 0.49 | 0.43 | 0.41 |
| Distance from coin-flip ghost | 0.20 | 0.31 | 0.43 | 0.50 | 0.53 | 0.55 | 0.52 | 0.52 |
| Distance from evenly everywhere | 0.68 | 0.51 | 0.39 | 0.31 | 0.28 | 0.25 | 0.25 | 0.21 |
| Leak | 4 % | 12 % | 15 % | 21 % | 22 % | 25 % | 25 % | 29 % |

By step 3 the real ghost is closer to "evenly everywhere" than to the quantum ghost.

The distances to the quantum and the classical ghost are identical up to step 5, even though those two differ from step 4. That happens when the real ghost is lower than both predictions in every room they can reach: the distance then only counts how much has leaked or flattened, and cannot tell the two apart. So the 16-room run says nothing about quantum against classical. It shows decoherence.

**Noise does not make the ghost classical.** A classical ghost still respects parity and still has a bell shape. The noisy chip leaks up to 29 % of the ghost into forbidden rooms and pushes it towards uniform. "The ghost leaks into every room" is the accurate summary, not "the ghost turns classical".

## 6. Same circuit, other qubits

All weak circuits of the first job sat on one group of qubits: 17 and 25–29. The 16-room circuits used 17 and 25–28 (step 1: 17, 25–27 and 37); the 8-room circuits for steps 6 and 7 used 29, 28, 17, 27. On the calibration data qubit 25 had T2 ≈ 32 µs, against 90–200 µs on most others. The transpiler does not look at T2.

So we added the T2 charge to the layout search (section 2) and reran the weak circuits with `--avoid 17 25 26 27 28 29`. Distance from the quantum ghost:

| Circuit | First job | Rerun | Rerun qubits |
|---|---|---|---|
| 16 rooms, step 1 | 0.20 | 0.26 | 80, 96, 82, 81, 83 |
| 16 rooms, step 2 | 0.31 | 0.26 | 117, 105, 104, 107, 106 |
| 16 rooms, step 3 | 0.43 | 0.40 | 104–107, 117 |
| 16 rooms, step 4 | 0.50 | 0.43 | 104–107, 117 |
| 16 rooms, step 5 | 0.53 | 0.40 | 104–107, 117 |
| 16 rooms, step 6 | 0.49 | 0.44 | 104–107, 117 |
| 16 rooms, step 7 | 0.43 | 0.41 | 104–107, 117 |
| 16 rooms, step 8 | 0.41 | 0.42 | 104–107, 117 |
| 8 rooms, step 6 | 0.33 | 0.42 | 12, 13, 14, 15 |
| 8 rooms, step 7 | 0.34 | 0.44 | 12, 13, 14, 15 |

- 16 rooms, steps 2–6: slightly better. Steps 1, 7, 8: the same or worse.
- 8 rooms, steps 6–7: worse, on qubits whose calibration looked better (min T2 192 µs). Step 6 is now closest to the coin-flipping ghost (0.17), step 7 is lopsided with 42 % in room 3.

**Lesson.** Same circuit, different qubits on the same chip gives a different ghost, and the calibration numbers do not reliably predict which qubits will do better. Crosstalk, drift between calibration and run, and coherent gate errors are not in those numbers. For the game we use the first job, and we say which circuit came from which run.

## 7. Simulator against the chip

The same pipeline ran first on `FakeTorino`, a local simulator with the noise model of another IBM Heron chip (`hardware/results_fake.json`). Distance from the quantum ghost:

| Steps | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| 8 rooms, FakeTorino | 0.07 | 0.07 | 0.06 | 0.06 | 0.10 | 0.16 | 0.12 | 0.16 |
| 8 rooms, ibm_kingston | 0.07 | 0.06 | 0.07 | 0.13 | 0.10 | 0.33 | 0.34 | 0.18 |
| 16 rooms, FakeTorino | 0.19 | 0.32 | 0.34 | 0.41 | 0.43 | 0.41 | 0.42 | 0.33 |
| 16 rooms, ibm_kingston | 0.20 | 0.31 | 0.43 | 0.50 | 0.53 | 0.49 | 0.43 | 0.41 |

The simulator got the early steps right and was too optimistic later, most clearly for the 8-room steps 6–7. A noise model is a good first check, not a prediction of a specific run.

## 8. Data files

| File | Content |
|---|---|
| `hardware/job.json`, `job_rerun.json`, `job_fake.json` | Job ID, backend, submit time, shots, avoided qubits, and per circuit: rooms, steps, two-qubit gates, depth, estimated duration, physical qubits (rerun also: min T2, estimated success) |
| `hardware/results.json`, `results_rerun.json`, `results_fake.json` | The job record plus, per circuit: `shots` (room index of every single measurement), `counts`, `real_probs`, `ideal_probs`, `classical_probs`, `tvd_ideal`, `tvd_classical`, `tvd_uniform`, `wrong_parity`; for real jobs also IBM's `metrics` (queue and run timestamps, QPU seconds) |
| `web/src/data/chip.json` | The fields the game needs from `results.json` and `results_rerun.json`, written by `npm run sync-data` |

Room indices are 0-based in the data (room 1 in the game is index 0).

## 9. Run it yourself

```bash
python run_on_ibm.py submit --fake                              # whole pipeline locally, no account
python run_on_ibm.py submit --backend ibm_kingston --dry-run    # plan only, nothing sent
python run_on_ibm.py submit --backend ibm_kingston --tag mine   # one job, about 10 s of QPU time
python run_on_ibm.py fetch --tag mine --wait
```

Without `--backend` the script picks the least busy real backend. Without `--tag` it writes `job.json` and refuses to overwrite an existing one unless `--force` is given. Our two job IDs can be checked on the IBM Quantum Platform dashboard of the account that ran them.
