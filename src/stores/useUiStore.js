// ============================================================
// UI STORE — ephemeral interface state (never persisted).
// Which page you're on, whether the event modal is open, etc.
// ============================================================
import { create } from 'zustand'
import { addDays, addWeeks, addMonths } from 'date-fns'

export const useUiStore = create((set) => ({
  page: 'calendar', // 'calendar' | 'status' | 'quests' | 'trophies' | 'settings'
  setPage: (page) => set({ page }),

  // Calendar view state
  view: 'month',            // 'month' | 'week' | 'day'
  setView: (view) => set({ view }),
  focusDate: new Date(),    // the date the calendar is centered on
  setFocusDate: (focusDate) => set({ focusDate }),

  /** Move one period back (-1) or forward (+1), matching the current view. */
  stepFocus: (dir) => set((s) => ({
    focusDate:
      s.view === 'month' ? addMonths(s.focusDate, dir)
      : s.view === 'week' ? addWeeks(s.focusDate, dir)
      : addDays(s.focusDate, dir),
  })),
  goToday: () => set({ focusDate: new Date() }),

  /** Jump straight to a specific day (used by search and the overdue chip). */
  jumpToDate: (date) => set({ page: 'calendar', view: 'day', focusDate: date }),

  // Event modal: closed, creating (with prefills), or editing an id
  modal: null, // null | { eventId } | { defaults: { date, startTime } }
  openNewEvent: (defaults = {}) => set({ modal: { defaults } }),
  openEditEvent: (eventId) => set({ modal: { eventId } }),
  closeModal: () => set({ modal: null }),

  // Quick search / command palette (Ctrl+K)
  paletteOpen: false,
  openPalette: () => set({ paletteOpen: true }),
  closePalette: () => set({ paletteOpen: false }),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),

  // Set while dragging an event chip, so drop targets can react
  // and other chips can get pointer-events: none.
  draggingId: null,
  setDraggingId: (draggingId) => set({ draggingId }),
}))
