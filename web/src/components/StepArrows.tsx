export function StepArrows({ from }: { from: number[] }) {
  const n = from.length
  const step = (2 * Math.PI) / n
  const r = 31
  const pt = (a: number) => `${(50 + r * Math.sin(a)).toFixed(2)} ${(50 - r * Math.cos(a)).toFixed(2)}`

  const arrows: { key: string; d: string }[] = []
  from.forEach((p, i) => {
    if (p < 1e-9) return
    for (const dir of [-1, 1]) {
      const start = i * step + dir * 0.2 * step
      const end = (i + dir) * step - dir * 0.2 * step
      arrows.push({ key: `${i}:${dir}`, d: `M${pt(start)} A${r} ${r} 0 0 ${dir > 0 ? 1 : 0} ${pt(end)}` })
    }
  })

  return (
    <svg className="ring-overlay" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <marker id="step-head" viewBox="0 0 6 6" refX="3.5" refY="3" markerWidth="3.6" markerHeight="3.6" orient="auto">
          <path d="M0 0.4 L6 3 L0 5.6 z" fill="currentColor" />
        </marker>
      </defs>
      <g className="arrows">
        {arrows.map((a) => (
          <path key={a.key} d={a.d} pathLength={1} markerEnd="url(#step-head)" />
        ))}
      </g>
    </svg>
  )
}
