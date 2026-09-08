import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppRouter } from './app/router.tsx'
import { initAnalytics } from './lib/analytics.ts'
import './index.css'
import './styles/tokens.css'
import './styles/marketing.css'
import './styles/homepage-starter.css'
import './styles/homepage-starter-optional.css'
import './styles/homepage-polish.css'
import './styles/seo-content.css'
import './styles/info-pages.css'
import './styles/build-career.css'
import './styles/simulator-landing.css'
import './styles/career-modes.css'
import './styles/game-shell.css'
import './styles/game-ui.css'
import './styles/advertising.css'
import './styles/release.css'

initAnalytics()

const root = document.getElementById('root')!
if (root.dataset.prerendered) {
  root.replaceChildren()
  root.removeAttribute('data-prerendered')
}

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  </StrictMode>,
)
