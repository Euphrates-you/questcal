// ============================================================
// CALENDAR PAGE — header (title, prev/today/next, view switch)
// plus the active view (month / week / day) with animated
// transitions between them.
// ============================================================
import { motion } from 'framer-motion'
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight, Search, AlertTriangle } from 'lucide-react'
import { useUiStore } from '../../stores/useUiStore'
import { useCalendarStore, isQuest } from '../../stores/useCalendarStore'
import { WEEK_STARTS_ON } from '../../game/config'
import { play } from '../../game/sound'
import MonthView from './MonthView'
import WeekView from './WeekView'
import DayView from './DayView'

const VIEWS = ['month', 'week', 'day']

function headerTitle(view, date) {
  if (view === 'month') return format(date, 'MMMM yyyy')
  if (view === 'day') return format(date, 'EEEE, MMM d')
  const start = startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON })
  const end = endOfWeek(date, { weekStartsOn: WEEK_STARTS_ON })
  return `${format(start, 'MMM d')} – ${format(end, start.getMonth() === end.getMonth() ? 'd' : 'MMM d')}`
}

export default function CalendarPage() {
  const { view, setView, focusDate, goToday, stepFocus, jumpToDate, openPalette } = useUiStore()
  const events = useCalendarStore(s => s.events)

  const step = (dir) => { play('click'); stepFocus(dir) }

  // Quests whose day has passed and were never ticked off. Plain events
  // settle themselves, so anything left here is genuinely unfinished.
  const today = format(new Date(), 'yyyy-MM-dd')
  const overdue = events
    .filter(e => isQuest(e) && !e.completed && e.date < today)
    .sort((a, b) => (a.date < b.date ? -1 : 1))

  // A key that changes whenever the visible range changes → drives the
  // enter/exit animation between views and when paging through time.
  const viewKey = `${view}-${format(focusDate, view === 'month' ? 'yyyy-MM' : 'yyyy-MM-dd')}`

  return (
    <div>
      {/* ---------- header ---------- */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h1 className="font-display font-bold text-xl sm:text-2xl text-holo min-w-44 uppercase tracking-wide">
          {headerTitle(view, focusDate)}
        </h1>

        <div className="flex items-center gap-1">
          <button onClick={() => step(-1)} aria-label="Previous"
            className="p-2 rounded-lg border border-edge bg-surface hover:bg-surface-2 text-ink-muted hover:text-ink cursor-pointer transition-colors duration-200">
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => { goToday(); play('click') }}
            title="Jump to today (T)"
            className="px-3 py-1.5 rounded-lg border border-edge bg-surface hover:bg-surface-2 text-sm font-medium text-ink cursor-pointer transition-colors duration-200">
            Today
          </button>
          <button onClick={() => step(1)} aria-label="Next"
            className="p-2 rounded-lg border border-edge bg-surface hover:bg-surface-2 text-ink-muted hover:text-ink cursor-pointer transition-colors duration-200">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* unfinished quests from earlier days — click to go fix them */}
        {overdue.length > 0 && (
          <button
            onClick={() => { jumpToDate(parseISO(overdue[0].date)); play('click') }}
            title={`Oldest: ${overdue[0].title} on ${overdue[0].date}`}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors duration-200"
            style={{
              color: 'var(--gold)',
              borderColor: 'color-mix(in oklab, var(--gold) 45%, transparent)',
              background: 'color-mix(in oklab, var(--gold) 12%, transparent)',
            }}
          >
            <AlertTriangle size={13} aria-hidden />
            {overdue.length} overdue
          </button>
        )}

        <div className="flex-1" />

        {/* search / command palette */}
        <button
          onClick={() => { openPalette(); play('click') }}
          title="Search your calendar (Ctrl+K)"
          aria-label="Search your calendar"
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-edge bg-surface hover:bg-surface-2 text-ink-muted hover:text-ink cursor-pointer transition-colors duration-200"
        >
          <Search size={15} aria-hidden />
          <kbd className="hidden lg:block text-[10px] border border-edge rounded px-1.5 py-0.5">Ctrl K</kbd>
        </button>

        {/* view switcher with a sliding highlight pill */}
        <div className="flex p-1 rounded-xl border border-edge bg-surface" role="tablist" aria-label="Calendar view">
          {VIEWS.map(v => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => { setView(v); play('click') }}
              className={`relative px-3.5 py-1.5 rounded-lg text-sm font-medium capitalize cursor-pointer transition-colors duration-200 ${
                view === v ? 'text-white' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {view === v && (
                <motion.span
                  layoutId="view-pill"
                  className="absolute inset-0 rounded-lg"
                  style={{ background: 'var(--accent)' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative">{v}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ---------- active view ---------- */}
      {/* CSS entrance (see .page-enter) — throttle-proof view switching */}
      <div key={viewKey} className="page-enter">
        {view === 'month' && <MonthView />}
        {view === 'week' && <WeekView />}
        {view === 'day' && <DayView />}
      </div>
    </div>
  )
}
