// ============================================================
// QuestCal — iPhone / iPad widget  (for the free "Scriptable" app)
//
// Shows your rank, level, XP bar, streak and today's quests on the
// Home Screen or Lock Screen. Reads the same cloud save the app syncs.
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
  const today = dayKey(new Date())

  const todays = events
    .filter(e => e.date === today)
    .sort((a, b) => ((a.startTime || '99') < (b.startTime || '99') ? -1 : 1))

  return {
    ...lvl,
    totalXp,
    rank: rankForLevel(lvl.level),
    streak: calcStreak(events),
    todays,
    done: todays.filter(e => e.completed).length,
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

/** One "· 18:00  Title" row from today's list. */
function addQuestRow(stack, event, fontSize) {
  const row = stack.addStack()
  row.layoutHorizontally()
  row.centerAlignContent()

  const dot = row.addText(event.completed ? '✓' : '•')
  dot.font = Font.boldSystemFont(fontSize)
  dot.textColor = new Color(event.completed ? SUCCESS : ACCENT)
  row.addSpacer(5)

  if (event.startTime) {
    const time = row.addText(event.startTime)
    time.font = Font.mediumSystemFont(fontSize - 1)
    time.textColor = new Color(INK_MUTED)
    row.addSpacer(5)
  }

  const title = row.addText(event.title)
  title.font = Font.systemFont(fontSize)
  title.textColor = new Color(INK, event.completed ? 0.45 : 1)
  title.lineLimit = 1
}

// ---------- the widget layouts ----------

function buildSmall(w, d) {
  const head = w.addStack()
  head.layoutHorizontally()
  head.centerAlignContent()
  addRankBadge(head, d.rank, 13)
  head.addSpacer(6)
  const lv = head.addText(`LV ${d.level}`)
  lv.font = Font.boldSystemFont(15)
  lv.textColor = new Color(INK)
  head.addSpacer()
  if (d.streak > 0) {
    const fl = head.addText(`🔥${d.streak}`)
    fl.font = Font.mediumSystemFont(13)
    fl.textColor = new Color(GOLD)
  }

  w.addSpacer(8)
  w.addImage(barImage(d.progress, 130, 7))
  w.addSpacer(3)
  const xp = w.addText(`${d.into}/${d.needed} XP`)
  xp.font = Font.mediumSystemFont(10)
  xp.textColor = new Color(INK_MUTED)

  w.addSpacer(8)
  if (d.todays.length === 0) {
    const none = w.addText('Nothing scheduled')
    none.font = Font.systemFont(11)
    none.textColor = new Color(INK_MUTED)
  } else {
    for (const e of d.todays.slice(0, 3)) {
      addQuestRow(w, e, 11)
      w.addSpacer(3)
    }
    if (d.todays.length > 3) {
      const more = w.addText(`+${d.todays.length - 3} more`)
      more.font = Font.systemFont(10)
      more.textColor = new Color(INK_MUTED)
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
  left.size = new Size(120, 0)

  const head = left.addStack()
  head.layoutHorizontally()
  head.centerAlignContent()
  addRankBadge(head, d.rank, 15)
  head.addSpacer(6)
  const lv = head.addText(`LV ${d.level}`)
  lv.font = Font.boldSystemFont(18)
  lv.textColor = new Color(INK)

  left.addSpacer(8)
  left.addImage(barImage(d.progress, 118, 8))
  left.addSpacer(4)
  const xp = left.addText(`${d.into}/${d.needed} XP`)
  xp.font = Font.mediumSystemFont(11)
  xp.textColor = new Color(INK_MUTED)

  left.addSpacer(8)
  const streak = left.addText(d.streak > 0 ? `🔥 ${d.streak}-day streak` : 'No streak yet')
  streak.font = Font.mediumSystemFont(11)
  streak.textColor = new Color(d.streak > 0 ? GOLD : INK_MUTED)
  left.addSpacer()

  row.addSpacer(14)

  // --- right: today ---
  const right = row.addStack()
  right.layoutVertically()

  const label = right.addText(`TODAY · ${d.done}/${d.todays.length}`)
  label.font = Font.boldSystemFont(10)
  label.textColor = new Color(ACCENT)
  right.addSpacer(6)

  if (d.todays.length === 0) {
    const none = right.addText('Nothing scheduled, Student.')
    none.font = Font.systemFont(12)
    none.textColor = new Color(INK_MUTED)
  } else {
    for (const e of d.todays.slice(0, rows)) {
      addQuestRow(right, e, 12)
      right.addSpacer(4)
    }
    if (d.todays.length > rows) {
      const more = right.addText(`+${d.todays.length - rows} more`)
      more.font = Font.systemFont(11)
      more.textColor = new Color(INK_MUTED)
    }
  }
  right.addSpacer()
}

/** Lock Screen (rectangular): one tight line plus a bar. */
function buildAccessory(w, d) {
  const head = w.addStack()
  head.layoutHorizontally()
  head.centerAlignContent()
  const t = head.addText(`${d.rank.id} · LV ${d.level}`)
  t.font = Font.boldSystemFont(13)
  head.addSpacer()
  if (d.streak > 0) {
    const fl = head.addText(`🔥${d.streak}`)
    fl.font = Font.mediumSystemFont(12)
  }
  w.addSpacer(3)
  const sub = w.addText(
    d.todays.length ? `${d.done}/${d.todays.length} today · ${d.into}/${d.needed} XP`
                    : `${d.into}/${d.needed} XP`,
  )
  sub.font = Font.systemFont(11)
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
  else buildMedium(widget, data, family === 'large' ? 8 : 4)

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
