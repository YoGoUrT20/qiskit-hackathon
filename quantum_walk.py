import numpy as np
from qiskit import ClassicalRegister, QuantumCircuit
from qiskit.quantum_info import Statevector


def start_room(n_room=4):
    # index 7 = room 8 = start
    return 2 ** (n_room - 1) - 1


def start_state(n_room=4):
    qc = QuantumCircuit(n_room + 1, name="start")
    qc.x(range(n_room - 1)) # index 0111 = 7 for 4 room qubits
    qc.h(n_room)
    qc.s(n_room) # coin = (|0> + i|1>) / sqrt(2)
    return qc


def _increment(qc, bits, ctrl=None):
    extra = [] if ctrl is None else [ctrl]

    for i in reversed(range(1, len(bits))):
        qc.mcx(extra + bits[:i], bits[i])
    if ctrl is None:
        qc.x(bits[0])
    else:
        qc.cx(ctrl, bits[0])


def walk_step(n_room=4):
    # Hadamard coin, then coin 0 -> room - 1, coin 1 -> room + 1.
    qc = QuantumCircuit(n_room + 1, name="step")
    room = list(range(n_room))
    coin = n_room

    qc.h(coin)
    qc.x(room) # -1 = not, +1, not
    _increment(qc, room)
    qc.x(room)
    _increment(qc, room[1:], ctrl=coin) # +2 if coin = 1
    return qc


def ghost_walk(steps, n_room=4, measure=True):
    # start state with plus `steps` walk steps
    qc = start_state(n_room)
    for _ in range(steps):
        qc.compose(walk_step(n_room), inplace=True)
    if measure:
        c = ClassicalRegister(n_room, "c")
        qc.add_register(c)
        qc.measure(range(n_room), c)
    qc.name = f"walk_{2 ** n_room}rooms_{steps}steps"
    return qc


def ideal_probs(steps, n_room=4):
    # get room probabilities of the quantum ghost
    state = Statevector(ghost_walk(steps, n_room, measure=False))
    return state.probabilities(qargs=range(n_room))


def classical_probs(steps, n_room=4):
    # get room probabilities of a normal coin-flipping ghost
    p = np.zeros(2 ** n_room)
    p[start_room(n_room)] = 1
    for _ in range(steps):
        p = (np.roll(p, 1) + np.roll(p, -1)) / 2
    return p
