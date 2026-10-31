# Build ReminderFoxAgain 0.9.2

> **TARGET PLATFORM:** `windows` ← change this word to `windows`, `linux`, `macos`, `android` or `ios` before sending.
> If it is missing or unclear, ask the user which one, once, before doing anything else.

Build **ReminderFoxAgain 0.9.2** for the target platform above: an app for reminders, to-dos and pop-up alarms that
is a tribute to the original **ReminderFox** add-on for Firefox and Thunderbird (https://github.com/tommut/reminderfox),
created by Tom Mutdosch and Daniel Lee with Guenter Wahl. Honour its work: it must read and write ReminderFox's own
iCalendar file so its users keep everything they built up, refer to it warmly in the UI and docs ("the original
ReminderFox add-on", never "old" or "obsolete"), keep the thanks in Settings → General → About and the README,
and it must offer every feature listed here with the same look, wording and behaviour on every platform.

This file is the platform-neutral specification. After reading it, read **`platforms/<target>.md`**. It says how the
app is hosted, packaged, installed and tested on that platform, and which parts of this file it overrides. Mobile
targets also read `platforms/mobile-common.md`. Where the platform file and this file disagree, the platform file wins.
Where both are silent, the reference source (below) decides.

## 0. What comes with this prompt

| Path | Use |
| --- | --- |
| `reference/source/` | The complete source of ReminderFoxAgain 0.9.2 (Windows, macOS and Linux from one source): `src/` (store, main process, preload, UI), `test/` (36 unit tests: 31 for the Store, 5 for the translations; two add-on fixtures and an add-on profile's `prefs.js`), `tools/` (sample data, UI checks, screenshot scripts, installer tests, and `tools/i18n/`: the string catalog, the 33 translation sources and the locale builder), `installer/`, `build.sh`, `package.json`, `package-lock.json`, `README.md` (full release notes 0.2.4–0.8.1). **This is the behavioural reference.** Reuse it: the Store (`src/core/store.js`) and the UI (`src/ui/*`) are platform-neutral and must be shared unchanged where possible; the host layer (`src/main.js`, `src/preload.js`) is what changes per platform. |
| `reference/screenshots/*.png` | 70 screenshots of every screen, dialog, theme and the alarm and pop-up windows, made from `tools/sample-data.js` with a 1180×760 main window. The target look on desktop. Mobile layouts follow `platforms/mobile-common.md`. |
| `reference/assets/` | App icon (`icon.png` 256 px, `icon.ico` 16–256 px, `tray.png` 32 px), vector masters (`svg/`), and every platform's icon set already made: `png/` (16–1024 px), `linux/hicolor/…`, `macos/icon.icns` + `trayTemplate.png`/`@2x`, `ios/AppIcon-1024.png` (opaque, full bleed), `android/` (adaptive foreground/background, legacy mipmaps, white notification icons, Play Store 512 px). `sounds/<id>.wav` and `<id>.caf` are the five built-in sounds (chime, bell, marimba, beeps, clock) as files, rendered by `tools/sounds.js` (for notification sounds). |
| `reference/fixtures/` | `reminderfox-addon-sample.ics` and `reminderfox-addon-full.ics`, plus `reminderfox-addon-prefs.js` (the add-on's list names, as its profile's `prefs.js` holds them; the UI checks put it beside a copy of the full file) and `archive-sample.ics` (an archive.ics as 0.2.6–0.5.0 left it, for the archive-to-list check): files written the way the add-on writes `reminderfox.ics`. Unit-test fixtures and the compatibility benchmark. |

If anything in the screenshots and this text disagree, this text wins.

**Work method.** Start by building and running the reference source on Linux (it runs there unchanged: `npm ci && npm
test && tools/e2e.sh`), so you have a working oracle. Then build the target. Keep the Store, the UI and the tests shared.
Port the host. Run the shared tests against your build, and compare its screenshots with the reference. Don't
re-design: same element ids, classes, wording, colours and behaviour.

---

## 1. The product in one page

- **Reminders** happen at a time: a date (and time or all day), an optional end, repeats, an alarm, a category, a
  location, a link and notes. They can be starred (important), marked "remind me daily until completed", and ticked
  per occurrence.
- **To-dos** have to be done **by** a date (or have no date). Their reminders are a **plan**: remind me (on the due
  date / N days before / from a date) at a time, then once or every day / 2 days / week / 2 weeks / month, until it's
  done, optionally also after the due date. To-dos live in **lists** ("To-Do's" is the main list, plus the user's own), shown one at a time and picked in the
  **List dropdown**, which is itself a tab. Items in a list can be added, **duplicated**, **moved** or **copied** to another
  list and deleted; to-dos can be put in **my order**, flagged "show in the tray tooltip", and converted to a reminder once their date is known
  (**Schedule as a reminder…**).
- **Lists and saved filters.** Reminders tab: Upcoming, Today, Next 7 days, Selected day, Selected month, All reminders, Past,
  Important, plus **saved filters** (the add-on's views: conditions and a relative date range; "Manage reminders…").
  **Show completed** in the Reminders, Month and Lists toolbars; the columns of the Reminders tab and the lists are
  chosen in Settings → Display (0.8.0). Future lists show **every date
  of repeating reminders** for the next 12 months (setting). All and Past show every past date, ticked or not. Month
  headings show a count. Month tab (calendar grid), calendar panel (1–3 mini months, agenda, overdue marks). There is no Archive tab:
  items kept for reference go on a list ("Terminated or Suspended").
- **Alarms**: the alarm window (snooze for N seconds/minutes/hours or until a time, Open, Done, Dismiss, Snooze all,
  Dismiss all), the reminder pop-up ("alert slider"), quick alarms, suspend alarms, five built-in sounds or the user's file, repeated every N minutes or
  continuously until the alarm is dealt with, a
  count on the tray/taskbar icon, a templated tray tooltip.
- **Data**: the add-on's `.ics` format (unknown properties survive), import/export, daily, manual and
  before-restore backups, restore with a safety copy, unreadable files kept.
- **Languages** (0.7.0): the same 34 languages as the original add-on (English plus 33 translations), following the
  system language by default, with a Language setting; Arabic and Hebrew right to left.
- **Look**: six themes (Default, Fox, Light, Dark, Ocean, High contrast), starred colour, text size 90–150 %, date and
  time formats, keyboard shortcuts throughout.

## 2. Architecture (all platforms)

```
UI (src/ui: index.html, alarm.html, slider.html, styles.css, themes.css, common.js, app.js, features.js, alarm.js, slider.js)
   │  window.rf — the bridge contract (§5): promise-returning calls + events
Host (desktop: Electron main + preload · mobile: host core in the WebView + native plugins)
   │  owns files, settings, alarm engine, notifications, tray/badge, dialogs
Store (src/core/store.js on ical.js 2.2.1) — the calendar model, no platform code
   │
Files: reminders.ics · state.json · sounds/ · backups/ (archive.ics only as left by earlier versions)
```

- The **Store** is the only code that touches iCalendar. It has no Electron, DOM or Node-only dependencies except
  `crypto.randomUUID()` (available in Node 22 and every WebView this targets).
- The **UI** talks only to `window.rf` (§5) and must not know which host it runs on, except through `meta().platform`
  (§5.1), which hides desktop-only settings on mobile.
- The **host** implements `window.rf` exactly. On desktop that is the Electron main process plus `src/preload.js`. On
  mobile, `platforms/mobile-common.md` asks you to extract the platform-neutral half of `src/main.js` into
  `src/host/core.js` with an adapter interface, and run it inside the WebView.

## 3. Data layer: `src/core/store.js`

Exports `{ setPhrases, Store, DEFAULT_LIST, describeRecur, dayKey, timeKey, parseCalendars, expandAges, normRemind, remindFirst,
remindAt, REMIND_STEPS }`. `DEFAULT_LIST` is `"To-Do's"`. Reuse the reference file. If you rewrite it, keep every
behaviour below and pass all 30 Store unit tests unchanged. `setPhrases({t, weekday, month, monthDay, date})` lets the host give the
Store the current language's text function and date formatters, so `describeRecur` and `repeatText` come out translated
(null members = English).

### 3.1 The file is the source of truth

- `new Store(text)` keeps the parsed **ical.js components** and edits them in place. Properties it doesn't understand
  survive load → edit → save. Never rebuild an item from a DTO.
- Parse tolerantly: strip a BOM, normalise line endings, drop blank lines, ignore text before `BEGIN:VCALENDAR`, merge
  several VCALENDARs, register every VTIMEZONE. Non-calendar text throws `Error('This file does not contain any
  iCalendar data (no BEGIN:VCALENDAR).')`.
- Items are indexed by UID: `{master, exceptions[]}` (exceptions = components with RECURRENCE-ID).
- `toString()` writes CRLF. PRODID `-//ReminderFoxAgain//ReminderFoxAgain 0.2//EN`. Every edit sets `DTSTAMP`,
  `LAST-MODIFIED` (from `store.clock` when set, for tests) and increments `SEQUENCE`. New UIDs are
  `<crypto.randomUUID()>@reminderfoxagain`. Edited times are floating local time. Zoned imports show in local time and
  report `timezone`.

### 3.2 Properties

| Concept | iCalendar |
| --- | --- |
| Reminder / to-do | VEVENT / VTODO (a to-do may have no DTSTART/DUE) |
| Title, notes, location, link | SUMMARY, DESCRIPTION, LOCATION, URL; `<1960>` in SUMMARY shows as "66th", `<1960#>` as "66" (per occurrence year) |
| All-day | VALUE=DATE; DTEND exclusive in the file, inclusive in the DTO |
| Repeat | RRULE (+EXDATE, RECURRENCE-ID exceptions). Editable subset below; anything else is `{custom:true, rrule}`, labelled "Custom (…)", written back verbatim |
| Categories | CATEGORIES (merged with X-REMINDERFOX-CATEGORIES on read; written as one CATEGORIES) |
| Important | written PRIORITY:1; read PRIORITY 1–4 or X-REMINDERFOX-PRIORITY:1 |
| Reminder completion | X-REMINDERFOX-COMPLETED:YYYYMMDD ("done through") and X-REMINDERFOX-DONE;X-COMPLETED-AT=<UTC>:YYYYMMDD per occurrence |
| To-do completion | STATUS:COMPLETED + COMPLETED + PERCENT-COMPLETE:100; a repeating to-do advances DTSTART/DUE instead |
| To-do list | X-REMINDERFOX-LISTID (absent = "To-Do's") |
| Remind daily until completed | X-REMINDERFOX-REMIND-UNTIL-COMPLETED: 1 waiting, 2 carrying a missed occurrence |
| Show in tooltip | X-REMINDERFOX-SHOW-IN-TOOLTIP (to-dos) |
| E-mail link | X-REMINDERFOX-MESSAGEID (kept, not used) |
| Manual order | X-APPLE-SORT-ORDER (1, 2, 3…) |
| Alarm | first VALARM: relative TRIGGER → `{minutes}` (minutes before start; all-day "9:00 on the day" = −540, "the day before at 9:00" = 900); RELATED=END or absolute → `{keep:true, text}` (left untouched on save) |
| To-do reminder plan | X-REMINDERFOXAGAIN-REMIND:`start=before;days=7;at=09:00;every=day;overdue=0` or `start=date;date=YYYY-MM-DD;…`; steps once, day, 2days, week, 2weeks, month; written only for **repeating** plans, beside a standard VALARM (absolute first trigger, REPEAT/DURATION for day/week steps up to the due date or 30). A one-time "N days before" plan is written as an ordinary relative VALARM with no plan property, so add-on files stay in add-on form |
| Archive marks (archive.ics only) | X-REMINDERFOXAGAIN-ARCHIVED (UTC), X-REMINDERFOXAGAIN-ARCHIVE-REASON |

Repeat shape: `{freq:'DAILY'|'WEEKLY'|'MONTHLY'|'YEARLY', interval, byday[], mode:'date'|'weekday', nth:1..4|-1, wd,
end:'never'|'until'|'count', until, count}`. `describeRecur` texts: "Daily", "Every 3 days", "Weekly on Tue, Thu, 8
times", "Every 2 weeks on Thu", "Every weekday", "Monthly on day 14", "Monthly on the last Tue", "Yearly on Oct 24",
"Yearly on the 2nd Mon of Oct", "Daily, until 2026-12-31".

### 3.3 DTO and rows

DTO: `{uid, kind, summary, notes, location, url, categories[], important, allDay, date, time, endDate, endTime, repeat,
repeatText, alarm, remind, timezone, completed, completedDate, doneLog, list, untilDone, showInTooltip, display,
archivedAt, archiveReason, order}`. On a to-do, `date` is the **due-by** date.

Occurrence row: `{uid, kind, summary, start, end, date, time, allDay, repeating, repeatText, important, categories,
hasAlarm, completed, completedAt, notes, location, list, untilDone, showInTooltip}`, plus `past`, `history`, `carried`,
`overdueSince` and `occStart` where they apply.

### 3.4 Methods (all exist in the reference)

`list, get, count, categories, todoLists, upsert, setCompleted (→ 'advanced' for repeating to-dos), remove (item or one
occurrence via EXDATE), occurrences(from,to,{includeTodos,now}), nextOccurrences(from,{count,until,now}) (the next
count occurrences starting before until, default 366 days, the next one always), completedHistory(before,{since})
(without since: every occurrence up to the last ticked one; with since: every occurrence from since, ticked or not, plus
older ticked ones; at most 2,000 per item), alarms(from,to,{now}) (key 'uid|occStart|fireAt'; to-do plans give only the
latest fire in the window, key 'uid|dueMs|fireAt'), syncUntilDone, tooltipTodos, categoryCounts, listCounts,
renameCategory (to '' deletes), renameList, moveToList (a to-do: only X-REMINDERFOX-LISTID changes and it leaves the old
list's order; an event becomes a to-do), duplicate(uid,{list,suffix}) (an exact copy of master and exceptions under a new
UID, completion and archive marks cleared; on `list`, or right after the original in My order), removeListItems(name),
setOrder, extract/insert (move an
item whole with its zones), finishedBefore, import(text,{duplicates,category}) (merge by UID; replace only when the incoming LAST-MODIFIED is newer;
`duplicates:'skip'` leaves out a new UID whose title (trimmed, spaces collapsed, lower case) and start day match an item
you have, or one imported earlier in the same call; `category` adds that category to every added or updated item)
→ {added, updated, skipped, duplicates (only when skipping)}, previewImport(text) → {events, todos, existing (same UID),
duplicates (same title and date, new UID)}, export({kinds, uids}), toString`. The host's import adds `lists` (names added from an
add-on profile's `prefs.js` two folders up from the file: `user_pref("extensions.reminderFox.todoLists", "A,B")`).

### 3.5 Behaviours

- **Completion of reminders**: as the add-on: done-through date plus per-day DONE entries. Un-ticking one day inside the
  through range converts the others to DONE entries first. After any change, recompute the through date.
- **Remind until completed**: a flagged occurrence that passed unticked is carried to today (`carried`,
  `overdueSince`) and alarms daily. Flag 1 picks up a miss in the last 90 days (for repeating reminders only one after
  LAST-MODIFIED). Flag 2 carries whatever its age. `syncUntilDone` keeps 1/2 in step. Ticking the carried row ticks
  the original occurrence.
- **To-do plans**: fire k is computed on the local wall clock (days are calendar days; a month step keeps the day or
  uses the month's last day). Fires run from the first reminder to the end of the due date, or indefinitely with
  `overdue=1`, and stop when the to-do is done. "Before" without a due date becomes "from today".

## 4. Host responsibilities (platform-neutral; desktop reference: `src/main.js`)

### 4.1 Files

Data folder per platform (see the platform file), overridable with env `RF_DATA_DIR` on desktop. It holds
`reminders.ics`, `archive.ics`, `state.json`, `sounds/alarm-sound.<ext>` and `backups/`. Every write is atomic (write
`<file>.tmp`, then rename). Every data change: back up if needed, save, broadcast `data:changed`, refresh the
tray/badge, re-check alarms.

- **Unreadable** `reminders.ics` → keep it as `reminders.ics.unreadable[-n]`, start empty, report `loadError`
  "Your reminders file could not be read (<message>). It was kept as reminders.ics.unreadable." An unreadable archive
  is kept the same way and blocks every archive write with a clear message.
- **Backups**: daily `reminders-YYYY-MM-DD.ics` and `archive-YYYY-MM-DD.ics` before the first write of a day (keep 30
  each); `manual-<stamp>.ics` (lists plus archive in one calendar, archived items keep their marks);
  `before-restore-<stamp>.ics`.
- **Import** (0.7.0): `previewImport(files)` totals the Store's `previewImport` over the files plus `{files (names),
  current (items you have)}`. `importPaths(files,{mode,duplicates,category})` first parses every file (one bad file
  changes nothing). `mode:'replace'` writes `backups/before-import-<stamp>.ics` (lists plus archive, labelled "Saved
  before an import replaced everything" in Restore), starts from an empty Store and imports with duplicates allowed;
  `mode:'add'` merges. A new category is added to `settings.categories`. Result `{added, updated, skipped, duplicates,
  lists, replaced:{count, safety}|null}`.
- **Restore** a backup: write `before-restore-…` first. `archive-*.ics` replaces only the archive. A backup with archived
  items, or a manual or before-restore one, replaces both. Anything else replaces the lists. Then run `archiveToList()`. Result `{items, moved, list, safety}`.
- **Archive from earlier versions** (`archiveToList()`, on start and after every restore): if `archive.ics` has items,
  copy it to `backups/archive-before-list-<stamp>.ics`, then move each item into the lists (archive marks dropped) and
  onto the "Terminated or Suspended" list (`moveToList`: a reminder becomes a to-do), skipping UIDs already in the
  lists; write `reminders.ics` before `archive.ics`; add the list name to `settings.lists`; report the count as
  `meta().archiveMoved` (toast "N archived items moved to the “Terminated or Suspended” list" + Show).

### 4.2 `state.json`

`{settings, bounds, dismissed:{key:ms}, snoozed:{key:{until, alarm}}, quickAlarms:[{id,text,notes,at}],
suspend:{since,until|null}|null}`. Dismissed keys are pruned after 7 days. Settings defaults:

```
startWithWindows:true, closeToTray:true, weekStart:0, defaultAlarm:null, snoozeAmount:10, snoozeUnit:'minutes',
alarmSound:true, theme:'', soundFile:null, soundName:'', resoundMinutes:0, alarmTone:'chime',
sliderEnabled:false, sliderShow:'both', sliderEvery:60, sliderKeep:15, sliderCorner:'br', sliderSound:false,
upcomingDays:15, badge:'today', textSize:100, dateFormat:'', timeFormat:'', sidePanel:true, miniMonths:1,
mapService:'google', todayLabel:'[time]  [reminderDesc]', upcomingLabel:'[shortMonth] [date]  [reminderDesc]',
tooltipUpcoming:true, lists:[], categories:[], views:[], repeatAhead:'m12', pastRepeatDays:'all',
hideRepeating:false, hideCompleted:false, todoSort:'date', language:'',
remColumnsHidden:[], todoColumnsHidden:[], customThemes:[]
```

`language` is `''` (follow the system language) or a code from §6.13. 0.8.0: `alarmTone` is `chime|bell|marimba|beeps|clock`
or `file` (use `soundFile`; on load, a missing `alarmTone` becomes `file` when `soundFile` is set, else `chime`; choosing a
file sets `file`, and `soundData()` returns `null` unless the tone is `file`). `resoundMinutes` `-1` = continuously
(§6.8). `hideCompleted` is the Reminders toolbar's Show completed (inverted). The Month toolbar's Show completed is not a setting (0.8.1: ticked at every start;
a leftover `monthShowDone` from 0.8.0 is deleted on load). `customThemes` (0.8.1) holds your own themes (§6.11).
`remColumnsHidden` / `todoColumnsHidden` list hidden column ids (`chk imp date day time repeat cat alarm`; lists have no
`day`). `todoSort` is `manual|date|time|summary|important|completed|repeat|category|alarm`.

Upgrades on load: `snoozeMinutes` → amount + unit; theme "light" from before 0.2.4 → "fox" (`themeVersion:2`).

### 4.3 Alarm engine

`checkAlarms()` runs at start, every 15 s, after every change, after resume from sleep and after unlock. It also arms
exact timers for the next snooze end, quick alarm and end of suspension.

1. `syncUntilDone`. Then the Store's alarms for the last **48 hours** to now, so alarms missed while off still show.
2. Add due quick alarms (key `quick|<id>|<at>`).
3. Drop dismissed and still-snoozed keys. Add back snoozes that have ended, even if the item's alarm changed
   (`snoozed[key].alarm` keeps a copy).
4. Suspended → show nothing (what fell due shows after resuming). Otherwise new keys open or raise the alarm surface and
   ring.
5. Push the due list to the alarm surface (`alarms:update`) and refresh the tray tooltip and badge.

Snooze accepts whole seconds from 1 to 999 × 3600. "Until a time" is converted in the UI (earlier than now = tomorrow).
Done ticks the occurrence or to-do. A quick alarm's Done or Dismiss removes it.

### 4.4 Pop-up, tray tooltip, badge

- **Reminder pop-up** (alert slider): today's and upcoming (next `upcomingDays`) open items, at start (8 s) and every
  `sliderEvery` minutes when enabled, unless suspended or empty (unless forced). It closes after `sliderKeep` seconds
  unless hovered. Clicking an item opens it.
- **Tray tooltip**: today's reminders with `todayLabel`, then upcoming with `upcomingLabel` (if `tooltipUpcoming`),
  then "To-do  …" lines for show-in-tooltip to-dos. "— alarms off until …" when suspended. Cut to 127 characters.
  Variables: `[reminderDesc] [time] [timeUntil] [daysUntil] [longDay] [shortDay] [longMonth] [shortMonth] [numMonth]
  [date] [longYear] [shortYear]`.
- **Badge**: the count of today's (or today's and upcoming) open items. The main window draws it (a 32 px tray image
  and a 16 px overlay) and passes PNG data URLs to `setBadge`. Platforms without overlays use their native badge.

## 5. The bridge contract: `window.rf`

Every call returns a Promise. Errors reject with a readable message, which the UI shows via `guard()`. This is the full
list in `reference/source/src/preload.js`; every host must provide all of them (platform files say which ones are
no-ops or behave differently).

**Data**: `range(from,to,{includeTodos})`, `next(from,{count,until})`, `history(before,{tickedOnly})`, `all()`,
`get(uid)`, `save(dto)`, `remove(uid,occ)`, `complete(uid,done,occ)`, `moveToList(uid,list)`, `duplicate(uid,{list,suffix})`,
`setOrder(uids)`,
`meta()`.
**Lists/categories**: `renameList(from,to)`, `removeList(name,{deleteItems})`, `renameCategory(from,to)`.
**Settings/files**: `setSettings(patch)`, `importIcs()`, `importPath(p)`, `pickIcs(kind)` (`'any'`: one or more files,
`'old'`: one reminderfox.ics → paths or null), `previewImport(files)`, `importPaths(files,opts)` (§4.1), `exportIcs({kind})`, `findOld()`, `pickOld()`,
`openDataFolder()`, `openUrl(u)`, `chooseSound()`, `soundData()`, `backupNow(choose)`, `backupList()`,
`backupDescribe(file)`, `backupChoose()`, `backupRestore(file)`, `openBackups()`.
**Alarms**: `alarmState()`, `snooze(key,seconds)`, `dismiss(key)`, `dismissAll()`, `completeAlarm(key)`, `openAlarm(key)`,
`hideAlarm()`, `quickList()`, `quickAdd({text,notes,at})`, `quickRemove(id)`, `suspend(until|null|0)`, `suspended()`,
`sliderState()`, `showSlider()`, `closeSlider()`, `openFromSlider(uid,start)`, `setBadge(trayUrl,overlayUrl,text,count)`.
**Language** (synchronous, read once at page load): `i18n` = `{lang, dict, dateLocale, collect, systemLang}` and
`i18nMissing(text)` (records untranslated text when `RF_I18N_COLLECT` is set).
**Events** (`on(channel, fn)` → unsubscribe): `data:changed`, `settings:changed`, `alarms:update`, `alarms:ring`,
`ui:new {kind}`, `ui:edit {uid,start}`, `ui:quick`, `ui:suspend`, `slider:update`.

### 5.1 `meta()`

`{categories, todoLists, settings, suspend, listCounts, categoryCounts, dataFile, count, archiveCount, archiveFile,
loadError, version, archiveMoved, platform}`. **`platform`** is new in the multi-platform build:
`'windows'|'linux'|'macos'|'android'|'ios'`. The UI uses it only to hide or relabel platform-specific controls (§6.12).

## 6. The UI

Reuse `reference/source/src/ui/` (markup, `styles.css` (given, unchanged), `themes.css`, and the scripts). Every
screen in `reference/screenshots/` must look the same on desktop targets. Only the changes listed in §6.12 and the
platform files are allowed. Behaviour summary (the reference source is exact):

### 6.1 Main window

- Top bar: brand "ReminderFox**Again**", **＋ Reminder** (Ctrl+N) and **＋ List Item** (Ctrl+T, `#addTodo`), both `btn primary` (same orange), **⏰ Quick alarm** (Ctrl+Q),
  search (Ctrl+F), **⚙ Settings**. (Import and Export are in Settings → Data; Ctrl+I and Ctrl+E still work.)
- Tabs: Reminders (open count), the **List dropdown** (`div.tab.tab-list[data-tab=todos]` holding `select#todoList`), Month;
  ◧ toggles the calendar panel (Ctrl+B).
- Status bar: item count, version, "🔔 Alarms on" / "🔕 Alarms suspended until … · Resume", "Data file".
- Calendar panel: 1–3 mini months (prev/next on the outer ones), dots for open items (starred colour for important), a
  red mark under past days with an open to-do or remind-until-completed reminder, Today / Go to… (Ctrl+G) / Show day in
  list, and the day agenda.

### 6.2 Reminders tab

Show: Upcoming (default), Today, Next 7 days, Selected day, Selected month, All reminders, Past, Important, an optgroup
"Saved filters" (one option per saved filter, `view:<i>`), and "Manage reminders…" (0.8.0; it opens the saved filters
dialog). Category filter, then **Show completed** (`#remDone`, 0.8.0: ticked at first; toggling it keeps your place, §6.15; unticked hides ticked reminders
in every Show choice and in search, = `hideCompleted:true`; there is no "Hide completed reminders" setting any more).
Upcoming, All, Important, search and date-less saved filters project repeats per
`repeatAhead` (`m1|m3|m6|m12|m24` every date in N months, `n1|n2|n3|n5|n10` next N dates; default m12). All and Past
add past occurrences per `pastRepeatDays` (`all|730|365|90`). Saved filters without a date range use the older
ticked-only history. The hint for a saved filter reads "Saved filter “Name” · N reminders". Rows are oldest first, grouped by month (not in Selected day). **Each month heading shows "N reminders" on the
right.** The hint shows the range and count. On a filter's first visit, the list scrolls to the row nearest today
(Past: bottom). Afterwards it restores its position. Row flags: Overdue since…, Until done, Tooltip, 🔔 plan (to-dos).

### 6.3 Lists (0.5.0; dropdown in the tab bar since 0.6.0)

The **List dropdown** (`#todoList`) is the Lists tab itself: mousedown, or Enter/Space/arrow keys, on it switch to the
Lists view; picking a list shows it. It has its own box in the bar (`.tab-select`: card background, `--line-strong`
border, orange border and text while its list is shown, keeping the tab bar at 48 px). The chosen option reads "List:
Name (n)" (only the selected option carries the prefix; the others show plain names, from each option's `data-label`).
It holds an optgroup "Lists" with "To-Do's" and every
custom list as "Name (open count)", then "All lists (n)", a disabled separator, "＋ New list…" and "Manage lists…" (the
two actions run and put the dropdown back on the list shown). The list shown is remembered (localStorage `todoList`);
＋ List Item adds to it; an empty list says "“Name” is empty". All lists shows a "· Name" sub-label on rows. The toolbar has Category,
**Order** and then Show completed (0.8.0 order; toggling Show completed keeps your place, §6.15). Order (`#todoSort`) offers My order (drag rows or Alt+↑/↓), Due by
(the default), Time, Description, Important, Completed, Repeat, Category and Alarm: every column. Completed items stay
at the bottom, except with Completed, which lists them first (most recently completed on top); ties go by due date.
Time: timed items first, by time. Description: A–Z, locale-aware, numbers in order. Important, Repeat, Alarm: those with
it first (Repeat then by its text). Category: by the first category A–Z, uncategorised last. A second row (`#tbTodoActs`) always shows "Selected
item: Duplicate · Move to… · Copy to… · Delete" (greyed out until a row is selected) and the "n open · n done" hint, so
selecting never shifts the layout. Duplicate (also Ctrl+D and the menu) = `duplicate(uid,{suffix:' (copy)'})` with a
toast "Duplicated “…”" + "Edit the copy". Move to… / Copy to… open the list dialog (copy keeps the original; a reminder
can be copied to a list, becoming a to-do there). Removing a list that has to-dos asks "Move to “To-Do's”" (focused) or
"Delete list and to-dos". Import from an add-on profile also adds the lists named in its `prefs.js`
(`extensions.reminderFox.todoLists`), in order, and the import summary names them. There is no per-list tab and no
"Show each to-do list as its own tab" setting any more. Column "Due by". The 🔔 flag describes the plan ("daily from 7 d
before"). Repeating to-dos advance when ticked ("Done — moved to the next date").

### 6.4 Editor

Reminder/To-Do switch, title + ★, Date/Time/All day (to-dos: **Due by**, **Any time**, **No date**), Ends (reminders),
Repeat box with live summary, Alarm (reminders) or **Remind me** box (to-dos: start choice, date, at, then …, "until
it's done", "also after the due date", a summary line such as "Every day at 9:00 AM, from Tuesday, October 27, 2026,
until it's done or due (Nov 3)."). Then remind-until-completed (reminders) or show-in-tooltip (to-dos), Category (▾
picker), List, Location (🗺 map), Link (↗), Notes. Footer: Delete…, **Schedule as a reminder…**
(to-dos), Completed (to-dos), Cancel, Save (Ctrl+S). Age preview for `<1960>`. Validation toasts as in the reference.

### 6.5 Dialogs

Confirm/message (`#confirm`); **Import** (`#importDlg`, 0.7.0: every import — welcome page, Settings → Data, Ctrl+I,
the old-add-on finder — goes through it: the file names, "N reminders and N list items; N already here (the newer copy
is kept); N look like duplicates (same title and date as an item you have)", **How** = "Add to what I have" (default) or
"Replace everything (your N items are saved as a backup first)" (asks again, Cancel focused), **Duplicates** = "Skip
items with the same title and date as one I have" (default) or "Import them anyway" (disabled with Replace),
**Category** = a text box with the known categories as suggestions, empty = none); Export; Settings (sections General, Alarms, Display, **View** (0.8.0, formerly Lists; `data-st="lists"` kept), Data); Quick
alarm; Suspend; **Manage reminders** (`#viewsDlg`, 0.8.0 wording: title "Manage reminders", "A saved filter shows just the
reminders you want in the Reminders tab…", "＋ New saved filter…", "No saved filters yet…", "Delete saved filter?") and
the saved filter editor (`#viewEdDlg`: "New saved filter" / "Edit saved filter"; no dialog text says "view"); Lists manager; Categories manager and picker; Move to list / Make it a to-do / Copy to list / Copy to a list; New list; **Schedule as
a reminder** (date, time or all day, alarm, keep repeating for repeating to-dos; toast "Now a reminder on …" with Show);
Go to date; Restore from a backup; ask-text. Ids, wording and behaviour are as
in `features.js` and `app.js`.

### 6.6 Month tab

A 6-week grid from the week-start day. The toolbar's **Show completed** (`#mDone`, 0.8.0; since 0.8.1 **ticked at every
start**, and unticking lasts until the app closes; kept in the window's state, not in settings) decides whether completed items show here: unticked, neither ticked reminder occurrences nor
completed list items appear; ticked, both do, struck through. **The calendar panel's mini months (dots, overdue marks)
and day agenda never show completed list items** (0.7.0); they stay in their list (Show completed). Chips: time, ☐ for to-dos, ★ for important, all-day solid, carried with a red
edge. As many chips as fit, then "+n more". Clicking edits, double-clicking adds a reminder, "+n more" shows that day
in the list, "Show to-dos" toggles to-dos.

### 6.7 No Archive tab (0.6.0)

There is no Archive tab, no Move to archive… (menu or editor), no Archive finished items… and no "The archive" export
choice. Items kept for reference go on a list; earlier versions' archives are moved there on start (§4.1).

### 6.8 Alarm window (`alarm.html`, `alarm.js`)

One card per due alarm: ★ + title, the when-line ("**Today, 12:46 PM** · in 4 min"; late: "started …"; all-day;
quick: "Quick alarm · set for …"; to-dos: "**To-do** · due by Thu, Oct 29" + "· overdue"), location and notes. Actions:
amount + unit (seconds, minutes, hours, until…) + Snooze, Open, Done, Dismiss. Footer: Snooze all <default>, Dismiss
all; "–" hides the window. The controls fit on one row at 500 px with up to three cards (a scrollbar showing). Sound:
the chosen built-in sound or the user's file, repeated every `resoundMinutes` while alarms are showing. With
`resoundMinutes:-1` ("Continuously until cleared", 0.8.0) it plays again 1.2 s after it ends, until you Snooze (a valid
amount), Open, Done or Dismiss any card, Snooze all, Dismiss all, hide the window ("–" or Esc), the list empties, or the
setting changes; the next alarm that arrives starts it again. `RF.playSound(url, tone)` resolves when the sound ends or
is stopped, `RF.stopSound()` stops it. Tests: `window.__rfAlarm.{ring, silence}` and `window.__rfRinging`.

### 6.9 Pop-up (`slider.html`, `slider.js`)

Title "Today · N reminders" or "Coming up", groups "Today · <date>" and "Next N days", × closes. It rings at most once
per show.

### 6.10 Welcome page

Shown when there are no items, nothing left in an old archive, and `welcomeDone` is unset. Subtitle "Your reminders, to-dos and alarms as a Windows app — a tribute to the
original ReminderFox add-on." Options: one per found add-on file ("Import from your ReminderFox add-on"), "Import a
reminderfox.ics or other calendar file…", "Start with an empty list" ("You can import later from Settings → Data.").

### 6.11 Themes, formats, keyboard

Six themes (`data-theme` on `<html>`), starred colour tokens `--imp*`, High contrast with larger text and heavier
lines, plus **your own themes** (0.8.1): `settings.customThemes` = `[{id, name, bg, surface, ink, accent, star}]` (five
`#rrggbb` colours) and `theme:'custom:<id>'`. `RF.applyTheme(id, customThemes, preview?)` sets `data-theme="custom"` and
writes every token inline on `<html>` from `RF.themeVars(t)`: surface-2/3 and lines are the surface mixed 5/9/11/22 %
toward the text; ink-2/3 the text mixed 28/46 % toward the background; fox-hover 12 % toward white (dark) or black;
fox-ink the accent if its contrast on the surface is ≥ 4.5, else mixed 40 % toward the text; soft tints the background
mixed toward the accent (15/7/22 % light, 28/14/36 % dark); `--on-accent` black or white, whichever contrasts more;
imp-ink and imp-soft likewise from the starred colour; `color-scheme` dark when the background's luminance is < 0.18.
A built-in theme removes the inline tokens. The alarm window and the pop-up pass `customThemes` too; the host sets the
native theme (dark/light) and window background from a custom theme's background. Settings → General: the Theme
select (built-ins, then an optgroup "Your themes"), a swatch per theme, then "＋ New theme…", "Edit…" and "Delete…"
(the last two only for your theme). The editor (`#themeDlg`): Name (required, unique, not a built-in name), "Start
from" (any theme; `RF.THEME_COLORS` for the built-ins, Default = Fox or Dark by the system), five rows of a colour
picker + a `#rrggbb` box (bad codes are marked and ignored) with a hint, a preview card, and WCAG warnings when text
on the background or lists is < 4.5:1, or the accent or starred colour on the lists is < 3:1. The whole window shows
the theme while editing; Cancel restores it, Save stores and chooses it. Delete asks first (Cancel focused) and falls
back to Default. Text size via zoom factor. Date formats `'' | dmy-text | iso | mdy | dmy | dmy-dot`, time `'' | 12 | 24`. Keys:
Ctrl+N, T, Q, F, G, B, I, E, S; Enter, Delete, ↑/↓, Alt+↑/↓, Esc.

### 6.12 Platform-dependent UI (the only allowed differences)

- Hide controls that have no meaning on the platform, using `meta().platform`. Desktop-only: start at login, keep
  running in the tray, pop-up corner, tray tooltip labels, "Open data folder" / "Open backups folder", import from old
  ReminderFox by profile scan. Relabel "Start ReminderFoxAgain when Windows starts" as "…when you log in" on Linux and
  macOS.
- Keyboard: on macOS show and accept ⌘ for every Ctrl shortcut (the reference already accepts `metaKey`). Quick alarm
  is ⇧⌘A on macOS, because ⌘Q quits.
- Mobile layout per `platforms/mobile-common.md`.

### 6.13 Languages (0.7.0)

The add-on's 34 languages: en, de, fr, es-ES, it, nl, pt-BR, pt-PT, ca-AD, gl-ES, sv-SE, da, nb-NO, fi, et-EE, hu-HU,
ru-RU, uk-UA, be-BY, pl, cs-CZ, sk-SK, ro-RO, tr, vi, zh-CN, zh-TW, ja-JP, ko-KR, ar, he-IL, mn-MN, ga-IE, fy-NL. Reuse
`src/ui/i18n.js`, `src/ui/i18n-dom.js`, `src/ui/locales/*.json` and `tools/i18n/` unchanged.

- **Choosing**: `resolve(setting, systemLocale)` — the setting if set, else the system locale matched exactly, then by
  base language (pt → pt-BR, zh-HK → zh-TW, nn/no → nb-NO), else English. The host sanitises the system locale first
  (`en-US@posix` → `en-US`, `_` → `-`, `Intl.getCanonicalLocales`, else `en`). Dates use the system locale when its
  base language matches the UI language, else the UI language. Settings → Display → **Language**: "System language
  (<native name>)" then every language under its own name (`translate="no"`), and the note "The translations were
  written for ReminderFoxAgain and have not yet been checked by native speakers." Changing it reloads the windows,
  rebuilds the tray menu and tooltip, and reopens Settings on Display.
- **Keys**: the English text is the key. A value may hold `{name}` placeholders (`{n}`, `{n2}` numbers; others any
  text, translated in turn), plural forms `one=… | few=… | other=…` picked with `Intl.PluralRules`, and ordinals under
  the key `{n}th`. Text the app puts together is split on "\n", " · " and "; ", after a leading symbol and before a
  trailing " (count)", and the parts translated.
- **Pages**: `i18n-dom.js` translates text nodes, `title`, `placeholder` and `aria-label` as they appear
  (MutationObserver), sets `<html lang dir>`, and skips user text (`[translate="no"]`, titles, chips, notes, textareas).
  Scripts use `RF.T(text, vars)` for composed text. Arabic and Hebrew get `dir="rtl"` and the RTL rules in `styles.css`.
- **Host**: `tr()` for the tray menu and tooltip, window and dialog titles, file filters and the balloon; `setPhrases`
  for the Store. Desktop sets Chromium's `--lang` from the chosen language before start-up so date and time pickers
  follow it (they change only at the next start); the build keeps the 30 matching locale `.pak` files.
- **Adding or fixing text**: `tools/i18n/catalog.txt` holds every key, numbered; each `<code>.txt` has the same numbered
  lines (`-` = keep English). `node tools/i18n/build.js` checks placeholders and braces and writes the JSON files;
  `--pseudo <code>` writes a pseudo-translation, and running the UI checks with `RF_I18N_COLLECT=<file>` lists any
  text still shown in English.

### 6.14 Columns, sounds (0.8.0)

- **Columns.** Settings → Display → Columns: two rows of ticks, "Reminders" (✓ Completed, ★ Important, Date, Day,
  Time, Description (always ticked, disabled), Repeat, Category, 🔔 Alarm) and "Lists" (the same with Due by and no
  Day). Unticking adds the column id to `remColumnsHidden` / `todoColumnsHidden`; the main window puts `hide-<id>`
  classes on `#listView` for the tab shown, and CSS hides those cells. The description takes the room.
- **Sounds.** `RF.TONES` in `common.js`: `chime` (Chime, 2.2 s, the former built-in), `bell` (Bell: a struck bell with
  inharmonic partials, twice, 3.2 s), `marimba` (Marimba: a rising C-E-G-C run, twice, 2 s), `beeps` (Digital beeps: two
  groups of four square-wave beeps, 1.7 s), `clock` (Alarm clock: fast triangle rings, 2.1 s). Each `draw(ctx, out, t0)`
  works in any AudioContext; `tools/sounds.js` renders them to `reference/assets/sounds/<id>.wav` (and `.caf`) for
  platforms that need sound files. Settings → Alarms → Sound is a select of the five plus "Your file: name" once one
  was chosen, then "Your own file…" and "▶ Test"; picking a sound plays it.

### 6.15 Keeping your place (0.8.1)

- **Show completed** in the Reminders toolbar and the Lists toolbar re-renders with `renderReminders('anchor')` /
  `renderTodos('anchor')`: `anchorOf()` notes the first row at least half below the column headings (its key, the keys
  after and before it, its date and its offset); `restoreAnchor()` scrolls so that row, else the next one still shown,
  else the first on or after its date, else the nearest one before it, sits where it was. Other refreshes keep the
  pixel position as before.
- **A day clicked in the mini calendar** (or its Today button) while the Reminders tab shows anything but Selected day /
  Selected month calls `scrollToDay(k)`: the first row whose day is on or after `k` goes to the top under the headings,
  with its month heading when it is the first of its month; no such row → the end of the list. The day is selected as
  before, and the position is remembered for that Show choice. Selected day / month still re-list that day or month.

### 6.16 Dates other programs write (0.9.1)

Some programs write a DATE or DATE-TIME value the JavaScript or e-mail way (`Tue Oct 20 2026 10:00:00 GMT-0400`,
`Tue, 20 Oct 2026 14:00:00 GMT`) or as `2026-10-20`. ical.js then stops the whole file with
`Could not extract integer from "Tue "`. Before parsing, unfold the lines and check every value whose type (its
`VALUE=` parameter, else the property's default type) is DATE or DATE-TIME, and a repeat rule's `UNTIL`. A value that
isn't iCalendar is read with `Date.parse` and written back as `20261020T140000Z` (a DATE as `20261020`; a value turned
to UTC loses its `TZID`). An unreadable one is left out with its line, so the rest of the file loads. This applies to
imports and to the reminders file itself. Unit test 31 checks it.

## 7. Tests (shared)

- **Unit** (`test/store.test.js`, 30 tests, and `test/i18n.test.js`, 5 tests, `node --test test/`), passing in TZ America/Toronto, UTC,
  America/Los_Angeles, Asia/Kolkata, Australia/Sydney, Pacific/Auckland and Pacific/Honolulu: field mapping, repeat
  summaries, Thanksgiving dates, completed-through, alarm timing, edit round trip, exclusive DTEND, advancing to-dos,
  import/export, zones, unknown properties, nextOccurrences, the non-calendar error, history, ages, remind-until-
  completed, tooltip to-dos, extract/insert, finishedBefore, occurrence counts, lists/categories/order, past repeats,
  projecting repeats, to-do plans, the fuller add-on file, duplicate/copy/move between lists, import options (duplicates, category, preview); language choice, complete locale
  files with matching placeholders, plurals and ordinals, composed text, translated repeat summaries.
- **Compatibility benchmark**: load both fixtures and confirm that items, occurrences over two years, alarms over 17
  months, import counts, re-import, export and the written file are identical to what `reference/source` produces
  (snapshot it first; the reference has `tools/`-style helpers you can copy).
- **UI checks** (`tools/e2e.sh` + `tools/ui/*.js`): scripts run inside the page and print `E2E name: got (expected
  want)`. None may print `WRONG` or `ERROR`. Desktop runs them in Electron under Xvfb; mobile runs them in Chromium with
  the mock host (see `platforms/mobile-common.md`).
  Desktop test hooks (environment variables read by the host): `RF_DATA_DIR` (data folder), `RF_SCREENSHOT=<out.png>` (save the main window, then quit), `RF_SCRIPT` /
  `RF_ALARM_SCRIPT` (a script run inside the main / alarm window), `RF_WINDOW_SIZE=WxH`, `RF_LANG=<code>` (force a language)
  and `RF_I18N_COLLECT=<file>` (append untranslated text). The language runs use `RF_LANG=de`, `RF_LANG=ar`,
  `LANG=fr_FR.UTF-8` (system language) and a pick in Settings that survives a restart. `tools/ui/view-options.js` checks the 0.8.0 toolbars, columns,
  View section, saved filter wording, Order and sounds; `tools/ui/alarm-continuous.js` (in the alarm window) the
  continuous sound; `tools/ui/place-themes.js` (bills sample, 0.8.1) keeping your place, the mini-calendar start and
  your own themes. The reference `main.js`
  shows exactly how each works.
- **Screenshots** (`tools/shots.sh`): compare with `reference/screenshots/` (same layout, colours and wording; dates
  differ).
- **Layout**: no sideways scroll at 820 (the smallest window), 990 and 1180 px, with or without the calendar panel and in
  every language (below 980 px the name beside the fox icon is hidden and the search box shrinks; up to 1100 px the
  header buttons sit a little closer); month cells never clipped; alarm controls on one row at 500 px.

## 8. Done when (all platforms)

- All 36 unit tests pass in the seven time zones. The compatibility benchmark is identical.
- The UI checks print no WRONG or ERROR. Screenshots match. The platform file's own checks pass.
- The platform file's deliverables exist, two builds in a row are identical where the platform file says they can be,
  and a `README.md` for the build says how to install, update and uninstall on that platform.
- Report what was tested where, and anything that could only be checked on the real device or OS (for example macOS
  or iOS runs when you work on Linux).
