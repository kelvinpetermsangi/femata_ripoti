import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './i18n'
import { registerServiceWorker } from './pwa/registerSW'
import { setupQueuedReportSync } from './services/syncQueue'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

void registerServiceWorker()
setupQueuedReportSync()
