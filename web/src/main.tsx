import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexProvider } from 'convex/react'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/creepster/400.css'
import '@fontsource/tilt-warp/400.css'
import './styles.css'
import { App } from './App'
import { convex } from './online/client'

// Short links for phones: /1234 and /join/1234 open the join page for game 1234, /join asks for the code.
const short = window.location.pathname.match(/^\/(join\/?)?(\d{4})?\/?$/)
if (short && (short[1] || short[2])) window.history.replaceState(null, '', `/#/join${short[2] ? `/${short[2]}` : ''}`)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {convex ? (
      <ConvexProvider client={convex}>
        <App />
      </ConvexProvider>
    ) : (
      <App />
    )}
  </StrictMode>,
)
