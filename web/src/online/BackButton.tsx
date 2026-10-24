// how many screens of this app are behind the current one, kept in history.state so a reload keeps it
const depthOf = () => (window.history.state as { depth?: number } | null)?.depth

let depth = depthOf() ?? 0
if (depthOf() === undefined) window.history.replaceState({ depth }, '')

window.addEventListener('hashchange', () => {
  const d = depthOf()
  if (d === undefined) window.history.replaceState({ depth: ++depth }, '')
  else depth = d
})

// back to the previous screen, or to the fallback when the game was opened straight from a QR code or link
export function BackButton({ fallback = '#/', compact = false }: { fallback?: string; compact?: boolean }) {
  const back = () => {
    if (depth > 0) window.history.back()
    else window.location.hash = fallback
  }
  return (
    <button type="button" className={`pill pill-small ${compact ? 'pill-icon' : ''}`} aria-label="Back" onClick={back}>
      {compact ? '←' : '← Back'}
    </button>
  )
}
