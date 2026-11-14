import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import '@fontsource-variable/inter'
import '@/components/arc/foundation.css'
import './index.css'
import './styles/tokens.css'
import './styles/app.css'
import './styles/theme.css'
import './styles/tailwind.css'
import App from './App.tsx'
import { initTheme } from './lib/theme'

initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
