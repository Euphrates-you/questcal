// ============================================================
// QuestCal — MacBook desktop widget (for the free "Übersicht" app)
//
// Sits on your desktop showing what's coming up next, plus your rank,
// level, XP and streak. Reads the same cloud save the app syncs.
// Read-only: it never changes anything.
//
// SETUP (once):
//   1. Install Übersicht: https://tracesof.net/uebersicht/
//   2. Menu bar → Übersicht → Open Widgets Folder
//   3. Copy this file into that folder.
//   4. Put your sync token in TOKEN below (the same github_pat_...
//      you pasted into QuestCal → Settings → Cloud sync), and save.
//   5. Drag the widget anywhere on your desktop.
//
// Keep this file private: it contains your token.
// ============================================================

// ---------- SETTINGS — edit these two lines ----------
const TOKEN = ''                                // e.g. 'github_pat_11A...'
const REPO = 'Euphrates-you/questcal-save'      // your private save repo
// -----------------------------------------------------

// Übersicht runs this shell command and hands us the output.
// `--fail` makes curl print nothing on an HTTP error so we can detect it.
export const command = TOKEN
  ? `curl -sf -H "Authorization: Bearer ${TOKEN}" ` +
    `-H "Accept: application/vnd.github.raw" ` +
    `-H "X-GitHub-Api-Version: 2022-11-28" ` +
    `https://api.github.com/repos/${REPO}/contents/save.json`
  : `echo ""`

export const refreshFrequency = 5 * 60 * 1000 // every 5 minutes

// ---------- game maths (mirrors src/game/xp.js) ----------

const RANKS = [
  { id: 'E', min: 1, color: '#9aa7bd' },
  { id: 'D', min: 5, color: '#4ade80' },
  { id: 'C', min: 10, color: '#38bdf8' },
  { id: 'B', min: 15, color: '#a78bfa' },
  { id: 'A', min: 20, color: '#fb7185' },
  { id: 'S', min: 30, color: '#fcd34d' },
]

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const xpForNextLevel = (level) => Math.round((100 * Math.pow(level, 1.5)) / 10) * 10

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

const rankForLevel = (level) =>
  RANKS.reduce((best, r) => (level >= r.min ? r : best), RANKS[0])

/** 'yyyy-MM-dd' in LOCAL time. */
function dayKey(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 'HH:mm' -> minutes since midnight. Untimed entries sort to the end of a day. */
function toMinutes(hhmm) {
  if (!hhmm) return 24 * 60
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

function calcStreak(events) {
  const days = new Set(
    events.filter((e) => e.completed && e.completedDay).map((e) => e.completedDay),
  )
  const today = dayKey(new Date())
  const yesterday = dayKey(new Date(Date.now() - 86400000))
  let cursor = days.has(today) ? today : days.has(yesterday) ? yesterday : null
  if (!cursor) return 0

  let streak = 0
  while (days.has(cursor)) {
    streak++
    const d = new Date(`${cursor}T12:00:00`)
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
    return event.startTime ? `tomorrow ${event.startTime}` : 'tomorrow'
  }

  const target = new Date(`${event.date}T12:00:00`)
  const daysAway = Math.round((target - new Date(`${today}T12:00:00`)) / 86400000)
  if (daysAway <= 6) return WEEKDAYS[target.getDay()]
  return event.date.slice(5) // MM-DD
}

/** Not done yet, and either later today (in-progress counts) or a future day. */
function upcomingFrom(events, now) {
  const today = dayKey(now)
  const nowMins = now.getHours() * 60 + now.getMinutes()
  return events
    .filter((e) => !e.completed)
    .filter(
      (e) =>
        e.date > today ||
        (e.date === today &&
          (!e.startTime || toMinutes(e.startTime) + (e.durationMin || 0) >= nowMins)),
    )
    .sort((a, b) =>
      a.date === b.date
        ? toMinutes(a.startTime) - toMinutes(b.startTime)
        : a.date < b.date
          ? -1
          : 1,
    )
    .map((e) => ({ ...e, when: whenLabel(e, now) }))
}

// ---------- look ----------

export const className = `
  left: 40px;
  top: 40px;
  width: 300px;
  padding: 18px 18px 16px;
  border-radius: 16px;
  color: #dbeaff;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
  background:
    radial-gradient(120% 90% at 85% 0%, rgba(56,189,248,0.20), transparent 60%),
    radial-gradient(110% 90% at 0% 100%, rgba(167,139,250,0.18), transparent 60%),
    linear-gradient(150deg, #0b1530, #0a0d24 55%, #170f38);
  border: 1px solid rgba(96,165,250,0.28);
  box-shadow: 0 18px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(219,234,255,0.10);
  -webkit-backdrop-filter: blur(14px);

  .qc-head { display: flex; align-items: center; gap: 8px; }
  .qc-rank {
    font-size: 15px; font-weight: 700; line-height: 1;
    padding: 4px 8px; border-radius: 7px;
  }
  .qc-lv { font-size: 19px; font-weight: 700; letter-spacing: 0.02em; }
  .qc-streak { margin-left: auto; font-size: 13px; font-weight: 600; color: #fbbf24; }
  .qc-streak.off { color: #7e9cc4; font-weight: 500; }

  .qc-track {
    margin-top: 12px; height: 8px; border-radius: 99px;
    background: rgba(255,255,255,0.14); overflow: hidden;
  }
  .qc-fill {
    height: 100%; border-radius: 99px;
    background: linear-gradient(90deg, #fbbf24, #f0a3c8);
  }
  .qc-xp { margin-top: 5px; font-size: 11px; color: #7e9cc4; font-variant-numeric: tabular-nums; }

  .qc-label {
    margin-top: 16px; display: flex; align-items: baseline;
    font-size: 10px; font-weight: 700; letter-spacing: 0.22em; color: #38bdf8;
  }
  .qc-label .qc-today { margin-left: auto; letter-spacing: 0.12em; color: #7e9cc4; }

  /* the headline "what's next" card */
  .qc-next {
    margin-top: 8px; padding: 10px 12px; border-radius: 11px;
    background: rgba(56,189,248,0.10);
    border: 1px solid rgba(56,189,248,0.28);
  }
  .qc-next-title { font-size: 14.5px; font-weight: 650; line-height: 1.25; }
  .qc-next-sub { margin-top: 5px; display: flex; align-items: center; gap: 8px; }
  .qc-next-time { font-size: 12px; color: #7e9cc4; font-variant-numeric: tabular-nums; }
  .qc-chip {
    font-size: 10.5px; font-weight: 700; color: #38bdf8;
    background: rgba(56,189,248,0.18); border-radius: 5px; padding: 2px 7px;
  }

  .qc-list { margin-top: 9px; display: flex; flex-direction: column; gap: 6px; }
  .qc-row { display: flex; align-items: baseline; gap: 8px; font-size: 12.5px; }
  .qc-time { color: #7e9cc4; font-variant-numeric: tabular-nums; font-size: 11.5px; min-width: 38px; }
  .qc-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .qc-when { margin-left: auto; color: #7e9cc4; font-size: 11px; white-space: nowrap; }

  .qc-clear { margin-top: 8px; font-size: 14px; font-weight: 700; color: #34d399; }
  .qc-empty, .qc-msg { font-size: 12px; color: #7e9cc4; margin-top: 6px; line-height: 1.5; }
`

export const render = ({ output }) => {
  if (!TOKEN) {
    return (
      <div>
        <div className="qc-head"><span className="qc-lv">QuestCal</span></div>
        <div className="qc-msg">Add your sync token near the top of this widget file.</div>
      </div>
    )
  }

  let save
  try {
    save = JSON.parse(output)
  } catch (e) {
    return (
      <div>
        <div className="qc-head"><span className="qc-lv">QuestCal</span></div>
        <div className="qc-msg">Couldn't reach your save. Check the token and repo name.</div>
      </div>
    )
  }

  const now = new Date()
  const events = (save.calendar && save.calendar.events) || []
  const lvl = levelFromTotalXp(save.game && save.game.totalXp)
  const rank = rankForLevel(lvl.level)
  const streak = calcStreak(events)

  const upcoming = upcomingFrom(events, now)
  const next = upcoming[0]
  const rest = upcoming.slice(1, 5)

  const today = dayKey(now)
  const todays = events.filter((e) => e.date === today)
  const done = todays.filter((e) => e.completed).length

  return (
    <div>
      <div className="qc-head">
        <span
          className="qc-rank"
          style={{ color: rank.color, background: `${rank.color}2e` }}
        >
          {rank.id}
        </span>
        <span className="qc-lv">LV {lvl.level}</span>
        <span className={streak > 0 ? 'qc-streak' : 'qc-streak off'}>
          {streak > 0 ? `🔥 ${streak}` : 'no streak'}
        </span>
      </div>

      <div className="qc-track">
        <div className="qc-fill" style={{ width: `${Math.round(lvl.progress * 100)}%` }} />
      </div>
      <div className="qc-xp">{lvl.into}/{lvl.needed} XP</div>

      <div className="qc-label">
        <span>UP NEXT</span>
        {todays.length > 0 ? (
          <span className="qc-today">TODAY {done}/{todays.length}</span>
        ) : null}
      </div>

      {!next ? (
        <div>
          <div className="qc-clear">All clear ✓</div>
          <div className="qc-empty">Nothing left scheduled.</div>
        </div>
      ) : (
        <div>
          <div className="qc-next">
            <div className="qc-next-title">{next.title}</div>
            <div className="qc-next-sub">
              {next.startTime ? <span className="qc-next-time">{next.startTime}</span> : null}
              <span className="qc-chip">{next.when}</span>
            </div>
          </div>

          {rest.length > 0 ? (
            <div className="qc-list">
              {rest.map((e) => (
                <div className="qc-row" key={e.id}>
                  <span className="qc-time">{e.startTime || '—'}</span>
                  <span className="qc-title">{e.title}</span>
                  <span className="qc-when">{e.when}</span>
                </div>
              ))}
              {upcoming.length - 1 > rest.length ? (
                <div className="qc-empty">+{upcoming.length - 1 - rest.length} more</div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
