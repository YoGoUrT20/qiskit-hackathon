// copies the real IBM runs (../hardware/results*.json) into a small file the site imports.
// run after every new hardware job:  npm run sync-data
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const hardware = join(here, '..', '..', 'hardware')
const out = join(here, '..', 'src', 'data', 'chip.json')

function load(name) {
  const path = join(hardware, name)
  if (!existsSync(path)) return null
  const r = JSON.parse(readFileSync(path, 'utf8'))
  const t = r.metrics?.timestamps ?? {}
  return {
    jobId: r.job_id,
    backend: r.backend,
    created: t.created ?? r.submitted_utc,
    running: t.running ?? null,
    finished: t.finished ?? null,
    qpuSeconds: r.metrics?.usage?.qpu_charge_time_seconds ?? null,
    shots: r.shots,
    circuits: r.circuits.map((c) => ({
      rooms: c.rooms,
      steps: c.steps,
      qubits: c.physical_qubits,
      twoQubitGates: c.two_qubit_gates,
      counts: c.counts,
      real: c.real_probs,
      ideal: c.ideal_probs,
      classical: c.classical_probs,
      distQuantum: c.tvd_ideal,
      distClassical: c.tvd_classical,
      distUniform: c.tvd_uniform,
      leak: c.wrong_parity,
    })),
  }
}

const data = { first: load('results.json'), rerun: load('results_rerun.json') }
if (!data.first) throw new Error(`no results.json in ${hardware}`)
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify(data))
console.log(`wrote ${out}: ${data.first.circuits.length} + ${data.rerun?.circuits.length ?? 0} circuits`)
