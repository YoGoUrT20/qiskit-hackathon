import { ComponentType, useEffect, useState } from 'react'
import { DocsView } from './views/DocsView'
import { GameView } from './views/GameView'
import { HostView } from './views/HostView'
import { JoinView } from './views/JoinView'
import { StartView } from './views/StartView'
import { TutorialView } from './views/TutorialView'

// One table for routes and pages, so a route can never lack its page.
const VIEWS = {
  '#/play': GameView,
  '#/tutorial': TutorialView,
  '#/docs': DocsView,
  '#/host': HostView,
  '#/join': JoinView,
} satisfies Record<string, ComponentType>

type Route = keyof typeof VIEWS | 'start'

const readRoute = (): Route => {
  const h = window.location.hash
  const known = (Object.keys(VIEWS) as (keyof typeof VIEWS)[]).find((r) => h.startsWith(r))
  if (known) return known
  if (h === '' || h === '#' || h === '#/') return 'start'
  return '#/docs' // in-page anchors (#how, #real-chip, ...) live on the docs page
}

export function App() {
  const [route, setRoute] = useState<Route>(readRoute)

  useEffect(() => {
    const onHash = () => {
      const next = readRoute()
      setRoute((prev) => {
        if (next !== prev || window.location.hash.startsWith('#/')) window.scrollTo(0, 0)
        return next
      })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const View = route === 'start' ? StartView : VIEWS[route]
  return <View />
}
