// ============================================================
// CLOUD SYNC — one save shared across all your devices.
//
// How it works: the whole game state is written to a single
// save.json file in a PRIVATE GitHub repo you own, using a
// fine-grained token you paste into Settings on each device.
//
// Strategy: "newest save wins."
//  - On app open (and whenever you return to the tab) we PULL:
//    if the cloud save is newer than this device's, apply it.
//  - A few seconds after you change anything we PUSH.
//  - If two devices raced, the push notices and re-pulls first.
// Simple, predictable, and plenty for one player switching devices.
// ============================================================
import { create } from 'zustand'
import { useCalendarStore } from '../stores/useCalendarStore'
import { useGameStore } from '../stores/useGameStore'
import { useSettingsStore } from '../stores/useSettingsStore'

// Little status store so the HUD/Settings can show sync state.
export const useSyncStore = create(() => ({
  status: 'off',      // 'off' | 'syncing' | 'synced' | 'error'
  lastSyncAt: null,   // Date of last successful sync
  error: null,        // human-readable message when status === 'error'
}))

const FILE = 'save.json'
const MODIFIED_KEY = 'questcal-modified-at' // when THIS device last changed anything

let lastSha = null      // GitHub's version id of the save file we last saw
let applying = false    // true while writing remote state into the stores
let pushTimer = null
let lastFocusSync = 0

// ---------- what gets synced ----------
// Keys/tokens are deliberately NOT synced — they stay on each device.
const collectSave = () => {
  const cal = useCalendarStore.getState()
  const game = useGameStore.getState()
  const s = useSettingsStore.getState()
  return {
    savedAt: new Date().toISOString(),
    calendar: { events: cal.events, seeded: cal.seeded },
    game: {
      totalXp: game.totalXp,
      claimedQuests: game.claimedQuests,
      customQuests: game.customQuests,
      unlockedAchievements: game.unlockedAchievements,
    },
    settings: {
      theme: s.theme, accent: s.accent, customAccent: s.customAccent,
      font: s.font, density: s.density, muted: s.muted, frame: s.frame,
    },
  }
}

const applySave = (save) => {
  applying = true
  try {
    useCalendarStore.setState(save.calendar ?? {})
    useGameStore.setState(save.game ?? {})
    useSettingsStore.setState(save.settings ?? {})
    // Adopt the cloud timestamp so we don't immediately push it back.
    localStorage.setItem(MODIFIED_KEY, save.savedAt)
  } finally {
    applying = false
  }
}

const localModifiedAt = () => localStorage.getItem(MODIFIED_KEY)

// ---------- GitHub Contents API ----------
const api = (init = {}) => {
  const { syncRepo, syncToken } = useSettingsStore.getState()
  return fetch(`https://api.github.com/repos/${syncRepo}/contents/${FILE}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${syncToken.trim()}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers ?? {}),
    },
  })
}

// btoa/atob only handle ASCII — go through UTF-8 bytes for emoji-safe saves.
const b64encode = (text) => {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}
const b64decode = (b64) => {
  const bin = atob(b64.replace(/\n/g, ''))
  const bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/** Fetch the cloud save. Returns { save, sha } or null if none exists yet. */
async function pullRemote() {
  const res = await api()
  if (res.status === 404) return null
  if (res.status === 401) throw new Error('Token rejected — check it in Settings')
  if (!res.ok) throw new Error(`GitHub said ${res.status}`)
  const body = await res.json()
  return { save: JSON.parse(b64decode(body.content)), sha: body.sha }
}

/** Upload the local save (sha = version we're replacing; null = first ever). */
async function pushRemote(save, sha) {
  const res = await api({
    method: 'PUT',
    body: JSON.stringify({
      message: `Sync save (${save.savedAt})`,
      content: b64encode(JSON.stringify(save, null, 2)),
      ...(sha ? { sha } : {}),
    }),
  })
  if (res.status === 409 || res.status === 422) return false // someone else pushed first
  if (res.status === 401) throw new Error('Token rejected — check it in Settings')
  if (!res.ok) throw new Error(`GitHub said ${res.status}`)
  lastSha = (await res.json()).content.sha
  return true
}

// ---------- the two sync operations ----------
/** Full sync: newest save wins, in either direction. */
export async function syncNow() {
  const { syncToken } = useSettingsStore.getState()
  if (!syncToken.trim()) { useSyncStore.setState({ status: 'off' }); return }

  useSyncStore.setState({ status: 'syncing', error: null })
  try {
    const remote = await pullRemote()
    const localAt = localModifiedAt()

    if (remote) {
      lastSha = remote.sha
      if (!localAt || remote.save.savedAt > localAt) {
        applySave(remote.save)            // cloud is newer → take it
      } else if (localAt > remote.save.savedAt) {
        await pushRemote(collectSave(), lastSha) // we're newer → upload
      }
    } else {
      await pushRemote(collectSave(), null)      // first ever sync
    }
    useSyncStore.setState({ status: 'synced', lastSyncAt: new Date() })
  } catch (err) {
    useSyncStore.setState({ status: 'error', error: err.message })
  }
}

/** Debounced push a few seconds after any local change. */
function schedulePush() {
  clearTimeout(pushTimer)
  pushTimer = setTimeout(async () => {
    const { syncToken } = useSettingsStore.getState()
    if (!syncToken.trim()) return
    useSyncStore.setState({ status: 'syncing', error: null })
    try {
      const ok = await pushRemote(collectSave(), lastSha)
      if (!ok) { await syncNow(); return } // raced another device → reconcile
      useSyncStore.setState({ status: 'synced', lastSyncAt: new Date() })
    } catch (err) {
      useSyncStore.setState({ status: 'error', error: err.message })
    }
  }, 4000)
}

// ---------- wiring ----------
/** Watch a store; when its synced slice actually changes, mark + push. */
function watch(store, pick) {
  let prev = JSON.stringify(pick(store.getState()))
  store.subscribe((state) => {
    if (applying) { prev = JSON.stringify(pick(state)); return }
    const now = JSON.stringify(pick(state))
    if (now === prev) return
    prev = now
    localStorage.setItem(MODIFIED_KEY, new Date().toISOString())
    schedulePush()
  })
}

/** Call once at app startup. Safe to call when sync is not configured. */
export function initSync() {
  // The shared-artifact build runs in a sandbox with no network access.
  if (import.meta.env.MODE === 'artifact') return

  watch(useCalendarStore, s => ({ events: s.events, seeded: s.seeded }))
  watch(useGameStore, s => ({
    totalXp: s.totalXp, claimedQuests: s.claimedQuests,
    customQuests: s.customQuests, unlockedAchievements: s.unlockedAchievements,
  }))
  watch(useSettingsStore, s => ({
    theme: s.theme, accent: s.accent, customAccent: s.customAccent,
    font: s.font, density: s.density, muted: s.muted, frame: s.frame,
  }))

  syncNow()

  // Coming back to the app (e.g. switching from iPad to PC) → pull latest.
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    if (Date.now() - lastFocusSync < 30_000) return
    lastFocusSync = Date.now()
    syncNow()
  })
}
