# QuestCal widgets

Glanceable QuestCal on your iPhone Home/Lock Screen and your MacBook desktop.

They lead with **UP NEXT** — the next thing you actually have to do, with how
soon it is ("now", "in 15 min", "in 3h", "tomorrow 08:00", "Sun") — followed by
the ones after it, plus your rank, level, XP bar and streak.

Both widgets read the **same cloud save** the app syncs to your private
`questcal-save` repo, so they always match whatever device you last used.
Neither one can change anything — they only read.

| File | Where it runs | App you need |
|---|---|---|
| `QuestCal-iPhone.js` | iPhone / iPad Home Screen + Lock Screen | [Scriptable](https://apps.apple.com/app/scriptable/id1405459188) (free) |
| `questcal-mac.jsx` | MacBook desktop | [Übersicht](https://tracesof.net/uebersicht/) (free) |

> **Why not a "real" Apple widget?** A native WidgetKit widget has to be
> compiled in Xcode on a Mac and re-signed every 7 days on a free Apple
> account. Scriptable and Übersicht give you the same result on your screen
> with no Xcode, no developer account, and no expiry.

## Both need your sync token

The one you pasted into **QuestCal → Settings → Cloud sync** (starts with
`github_pat_`). If you don't have it any more, make a new one at
[github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new):
*Only select repositories* → `questcal-save`, and **Repository permissions →
Contents → Read-only** is enough for widgets.

Each widget file has a `TOKEN = ''` line near the top — paste it between the
quotes. **These files then contain a credential, so don't share them or put
them in a public repo.**

## iPhone / iPad — Scriptable

1. Install **Scriptable** from the App Store.
2. Open it → tap **+** → delete the sample → paste all of `QuestCal-iPhone.js`.
3. Fill in `TOKEN`.
4. Tap the script title at the top and name it **QuestCal**.
5. Run it once (▶) — you should see a preview of the widget.
6. Long-press your Home Screen → **+** → **Scriptable** → choose a size →
   **Add Widget**.
7. Tap the new widget → set **Script: QuestCal** → done.

Lock Screen works too: long-press the Lock Screen → **Customise** → add a
Scriptable widget → pick this script. The rectangular size fits best.

**Bonus:** on macOS Sonoma or later, iPhone widgets show up on your Mac
automatically (same Apple ID, iPhone nearby) — so this one widget can cover
both screens without installing anything on the Mac.

## MacBook — Übersicht

1. Install **Übersicht** and launch it.
2. Menu bar → Übersicht → **Open Widgets Folder**.
3. Copy `questcal-mac.jsx` into that folder.
4. Open it in any text editor, fill in `TOKEN`, save — it reloads instantly.
5. Drag the widget anywhere on your desktop.

It refreshes every 5 minutes.

## What counts as "upcoming"

Anything **not yet completed** that is either later today or on a future day.
So:

- Something running right now (started, but its duration hasn't run out) shows
  as **now** — it stays visible while you're in it.
- Finished quests disappear from the list the moment you tick them off.
- Once today is done, the widget rolls straight on to tomorrow.
- **Past, never-completed quests are not shown.** They'd pile up forever and
  bury what's actually next. Today's progress is still visible as `TODAY 1/6`.

## Notes

- The iPhone widget keeps a local copy of the last save, so it still shows
  something when you're offline (marked *"offline — showing last synced save"*).
- iOS decides when widgets actually refresh; roughly every 15 minutes is
  normal, and it may be slower on Low Power Mode.
- Tapping the iPhone widget opens the QuestCal web app.
- The game maths in these files (level curve, ranks, streak) is a copy of
  `src/game/xp.js` and `src/game/ranks.js`. If you ever retune
  `src/game/config.js`, update the copies here too.
