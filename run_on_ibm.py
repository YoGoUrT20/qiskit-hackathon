import argparse
import itertools
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import rustworkx as rx
from qiskit import QuantumCircuit
from qiskit.transpiler import generate_preset_pass_manager
from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2 as Sampler

from quantum_walk import classical_probs, ghost_walk, ideal_probs, start_room

DATA = Path(__file__).parent / "hardware"


def paths(tag):
    suffix = f"_{tag}" if tag else ""
    return DATA / f"job{suffix}.json", DATA / f"results{suffix}.json"


def build_circuits(specs):
    # specs
    circuits, meta = [], []
    for spec in specs:
        rooms, steps = spec.split(":")
        lo, _, hi = steps.partition("-")
        rooms = int(rooms)
        n_room = rooms.bit_length() - 1
        if 2 ** n_room != rooms:
            raise SystemExit(f"ring size must be a power of two, got {rooms}")
        for s in range(int(lo), int(hi or lo) + 1):
            circuits.append(ghost_walk(s, n_room))
            meta.append({"rooms": rooms, "steps": s})
    return circuits, meta


def two_qubit_gates(qc):
    return sum(1 for inst in qc.data if inst.operation.num_qubits == 2)


def coupling_graph(target):
    edges = {tuple(sorted(qargs)) for name in target.operation_names
             for qargs in target[name] if qargs is not None and len(qargs) == 2}
    g = rx.PyGraph()
    g.add_nodes_from(range(target.num_qubits))
    g.add_edges_from_no_data(sorted(edges))
    return g


def t2_times(backend):
    props = backend.properties()
    out = {}

    for q in range(backend.num_qubits):
        try:
            out[q] = props.t2(q)
        except:
            out[q] = None
    return out


def best_layout(qc, target, cmap, t2, avoid=()):
    # move a routed circuit onto the qubits most likely to keep the ghost quantum

    ops = Counter()
    for inst in qc.data:
        if inst.operation.name not in ("barrier", "delay"):
            ops[inst.operation.name, tuple(qc.find_bit(q).index for q in inst.qubits)] += 1
    used = sorted({q for _, qargs in ops for q in qargs})
    index = {q: i for i, q in enumerate(used)}
    pattern = rx.PyGraph()
    pattern.add_nodes_from(used)
    edges: set[tuple[int, int]] = set()
    for _, qargs in ops:
        if len(qargs) == 2:
            a, b = sorted(index[q] for q in qargs)
            edges.add((a, b))
    pattern.add_edges_from_no_data(sorted(edges))
    duration = qc.estimate_duration(target, unit="s")

    def log_success(phys):
        total = 0.0
        for (name, qargs), n in ops.items():
            key = tuple(phys[q] for q in qargs)
            if key not in target[name]:
                return -np.inf
            props = target[name][key]
            err = props.error if props is not None and props.error else 0.0
            total += n * np.log1p(-min(err, 0.999))
        for q in used:
            if not t2[phys[q]]:
                return -np.inf
            total -= duration / t2[phys[q]]
        return total

    best = {q: q for q in used}
    start = log_success(best)
    best_score = -np.inf if avoid & set(used) else start
    found = rx.vf2_mapping(cmap, pattern, subgraph=True, induced=False, id_order=False)

    for mapping in itertools.islice(found, 50_000):
        phys = {used[p]: c for c, p in mapping.items()}
        if avoid & set(phys.values()):
            continue

        score = log_success(phys)
        if score > best_score:
            best, best_score = phys, score
    return best, float(np.exp(start)), float(np.exp(best_score))


def remap(qc, phys):
    out = QuantumCircuit(*qc.qregs, *qc.cregs, name=qc.name, global_phase=qc.global_phase)
    for inst in qc.data:
        qargs = [out.qubits[phys[qc.find_bit(q).index]] for q in inst.qubits]
        out.append(inst.operation, qargs, inst.clbits, copy=False)
    return out


def submit(args):
    tag = args.tag or ("fake" if args.fake else "")
    job_file, results_file = paths(tag)
    if job_file.exists() and not (args.fake or args.force or args.dry_run):
        old = json.loads(job_file.read_text())["job_id"]
        raise SystemExit(f"{job_file} already holds job {old}; use another --tag or pass --force")
    if args.fake:
        from qiskit_ibm_runtime.fake_provider import FakeTorino
        backend = FakeTorino()
    else:
        service = QiskitRuntimeService(instance=args.instance)
        if args.backend:
            backend = service.backend(args.backend)
        else:
            backend = service.least_busy(operational=True, simulator=False)
    print(f"backend: {backend.name}")

    circuits, meta = build_circuits(args.circuits)
    pm = generate_preset_pass_manager(backend=backend, optimization_level=3, seed_transpiler=7)
    isa = pm.run(circuits)
    cmap, t2, avoid = coupling_graph(backend.target), t2_times(backend), set(args.avoid)

    print(f"{'rooms':>5} {'steps':>5} {'2q gates':>8} {'depth':>6} {'time us':>7} "
          f"{'est. success':>15}  physical qubits")
    for i, (m, qc) in enumerate(zip(meta, isa)):
        virt = qc.layout.final_index_layout(filter_ancillas=True)
        phys, before, after = best_layout(qc, backend.target, cmap, t2, avoid)
        isa[i] = remap(qc, phys)
        m["two_qubit_gates"] = two_qubit_gates(qc)
        m["depth"] = qc.depth()
        m["duration_us"] = round(qc.estimate_duration(backend.target, unit="s") * 1e6, 1)
        m["physical_qubits"] = [phys[p] for p in virt]
        m["min_t2_us"] = round(min(t2[q] for q in m["physical_qubits"]) * 1e6, 1)
        m["est_success"] = round(after, 4)
        print(f"{m['rooms']:>5} {m['steps']:>5} {m['two_qubit_gates']:>8} {m['depth']:>6} "
              f"{m['duration_us']:>7} {before:>6.3f} -> {after:<6.3f}  {m['physical_qubits']}")

    dd = None if args.fake else {"dynamical_decoupling": {"enable": True, "sequence_type": "XY4"}}
    sampler = Sampler(mode=backend, options=dd)
    if args.dry_run:
        print("\ndry run: nothing submitted")
        return
    job = sampler.run(isa, shots=args.shots)

    DATA.mkdir(exist_ok=True)
    record = {
        "job_id": job.job_id(),
        "backend": backend.name,
        "instance": args.instance,
        "fake": args.fake,
        "submitted_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "shots": args.shots,
        "avoided_qubits": sorted(avoid),
        "circuits": meta,
    }
    job_file.write_text(json.dumps(record, indent=2))
    print(f"\njob id: {record['job_id']}  (saved to {job_file})")

    if args.fake:
        save_results(record, job.result(), results_file)
    else:
        try:
            print(f"IBM's QPU time estimate: {job.usage_estimation['quantum_seconds']} s")
        except Exception:
            pass


def fetch(args):
    job_file, results_file = paths(args.tag)
    record = json.loads(job_file.read_text())
    service = QiskitRuntimeService(instance=record["instance"])
    job = service.job(record["job_id"])
    status = job.status()
    print(f"job {record['job_id']} on {record['backend']}: {status}")
    if status in ("ERROR", "CANCELLED"):
        print(job.error_message())
        return
    if status != "DONE" and not args.wait:
        print("not finished yet; run again later or add --wait")
        return
    result = job.result()
    record["metrics"] = job.metrics()  # queue/run timestamps and QPU seconds, as proof
    save_results(record, result, results_file)


def tvd(p, q):
    return 0.5 * float(np.abs(np.asarray(p) - np.asarray(q)).sum())


def save_results(record, result, results_file):
    out = dict(record, circuits=[])
    print(f"\n{'rooms':>5} {'steps':>5} {'TVD ideal':>9} {'TVD classical':>13} {'TVD uniform':>11} {'wrong parity':>12}")
    for m, pub in zip(record["circuits"], result):
        rooms, steps = m["rooms"], m["steps"]
        n_room = rooms.bit_length() - 1
        shots = [int(b, 2) for b in pub.data.c.get_bitstrings()]
        counts = np.bincount(shots, minlength=rooms)
        real = counts / counts.sum()
        ideal = ideal_probs(steps, n_room)
        classical = classical_probs(steps, n_room)
        parity = (start_room(n_room) + steps) % 2
        wrong_parity = float(real[[r for r in range(rooms) if r % 2 != parity]].sum())
        row = dict(
            m,
            shots=shots,  # room index of every single measurement
            counts=counts.tolist(),
            real_probs=real.round(5).tolist(),
            ideal_probs=ideal.round(5).tolist(),
            classical_probs=classical.round(5).tolist(),
            tvd_ideal=round(tvd(real, ideal), 4),
            tvd_classical=round(tvd(real, classical), 4),
            tvd_uniform=round(tvd(real, np.full(rooms, 1 / rooms)), 4),
            wrong_parity=round(wrong_parity, 4),
        )
        out["circuits"].append(row)
        print(f"{rooms:>5} {steps:>5} {row['tvd_ideal']:>9} {row['tvd_classical']:>13} "
              f"{row['tvd_uniform']:>11} {row['wrong_parity']:>12}")
    results_file.write_text(json.dumps(out))
    print(f"\nsaved {results_file}")


def main():
    # its ugly but its python so who cares
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("submit", help="build circuits and send one job")
    p.add_argument("--circuits", nargs="+", default=["16:1-8", "8:1-8"],
                   help="ROOMS:STEPS specs, e.g. 16:1-8 8:6-7 (rooms: power of two)")
    p.add_argument("--shots", type=int, default=2000)
    p.add_argument("--backend", help="e.g. ibm_kingston; default: least busy")
    p.add_argument("--instance", help="IBM Cloud instance CRN; default: saved account's")
    p.add_argument("--avoid", type=int, nargs="*", default=[], help="physical qubits never to use")
    p.add_argument("--tag", help="save as hardware/job_TAG.json, next to earlier jobs")
    p.add_argument("--fake", action="store_true", help="run locally on a noisy FakeTorino")
    p.add_argument("--force", action="store_true", help="overwrite an existing job file")
    p.add_argument("--dry-run", action="store_true", help="transpile for the chip but do not submit")
    p.set_defaults(func=submit)

    f = sub.add_parser("fetch", help="get results of a saved job")
    f.add_argument("--tag", help="which job: hardware/job_TAG.json (default: job.json)")
    f.add_argument("--wait", action="store_true", help="block until the job finishes")
    f.set_defaults(func=fetch)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
