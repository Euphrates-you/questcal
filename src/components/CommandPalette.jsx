// ============================================================
// COMMAND PALETTE (Ctrl/Cmd + K)
//
// Type to find any entry by name across the whole calendar, or jump
// to a view. Enter opens the day it's on. With a few hundred entries
// this beats paging through months.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import {
  Search, Plus, CalendarDays, CalendarClock, CalendarRange,
  ScanFace, Scroll, Trophy, Settings as SettingsIcon, CornerDownLeft,
} from 'lucide-react'
import { useUiStore } from '../stores/useUiStore'
import { useCalendarStore, isQuest } from '../stores/useCalendarStore'
import { CATEGORIES } from '../game/config'
import { play } from '../game/sound'

const SHORTCUTS = [
  ['N', 'New entry'], ['T', 'Today'], ['←  →', 'Prev / next'],
  ['M W D', 'Month / week / day'], ['Ctrl K', 'This search'],
]

/** "Today" / "Tomorrow" / "Friday" / "Tue 4 Aug" / "Yesterday". */
function whenLabel(dateStr) {
  const date = parseISO(dateStr)
  const days = differenceInCalendarDays(date, new Date())
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  if (days > 1 && days < 7) return format(date, 'EEEE')
  return format(date, 'EEE d MMM')
}

export default function CommandPalette() {
  const { paletteOpen, closePalette, openNewEvent, setPage, setView, goToday, jumpToDate } = useUiStore()
  const events = useCalendarStore(s => s.events)

  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  // Fresh start every time it opens.
  useEffect(() => {
    if (paletteOpen) { setQuery(''); setIndex(0); setTimeout(() => inputRef.current?.focus(), 40) }
  }, [paletteOpen])

  const actions = useMemo(() => [
    { id: 'new', icon: Plus, label: 'New quest or event', hint: 'N', run: () => openNewEvent({}) },
    { id: 'today', icon: CalendarClock, label: 'Go to today', hint: 'T', run: () => { goToday(); setPage('calendar') } },
    { id: 'month', icon: CalendarDays, label: 'Month view', hint: 'M', run: () => { setView('month'); setPage('calendar') } },
    { id: 'week', icon: CalendarRange, label: 'Week view', hint: 'W', run: () => { setView('week'); setPage('calendar') } },
    { id: 'day', icon: CalendarClock, label: 'Day view', hint: 'D', run: () => { setView('day'); setPage('calendar') } },
    { id: 'status', icon: ScanFace, label: 'Open Status', run: () => setPage('status') },
    { id: 'quests', icon: Scroll, label: 'Open Quest Log', run: () => setPage('quests') },
    { id: 'trophies', icon: Trophy, label: 'Open Trophy Shelf', run: () => setPage('trophies') },
    { id: 'settings', icon: SettingsIcon, label: 'Open Settings', run: () => setPage('settings') },
  ], [openNewEvent, setPage, setView, goToday])

  // Flat list of everything selectable, so arrow keys are simple.
  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    const today = format(new Date(), 'yyyy-MM-dd')

    const matchedActions = q
      ? actions.filter(a => a.label.toLowerCase().includes(q))
      : actions.slice(0, 3) // just the essentials when nothing is typed

    const matchedEvents = (q
      ? events.filter(e => e.title.toLowerCase().includes(q))
      // no query → what's coming up
      : events.filter(e => e.date >= today && !e.completed)
    )
      .sort((a, b) => {
        if (q) {
          // closest to today first, so "gym" finds this week's gym
          const da = Math.abs(differenceInCalendarDays(parseISO(a.date), new Date()))
          const db = Math.abs(differenceInCalendarDays(parseISO(b.date), new Date()))
          if (da !== db) return da - db
        }
        return (a.date + (a.startTime || '')) < (b.date + (b.startTime || '')) ? -1 : 1
      })
      .slice(0, 7)

    return [
      ...matchedActions.map(a => ({ type: 'action', ...a })),
      ...matchedEvents.map(e => ({
        type: 'event',
        id: e.id,
        event: e,
        run: () => jumpToDate(parseISO(e.date)),
      })),
    ]
  }, [query, events, actions, jumpToDate])

  // Keep the highlighted row in range and in view.
  useEffect(() => { setIndex(i => Math.min(i, Math.max(0, items.length - 1))) }, [items.length])
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [index])

  const choose = (item) => {
    if (!item) return
    item.run()
    play('click')
    closePalette()
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => (i + 1) % Math.max(1, items.length)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => (i - 1 + items.length) % Math.max(1, items.length)) }
    else if (e.key === 'Enter') { e.preventDefault(); choose(items[index]) }
    else if (e.key === 'Escape') { e.preventDefault(); closePalette() }
  }

  return (
    <AnimatePresence>
      {paletteOpen && (
        <motion.div
          className="fixed inset-0 z-[75] flex items-start justify-center px-4 pt-[12vh] bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={closePalette}
        >
          <motion.div
            role="dialog" aria-modal="true" aria-label="Search"
            className="glass-strong sys-frame w-full max-w-lg rounded-xl overflow-hidden"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={e => e.stopPropagation()}
          >
            {/* search box */}
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-edge">
              <Search size={16} className="text-accent shrink-0" aria-hidden />
              <input
                ref={inputRef}
                value={query}
                onChange={e => { setQuery(e.target.value); setIndex(0) }}
                onKeyDown={onKeyDown}
                placeholder="Search your calendar, or jump somewhere…"
                className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted/70 outline-none"
                aria-label="Search"
              />
              <kbd className="hidden sm:block text-[10px] text-ink-muted border border-edge rounded px-1.5 py-0.5">ESC</kbd>
            </div>

            {/* results */}
            <div ref={listRef} className="max-h-[46vh] overflow-y-auto p-1.5">
              {items.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-ink-muted">
                  Nothing matches “{query}”.
                </p>
              )}

              {items.map((item, i) => {
                const active = i === index
                const isFirstEvent = item.type === 'event' && items[i - 1]?.type !== 'event'
                const cat = item.type === 'event'
                  ? (CATEGORIES[item.event.category] ?? CATEGORIES.work)
                  : null

                return (
                  <div key={`${item.type}-${item.id}`}>
                    {isFirstEvent && (
                      <p className="px-3 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-muted">
                        {query.trim() ? 'Matches' : 'Coming up'}
                      </p>
                    )}
                    <button
                      data-active={active}
                      onMouseEnter={() => setIndex(i)}
                      onClick={() => choose(item)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left cursor-pointer
                        transition-colors duration-100 ${active ? 'bg-surface-2' : ''}`}
                    >
                      {item.type === 'action' ? (
                        <>
                          <item.icon size={15} className="text-ink-muted shrink-0" aria-hidden />
                          <span className="flex-1 text-sm text-ink">{item.label}</span>
                          {item.hint && (
                            <kbd className="text-[10px] text-ink-muted border border-edge rounded px-1.5 py-0.5">
                              {item.hint}
                            </kbd>
                          )}
                        </>
                      ) : (
                        <>
                          <span
                            className="size-2 rounded-full shrink-0"
                            style={isQuest(item.event)
                              ? { background: cat.color }
                              : { boxShadow: `inset 0 0 0 1.5px ${cat.color}` }}
                            aria-hidden
                          />
                          <span className="flex-1 min-w-0">
                            <span className={`block text-sm truncate ${item.event.completed ? 'text-ink-muted line-through' : 'text-ink'}`}>
                              {item.event.title}
                            </span>
                            <span className="block text-[11px] text-ink-muted">
                              {whenLabel(item.event.date)}
                              {item.event.startTime ? ` · ${item.event.startTime}` : ''}
                              {isQuest(item.event) ? ` · ${item.event.xp} XP` : ' · event'}
                            </span>
                          </span>
                          {active && <CornerDownLeft size={13} className="text-ink-muted shrink-0" aria-hidden />}
                        </>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>

            {/* shortcut cheatsheet */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 border-t border-edge bg-surface-2/40">
              {SHORTCUTS.map(([key, what]) => (
                <span key={key} className="flex items-center gap-1.5 text-[10px] text-ink-muted">
                  <kbd className="border border-edge rounded px-1.5 py-0.5 text-ink">{key}</kbd>
                  {what}
                </span>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
