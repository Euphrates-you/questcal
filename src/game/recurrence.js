// ============================================================
// RECURRENCE — turns "every Monday for 8 weeks" into real dates.
//
// QuestCal stores plain dated entries (no hidden repeat rules), so
// repeating just means creating several entries at once. They share a
// `seriesId` so the app can offer "delete the whole series" later.
// ============================================================
import { addDays, format, parseISO, isWeekend } from 'date-fns'

export const REPEAT_OPTIONS = [
  { id: 'none', label: "Doesn't repeat" },
  { id: 'daily', label: 'Every day' },
  { id: 'weekdays', label: 'Every weekday (Mon–Fri)' },
  { id: 'weekly', label: 'Every week' },
  { id: 'biweekly', label: 'Every 2 weeks' },
]

export const MAX_OCCURRENCES = 52
export const DEFAULT_OCCURRENCES = 8

const STEP_DAYS = { daily: 1, weekly: 7, biweekly: 14 }

/**
 * Expand a start date into the list of dates to create.
 * The start date is always included exactly as picked, even for
 * 'weekdays' — surprising the user by moving their date would be worse.
 *
 * @param {string} startDate 'yyyy-MM-dd'
 * @param {string} repeat    one of REPEAT_OPTIONS ids
 * @param {number} count     how many entries in total
 * @returns {string[]} 'yyyy-MM-dd' dates, in order
 */
export function expandRepeat(startDate, repeat, count) {
  const total = Math.max(1, Math.min(MAX_OCCURRENCES, Math.floor(count) || 1))
  if (repeat === 'none' || !repeat || total === 1) return [startDate]

  const dates = [startDate]
  let cursor = parseISO(startDate)

  while (dates.length < total) {
    if (repeat === 'weekdays') {
      // walk forward to the next Mon–Fri
      do { cursor = addDays(cursor, 1) } while (isWeekend(cursor))
    } else {
      cursor = addDays(cursor, STEP_DAYS[repeat] ?? 7)
    }
    dates.push(format(cursor, 'yyyy-MM-dd'))
  }
  return dates
}
