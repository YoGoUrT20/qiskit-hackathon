import { useState } from 'react'
import { pct } from '../engine/walk'
import type { ChipCircuit } from '../data/chip'
import { barPath } from './bar'

const W = 760
const H = 290
const LEFT = 44
const TOP = 12
const BOTTOM = 34
const MAX = 0.7
const SERIES = [
  { key: 'ideal', name: 'Quantum ghost (ideal)', color: 'var(--quantum)' },
  { key: 'classical', name: 'Coin-flipping ghost', color: 'var(--classical)' },
  { key: 'real', name: 'Real chip', color: 'var(--chip)' },
] as const

export function StepChart({ c }: { c: ChipCircuit }) {
  const [hover, setHover] = useState<number | null>(null)
  const [table, setTable] = useState(false)
  const n = c.real.length
  const plotH = H - TOP - BOTTOM
  const groupW = (W - LEFT) / n
  const barW = 20
  const y = (v: number) => TOP + plotH - (plotH * v) / MAX

  return (
    <div className="chart">
      <div className="chart-head">
        <ul className="legend">
          {SERIES.map((s) => (
            <li key={s.key}>
              <span className="swatch" style={{ background: s.color }} />
              {s.name}
            </li>
          ))}
        </ul>
        <p className="readout" aria-live="polite">
          {hover == null
            ? 'Point at a room for exact numbers.'
            : `Room ${hover + 1}: quantum ${pct(c.ideal[hover])}, coin-flipping ${pct(c.classical[hover])}, real chip ${pct(c.real[hover])}`}
        </p>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label="Chance per room: ideal quantum ghost, coin-flipping ghost and the real chip">
        {[0.25, 0.5].map((v) => (
          <g key={v}>
            <line x1={LEFT} x2={W} y1={y(v)} y2={y(v)} className="grid" />
            <text x={LEFT - 8} y={y(v)} className="axis" textAnchor="end" dominantBaseline="central">
              {v * 100}%
            </text>
          </g>
        ))}
        {c.real.map((_, k) => {
          const x0 = LEFT + k * groupW
          const start = x0 + (groupW - (3 * barW + 4)) / 2
          return (
            <g key={k} onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)} onClick={() => setHover(k)}>
              <rect x={x0 + 2} y={TOP} width={groupW - 4} height={plotH} className={hover === k ? 'hit is-hover' : 'hit'} />
              {SERIES.map((s, i) => {
                const v = c[s.key][k]
                const top = y(v)
                const h = TOP + plotH - top
                return h > 0.5 ? <path key={s.key} d={barPath(start + i * (barW + 2), TOP + plotH, barW, h)} fill={s.color} /> : null
              })}
              <text x={x0 + groupW / 2} y={H - 12} className="axis" textAnchor="middle">
                {k + 1}
              </text>
            </g>
          )
        })}
        <line x1={LEFT} x2={W} y1={TOP + plotH} y2={TOP + plotH} className="baseline" />
      </svg>

      <button type="button" className="btn btn-small" aria-expanded={table} onClick={() => setTable(!table)}>
        {table ? 'Hide table' : 'Show as table'}
      </button>
      {table && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Room</th>
                {SERIES.map((s) => (
                  <th key={s.key} scope="col">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {c.real.map((_, k) => (
                <tr key={k}>
                  <th scope="row">{k + 1}</th>
                  {SERIES.map((s) => (
                    <td key={s.key}>{pct(c[s.key][k])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
