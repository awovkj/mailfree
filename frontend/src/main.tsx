import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { TooltipLayer } from './components/TooltipLayer'
import './styles.css'
import './styles/splash.css'
import './styles/tooltip.css'
import './styles/auth-landing.css'
import './styles/mailbox.css'
import './styles/mailbox-switcher.css'
import './styles/mailbox-switcher-feedback.css'
import './styles/mailbox-address-option.css'
import './styles/quick-mailbox.css'
import './styles/message.css'
import './styles/message-scrollbar.css'
import './styles/compose-dialog.css'
import './styles/admin-workspace.css'
import './styles/user-management.css'
import './styles/responsive.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <TooltipLayer />
  </StrictMode>,
)
