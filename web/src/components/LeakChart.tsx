import { useState } from 'react'
import { pct } from '../engine/walk'
import { barPath } from './bar'

const W = 380
const H = 170
const TOP = 22
const BOTTOM = 26
const MAX = 0.32

interface Row {
  title: string
  detail: string
  values: number[]
}

// share of the ghost in rooms a perfect ghost can never be in, per step
export function LeakChart({ rows }: { rows: Row[] }) {
  const [hover, setHover] = useState<{ row: number; step: number } | null>(null)
  const plotH = H - TOP - BOTTOM

  return (
    <div className="leak">
      <p className="readout" aria-live="polite">
        {hover
          ? `${rows[hover.row].title}, step ${hover.step + 1}: ${pct(rows[hover.row].values[hover.step])} of the ghost in forbidden rooms`
          : 'Point at a bar for exact numbers.'}
      </p>
      <div className="leak-rows">
        {rows.map((row, r) => {
          const gw = W / row.values.length
          return (
            <figure key={row.title} className="leak-row">
              <figcaption>
                <strong>{row.title}</strong> <span className="note">{row.detail}</span>
              </figcaption>
              <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${row.title}: ${row.values.map((v, i) => `step ${i + 1} ${pct(v)}`).join(', ')}`}>
                {row.values.map((v, i) => {
                  const h = (plotH * v) / MAX
                  const x = i * gw + gw * 0.25
                  const w = gw * 0.5
                  const on = hover?.row === r && hover.step === i
                  return (
                    <g key={i} onMouseEnter={() => setHover({ row: r, step: i })} onMouseLeave={() => setHover(null)} onClick={() => setHover({ row: r, step: i })}>
                      <rect x={i * gw} y={0} width={gw} height={H} className={on ? 'hit is-hover' : 'hit'} />
                      <path d={barPath(x, TOP + plotH, w, h)} fill="var(--chip)" />
                      {(i === 0 || i === row.values.length - 1) && (
                        <text x={x + w / 2} y={TOP + plotH - h - 7} className="axis" textAnchor="middle">
                          {pct(v)}
                        </text>
                      )}
                      <text x={x + w / 2} y={H - 6} className="axis" textAnchor="middle">
                        {i + 1}
                      </text>
                    </g>
                  )
                })}
                <line x1={0} x2={W} y1={TOP + plotH} y2={TOP + plotH} className="baseline" />
              </svg>
            </figure>
          )
        })}
      </div>
      <p className="note">Steps 1 to 8, left to right.</p>
    </div>
  )
}
