// ============================================================
// QuestCal — iPhone / iPad widget  (for the free "Scriptable" app)
//
// Shows what's coming up next, plus your rank, level, XP and streak.
// Reads the same cloud save the app syncs. Read-only: it never changes
// anything.
//
// SETUP (once):
//   1. Install "Scriptable" from the App Store.
//   2. Open it, tap + , delete the sample, paste this whole file.
//   3. Put your sync token in TOKEN below (the same github_pat_...
//      you pasted into QuestCal → Settings → Cloud sync).
//   4. Name the script "QuestCal" (tap the title at the top).
//   5. Long-press your Home Screen → + → Scriptable → pick a size →
//      Add Widget → tap the new widget → Script: QuestCal.
//
// Keep this script private: it contains your token.
// ============================================================

// ---------- SETTINGS — edit these two lines ----------
const TOKEN = ''                                  // e.g. 'github_pat_11A...'
const REPO = 'Euphrates-you/questcal-save'        // your private save repo
// -----------------------------------------------------

// Colours pulled from the app's "System" theme so the widget matches.
const INK = '#dbeaff'
const INK_MUTED = '#7e9cc4'
const ACCENT = '#38bdf8'
const GOLD = '#fbbf24'
const SUCCESS = '#34d399'

// Student ranks — same thresholds as the app (src/game/ranks.js)
const RANKS = [
  { id: 'E', min: 1, color: '#9aa7bd' },
  { id: 'D', min: 5, color: '#4ade80' },
  { id: 'C', min: 10, color: '#38bdf8' },
  { id: 'B', min: 15, color: '#a78bfa' },
  { id: 'A', min: 20, color: '#fb7185' },
  { id: 'S', min: 30, color: '#fcd34d' },
]

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ---------- game maths (mirrors src/game/xp.js) ----------

/** XP needed to climb from `level` to the next one. */
function xpForNextLevel(level) {
  return Math.round((100 * Math.pow(level, 1.5)) / 10) * 10
}

/** Turn lifetime XP into { level, into, needed, progress }. */
function levelFromTotalXp(totalXp) {
  let level = 1
  let remaining = Math.max(0, totalXp || 0)
  while (level < 99 && remaining >= xpForNextLevel(level)) {
    remaining -= xpForNextLevel(level)
    level++
  }
  const needed = xpForNextLevel(level)
  return { level, into: remaining, needed, progress: Math.min(1, remaining / needed) }
}

function rankForLevel(level) {
  let rank = RANKS[0]
  for (const r of RANKS) if (level >= r.min) rank = r
  return rank
}

/** 'yyyy-MM-dd' for a date, in LOCAL time (not UTC). */
function dayKey(date) {
  const pad = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 'HH:mm' -> minutes since midnight. Untimed entries sort to the end of a day. */
function toMinutes(hhmm) {
  if (!hhmm) return 24 * 60
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

/** Consecutive days (ending today or yesterday) with a completed entry. */
function calcStreak(events) {
  const days = new Set(
    events.filter(e => e.completed && e.completedDay).map(e => e.completedDay),
  )
  const today = dayKey(new Date())
  const yesterday = dayKey(new Date(Date.now() - 86400000))

  let cursor = days.has(today) ? today : days.has(yesterday) ? yesterday : null
  if (!cursor) return 0

  let streak = 0
  while (days.has(cursor)) {
    streak++
    const d = new Date(`${cursor}T12:00:00`) // midday avoids DST edge cases
    d.setDate(d.getDate() - 1)
    cursor = dayKey(d)
  }
  return streak
}

/** "in 25 min" / "now" / "today" / "tomorrow 19:00" / "Mon" / "08-04". */
function whenLabel(event, now) {
  const today = dayKey(now)
  const tomorrow = dayKey(new Date(now.getTime() + 86400000))

  if (event.date === today) {
    if (!event.startTime) return 'today'
    const mins = toMinutes(event.startTime) - (now.getHours() * 60 + now.getMinutes())
    if (mins <= 0) return 'now'
    if (mins < 60) return `in ${mins} min`
    return `in ${Math.round(mins / 60)}h`
  }
  if (event.date === tomorrow) {
    return event.startTime ? `tmrw ${event.startTime}` : 'tomorrow'
  }

  const target = new Date(`${event.date}T12:00:00`)
  const daysAway = Math.round((target - new Date(`${today}T12:00:00`)) / 86400000)
  if (daysAway <= 6) return WEEKDAYS[target.getDay()]
  return event.date.slice(5) // MM-DD
}

// ---------- loading the save ----------

const CACHE = FileManager.local().joinPath(
  FileManager.local().documentsDirectory(),
  'questcal-widget-cache.json',
)

/** Fetch save.json from the private repo; fall back to the last copy offline. */
async function loadSave() {
  if (!TOKEN) throw new Error('no-token')

  try {
    const req = new Request(`https://api.github.com/repos/${REPO}/contents/save.json`)
    req.headers = {
      Authorization: `Bearer ${TOKEN}`,
      // 'raw' gives us the file contents directly instead of base64 JSON
      Accept: 'application/vnd.github.raw',
      'X-GitHub-Api-Version': '2022-11-28',
    }
    const save = await req.loadJSON()
    FileManager.local().writeString(CACHE, JSON.stringify(save))
    return { save, stale: false }
  } catch (err) {
    // No signal / GitHub down: show the last save we successfully fetched.
    if (FileManager.local().fileExists(CACHE)) {
      return { save: JSON.parse(FileManager.local().readString(CACHE)), stale: true }
    }
    throw err
  }
}

/** Pull the handful of numbers the widget actually displays. */
function summarise(save) {
  const events = (save.calendar && save.calendar.events) || []
  const totalXp = (save.game && save.game.totalXp) || 0
  const lvl = levelFromTotalXp(totalXp)

  const now = new Date()
  const today = dayKey(now)
  const nowMins = now.getHours() * 60 + now.getMinutes()

  // Upcoming = not done yet, and either on a later day or still ahead
  // today (something in progress right now still counts).
  const upcoming = events
    .filter(e => !e.completed)
    .filter(e =>
      e.date > today ||
      (e.date === today &&
        (!e.startTime || toMinutes(e.startTime) + (e.durationMin || 0) >= nowMins)))
    .sort((a, b) =>
      a.date === b.date
        ? toMinutes(a.startTime) - toMinutes(b.startTime)
        : (a.date < b.date ? -1 : 1))
    .map(e => ({ ...e, when: whenLabel(e, now) }))

  const todays = events.filter(e => e.date === today)

  return {
    ...lvl,
    totalXp,
    rank: rankForLevel(lvl.level),
    streak: calcStreak(events),
    upcoming,
    todayDone: todays.filter(e => e.completed).length,
    todayTotal: todays.length,
  }
}

// ---------- drawing helpers ----------

function background() {
  const g = new LinearGradient()
  g.colors = [new Color('#0b1530'), new Color('#0a0d24'), new Color('#170f38')]
  g.locations = [0, 0.5, 1]
  g.startPoint = new Point(0, 0)
  g.endPoint = new Point(1, 1)
  return g
}

/** A rounded XP bar drawn as an image (crisper than nested stacks). */
function barImage(progress, width, height) {
  const dc = new DrawContext()
  dc.size = new Size(width, height)
  dc.opaque = false
  dc.respectScreenScale = true

  const track = new Path()
  track.addRoundedRect(new Rect(0, 0, width, height), height / 2, height / 2)
  dc.addPath(track)
  dc.setFillColor(new Color('#ffffff', 0.15))
  dc.fillPath()

  const filled = Math.max(height, width * Math.min(1, Math.max(0, progress)))
  const fill = new Path()
  fill.addRoundedRect(new Rect(0, 0, filled, height), height / 2, height / 2)
  dc.addPath(fill)
  dc.setFillColor(new Color(GOLD))
  dc.fillPath()

  return dc.getImage()
}

/** Rank letter in a tinted rounded chip. */
function addRankBadge(stack, rank, size) {
  const badge = stack.addStack()
  badge.backgroundColor = new Color(rank.color, 0.18)
  badge.cornerRadius = 6
  badge.setPadding(2, 7, 2, 7)
  const t = badge.addText(rank.id)
  t.font = Font.boldSystemFont(size)
  t.textColor = new Color(rank.color)
}

/** Section heading, e.g. "UP NEXT" with "TODAY 1/4" on the right. */
function addLabelRow(stack, left, right) {
  const row = stack.addStack()
  row.layoutHorizontally()
  const l = row.addText(left)
  l.font = Font.boldSystemFont(9)
  l.textColor = new Color(ACCENT)
  if (right) {
    row.addSpacer()
    const r = row.addText(right)
    l.lineLimit = 1
    r.font = Font.boldSystemFont(9)
    r.textColor = new Color(INK_MUTED)
  }
}

/** The headline "what's next" block: title, then time + how soon. */
function addNextBlock(stack, event, titleSize) {
  const title = stack.addText(event.title)
  title.font = Font.boldSystemFont(titleSize)
  title.textColor = new Color(INK)
  title.lineLimit = 2
  title.minimumScaleFactor = 0.85

  stack.addSpacer(3)

  const sub = stack.addStack()
  sub.layoutHorizontally()
  sub.centerAlignContent()
  if (event.startTime) {
    const time = sub.addText(event.startTime)
    time.font = Font.mediumSystemFont(12)
    time.textColor = new Color(INK_MUTED)
    sub.addSpacer(6)
  }
  const chip = sub.addStack()
  chip.backgroundColor = new Color(ACCENT, 0.18)
  chip.cornerRadius = 5
  chip.setPadding(2, 6, 2, 6)
  const when = chip.addText(event.when)
  when.font = Font.boldSystemFont(10)
  when.textColor = new Color(ACCENT)
}

/** A quieter follow-up row: "19:00  English Hagwon        tmrw". */
function addUpcomingRow(stack, event, fontSize) {
  const row = stack.addStack()
  row.layoutHorizontally()
  row.centerAlignContent()

  const time = row.addText(event.startTime || '—')
  time.font = Font.mediumSystemFont(fontSize - 0.5)
  time.textColor = new Color(INK_MUTED)
  row.addSpacer(6)

  const title = row.addText(event.title)
  title.font = Font.systemFont(fontSize)
  title.textColor = new Color(INK, 0.92)
  title.lineLimit = 1

  row.addSpacer()

  const when = row.addText(event.when)
  when.font = Font.systemFont(fontSize - 1)
  when.textColor = new Color(INK_MUTED)
  when.lineLimit = 1
}

function addAllClear(stack, size) {
  const t = stack.addText('All clear ✓')
  t.font = Font.boldSystemFont(size)
  t.textColor = new Color(SUCCESS)
  const s = stack.addText('Nothing left scheduled.')
  s.font = Font.systemFont(size - 3)
  s.textColor = new Color(INK_MUTED)
}

// ---------- the widget layouts ----------

function buildSmall(w, d) {
  const head = w.addStack()
  head.layoutHorizontally()
  head.centerAlignContent()
  addRankBadge(head, d.rank, 12)
  head.addSpacer(5)
  const lv = head.addText(`LV ${d.level}`)
  lv.font = Font.boldSystemFont(14)
  lv.textColor = new Color(INK)
  head.addSpacer()
  if (d.streak > 0) {
    const fl = head.addText(`🔥${d.streak}`)
    fl.font = Font.mediumSystemFont(12)
    fl.textColor = new Color(GOLD)
  }

  w.addSpacer(6)
  w.addImage(barImage(d.progress, 130, 6))

  w.addSpacer(10)
  addLabelRow(w, 'UP NEXT', d.todayTotal ? `${d.todayDone}/${d.todayTotal}` : null)
  w.addSpacer(4)

  if (d.upcoming.length === 0) {
    addAllClear(w, 13)
  } else {
    addNextBlock(w, d.upcoming[0], 14)
    if (d.upcoming.length > 1) {
      w.addSpacer(7)
      addUpcomingRow(w, d.upcoming[1], 10.5)
    }
  }
  w.addSpacer()
}

function buildMedium(w, d, rows) {
  const row = w.addStack()
  row.layoutHorizontally()

  // --- left: your character ---
  const left = row.addStack()
  left.layoutVertically()
  left.size = new Size(112, 0)

  const head = left.addStack()
  head.layoutHorizontally()
  head.centerAlignContent()
  addRankBadge(head, d.rank, 14)
  head.addSpacer(5)
  const lv = head.addText(`LV ${d.level}`)
  lv.font = Font.boldSystemFont(17)
  lv.textColor = new Color(INK)

  left.addSpacer(8)
  left.addImage(barImage(d.progress, 110, 7))
  left.addSpacer(4)
  const xp = left.addText(`${d.into}/${d.needed} XP`)
  xp.font = Font.mediumSystemFont(10.5)
  xp.textColor = new Color(INK_MUTED)

  left.addSpacer(6)
  const streak = left.addText(d.streak > 0 ? `🔥 ${d.streak}-day streak` : 'No streak yet')
  streak.font = Font.mediumSystemFont(10.5)
  streak.textColor = new Color(d.streak > 0 ? GOLD : INK_MUTED)

  if (d.todayTotal > 0) {
    left.addSpacer(4)
    const prog = left.addText(`Today ${d.todayDone}/${d.todayTotal} done`)
    prog.font = Font.systemFont(10.5)
    prog.textColor = new Color(INK_MUTED)
  }
  left.addSpacer()

  row.addSpacer(14)

  // --- right: what's coming ---
  const right = row.addStack()
  right.layoutVertically()

  addLabelRow(right, 'UP NEXT')
  right.addSpacer(5)

  if (d.upcoming.length === 0) {
    addAllClear(right, 15)
  } else {
    addNextBlock(right, d.upcoming[0], 15)
    const rest = d.upcoming.slice(1, 1 + rows)
    if (rest.length) {
      right.addSpacer(9)
      for (const e of rest) {
        addUpcomingRow(right, e, 11.5)
        right.addSpacer(4)
      }
      const remaining = d.upcoming.length - 1 - rest.length
      if (remaining > 0) {
        const more = right.addText(`+${remaining} more`)
        more.font = Font.systemFont(10)
        more.textColor = new Color(INK_MUTED)
      }
    }
  }
  right.addSpacer()
}

/** Lock Screen (rectangular): the next thing, and how soon. */
function buildAccessory(w, d) {
  if (d.upcoming.length === 0) {
    const t = w.addText(`LV ${d.level} · all clear`)
    t.font = Font.boldSystemFont(13)
    const s = w.addText('Nothing left scheduled')
    s.font = Font.systemFont(11)
    return
  }
  const next = d.upcoming[0]

  const head = w.addStack()
  head.layoutHorizontally()
  head.centerAlignContent()
  const time = head.addText(next.startTime || 'today')
  time.font = Font.boldSystemFont(13)
  head.addSpacer(5)
  const when = head.addText(next.when)
  when.font = Font.systemFont(12)
  head.addSpacer()

  const title = w.addText(next.title)
  title.font = Font.mediumSystemFont(13)
  title.lineLimit = 1

  const sub = w.addText(`LV ${d.level}${d.streak > 0 ? ` · 🔥${d.streak}` : ''}`)
  sub.font = Font.systemFont(10)
}

/** Anything went wrong → say what to do about it. */
function buildMessage(w, title, body) {
  const t = w.addText(title)
  t.font = Font.boldSystemFont(14)
  t.textColor = new Color(INK)
  w.addSpacer(4)
  const b = w.addText(body)
  b.font = Font.systemFont(11)
  b.textColor = new Color(INK_MUTED)
}

// ---------- run ----------

const family = config.widgetFamily || 'medium'
const accessory = family.startsWith('accessory')
const widget = new ListWidget()

if (!accessory) {
  widget.backgroundGradient = background()
  widget.setPadding(14, 14, 14, 14)
}

try {
  const { save, stale } = await loadSave()
  const data = summarise(save)

  if (accessory) buildAccessory(widget, data)
  else if (family === 'small') buildSmall(widget, data)
  else buildMedium(widget, data, family === 'large' ? 7 : 3)

  if (stale && !accessory) {
    const note = widget.addText('offline — showing last synced save')
    note.font = Font.systemFont(9)
    note.textColor = new Color(INK_MUTED, 0.8)
  }
} catch (err) {
  if (err.message === 'no-token') {
    buildMessage(widget, 'QuestCal', 'Add your sync token at the top of this script.')
  } else {
    buildMessage(widget, 'QuestCal', "Couldn't reach your save. Check the token and repo name.")
  }
}

// Refresh roughly every 15 minutes (iOS decides the exact timing).
widget.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000)
// Tapping the widget opens the app.
widget.url = 'https://euphrates-you.github.io/questcal/'

Script.setWidget(widget)
// Running the script inside Scriptable shows a preview:
if (!config.runsInWidget) await widget.presentMedium()
Script.complete()
