# Notes App — Changelog

Newest first. Add a new entry at the top with every commit (copy the template at the bottom).

## Roadmap (not built yet)

- **Android app** (Capacitor, loads this site so web updates arrive automatically; APK installed once)
- **Reminder notifications** with two buttons: *Mark as done* and *Reschedule* (opens the app on that task's time picker)
- **Native Google sign-in** in the Android app (no more login popups)
- Optional "10 minutes before" reminder per task
- Hour-grid day view (day view is currently a time-ordered list)
- Clean-up of old deleted items in `notes.json`
- 12-hour clock option

## v0.4 — Shortcuts list, To-Do notes, simpler task window

**Added**
- `Esc` shortcuts list is grouped: General, Notes, Calendar. The section for the current view comes first (left pane first in split view).
- Keys written as text (`Alt+Up`, `Tab+Enter`, `Delete`).
- **To-Do folder**: always on top, bold, accent colour; can't be renamed, moved or deleted.
- Tasks link to notes: **Details** button (or `o` in calendar) opens the task's note in split view; note heading follows the task title.
- Task notes hide once the task is done, deleted or past; they reappear only while the calendar is open on that date.
- Calendar has its own brighter palette per theme.
- Two new themes: **Forest**, **Dusk** (four total).

**Changed**
- Task window simplified: title, date, from/to time, **Repeats?** button, 7 day buttons, "Repeat for N weeks" (default 1). `Enter` saves from anywhere.
- Any task can be turned into a repeating one when editing.
- `Tab+Enter` in split view closes the split and keeps the focused pane. `Tab+Left/Right` moves focus in split view.
- Removed the "Esc · controls" header hint (now the first line of the shortcuts list).

**Removed**
- Per-day time boxes for repeating tasks (shift single days in the day view with `Alt+Up/Down`).

## v0.3 — Calendar & tasks

**Added**
- Calendar with **month / week / day** views (`m`, `w`, `d`).
- Tasks with date and from/to time; repeating on chosen weekdays; each day is its own task.
- Day view: `Alt+Up/Down` shifts a task by 15 minutes; `x` done, `e` edit, `n` new, `Delete` remove.
- Navigation: arrows, `[` `]`, `t` for today, `Enter` to open a day.
- `Tab+Enter` switches Notes / Calendar; `Tab+Left/Right` opens both side by side.
- Phone: bottom Notes / Calendar bar, swipe to change period, tap a day to open it.
- Tasks sync to Google Drive in the same `notes.json`.

## v0.2 — Phone polish and desktop feel

**Added**
- Phone: clear headings, folder chip row, note chip row, Android back button steps through levels.
- Laptop: resizable columns (drag the dividers, remembered per device), soft hover glow.
- App-like touch behaviour (no tap flash, no pull-to-refresh).

**Fixed**
- Cursor no longer jumps into the note when a sync finishes while a menu or prompt is open.

## v0.1 — First version

- Notes in folders, manual ordering, themes (Midnight, Gruvbox).
- Keyboard-first: `Esc` menu, `n` / `f` / `r` / `d`, `Alt+Up/Down` reordering.
- Works offline (service worker), installable on phone and laptop.
- Syncs to Google Drive (`notes.json`, `drive.file` scope); newest edit per item wins.
- Hosted on GitHub Pages.

## Known limits

- Sync runs while the app is open or reopened; browsers don't allow true background sync when closed.
- Google login tokens last about an hour; the app renews them, occasionally needs one tap on the `!` icon.
- Same note edited on two devices before syncing: newest edit wins.

---

### Template for a new entry

```
## vX.Y — Short title
**Added** / **Changed** / **Fixed** / **Removed**
- what changed
```
