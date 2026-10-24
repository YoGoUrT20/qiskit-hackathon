import raw from './chip.json'

export interface ChipCircuit {
  rooms: number
  steps: number
  qubits: number[]
  twoQubitGates: number
  counts: number[]
  real: number[]
  ideal: number[]
  classical: number[]
  distQuantum: number
  distClassical: number
  distUniform: number
  leak: number
}

export interface ChipRun {
  jobId: string
  backend: string
  created: string
  running: string | null
  finished: string | null
  qpuSeconds: number | null
  shots: number
  circuits: ChipCircuit[]
}

export const chip = raw as { first: ChipRun; rerun: ChipRun | null }

export const circuit = (run: ChipRun | null, rooms: number, steps: number) =>
  run?.circuits.find((c) => c.rooms === rooms && c.steps === steps) ?? null

export const series = (run: ChipRun, rooms: number) =>
  run.circuits.filter((c) => c.rooms === rooms).sort((a, b) => a.steps - b.steps)
