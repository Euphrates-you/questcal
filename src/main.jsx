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

// ============================================================
// PWA: offline support + automatic updates.
//
// Installed apps (especially on iOS) get suspended rather than
// reloaded, so they can sit on an old build for days. We therefore
// ask the browser to re-check for a new version on launch and every
// time you switch back to the app, and quietly reload when one lands.
//
// Skipped in dev (it would cache stale code) and in the artifact build
// (that sandbox doesn't allow service workers).
// ============================================================
if ('serviceWorker' in navigator && import.meta.env.PROD && import.meta.env.MODE !== 'artifact') {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js')

      // If nothing controlled this page yet, this is a first install —
      // the controller change that follows is expected, not an update.
      const hadController = Boolean(navigator.serviceWorker.controller)
      let reloading = false

      const reloadWhenSafe = () => {
        // Never yank the page out from under an open dialog: the user
        // could be mid-sentence in an event or a chat message.
        if (document.querySelector('[role="dialog"]')) {
          setTimeout(reloadWhenSafe, 3000)
          return
        }
        window.location.reload()
      }

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || reloading) return
        reloading = true
        reloadWhenSafe()
      })

      // Check now, and again whenever the app comes back to the foreground.
      const checkForUpdate = () => { reg.update().catch(() => {}) }
      checkForUpdate()
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate()
      })
    } catch {
      // Offline support is a bonus — never break the app over it.
    }
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
