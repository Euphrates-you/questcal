// App entry point — mounts <App /> into the #root div in index.html.
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { useCalendarStore } from './stores/useCalendarStore'
import { useGameStore } from './stores/useGameStore'
import { useSettingsStore } from './stores/useSettingsStore'
import { useUiStore } from './stores/useUiStore'

// Dev-only: poke at the stores from the browser console, e.g.
//   qc.game.getState().totalXp
if (import.meta.env.DEV) {
  window.qc = {
    calendar: useCalendarStore,
    game: useGameStore,
    settings: useSettingsStore,
    ui: useUiStore,
  }
}

// PWA: register the service worker so the installed app works offline.
// Skipped in dev (it would cache stale code) and in the artifact build
// (the sandbox there doesn't allow service workers).
if ('serviceWorker' in navigator && import.meta.env.PROD && import.meta.env.MODE !== 'artifact') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(import.meta.env.BASE_URL + 'sw.js')
      .catch(() => { /* offline support is a bonus — never break the app over it */ })
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
