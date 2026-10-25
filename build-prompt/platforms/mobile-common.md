# Mobile common (Android and iOS)

Both mobile targets are **Capacitor** apps. They run the shared UI and Store in the system WebView, with a host core
in the same page and native plugins for files, notifications, sharing and the badge. Read this file, then
`android.md` or `ios.md`.

## Stack

- Capacitor **7** (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android` / `@capacitor/ios`). Pin the latest 7.x
  you can install and record it. The plugins, pinned the same way:
  - `@capacitor/filesystem`, `@capacitor/local-notifications`, `@capacitor/app`, `@capacitor/share`,
    `@capacitor/browser`, `@capacitor/preferences` (only for a "first run" flag);
  - `@capawesome/capacitor-file-picker` (import, restore from a file, choose a sound);
  - `@capawesome/capacitor-badge`;
  - `@capacitor/background-runner` (a periodic job that tops up the scheduled notifications).
- `esbuild` (pinned) bundles `src/core/store.js` + ical.js + `src/host/core.js` + `src/host/capacitor.js` into
  `www/host.js` (IIFE, ES2020). The UI files are copied to `www/` unchanged, apart from what this file adds.
- No other runtime dependencies. No network access.

## 1. Host core: `src/host/core.js`

Extract the platform-neutral half of `reference/source/src/main.js` into a module with **no Electron or Node
imports**: the file handling (load, save, backups, unreadable files, the archive-to-list move, restore), `state.json`, settings
defaults and upgrades, the alarm engine (`checkAlarms`, snooze, dismiss, quick alarms, suspend), the pop-up data
(`todayAndUpcoming`), the tooltip labels (unused on mobile, keep them for parity), import/export, and every `window.rf`
call from PROMPT §5. It takes an **adapter**:

```js
createHost({
  platform,                       // 'android' | 'ios' (desktop could use 'windows'… if you also refactor main.js)
  files: {                        // paths relative to the app's data folder
    read(name) → Promise<string|null>, write(name, text) → Promise (atomic: write name.tmp then rename),
    exists(name), list(dir) → [{name, size, mtime}], remove(name), copy(from, to), readBase64(name), writeBase64(name, b64)
  },
  dialogs: {
    pickFiles({title, accept, multiple}) → [{name, text}] | null,   // import, restore from a file
    saveText({title, defaultName, text}) → string|null,           // export, backup copy (share sheet / save)
    pickSound() → {name, base64, ext} | null
  },
  notify: { schedule([{id, at, title, body, sound, actionTypeId, extra}]), cancel(ids), pending() → ids, onAction(fn) },
  badge(n), openUrl(url), now(), setTimer(fn, ms) → handle, clearTimer(handle),
  emit(channel, payload)          // window.rf.on(...) listeners in the same page
}) → rf                           // the object assigned to window.rf (same names, same results, all Promise-returning)
```

Desktop must still pass all its tests with the reference `main.js`. Refactoring desktop onto `core.js` is optional.

`src/host/capacitor.js` implements the adapter with the plugins:

- **Files** in `Directory.Data` (app-private), encoding UTF-8. `write` writes `<name>.tmp`, then `rename`s it.
- **Dialogs**: `FilePicker.pickFiles` for import, restore and sound. Export and "Save a backup copy…" write the file to
  `Directory.Cache` and open `Share.share({files:[uri]})`, so the user can save it to Files or Drive or send it.
- **Notifications**: below.
- **Badge**: `Badge.set({count})`; clear on 0.
- **Links and maps**: `Browser.open({url})`.
- **App lifecycle**: `App.addListener('resume')` → `checkAlarms()` + reschedule; `'pause'` → reschedule;
  `'backButton'` → close the top dialog, the context sheet, or go back to the Reminders tab, else minimize.

`src/host/mock.js` implements the same adapter in memory, with a controllable clock and a notification recorder, for
tests in a desktop browser (§6).

## 2. Alarms on mobile: notifications are the alarm window

A mobile app isn't running most of the time, so alarms must be **scheduled notifications**, computed by the host core
whenever it runs.

- **Schedule**: on start, resume, pause, every data or settings change, and from the background runner (every ~6 h,
  best effort). Cancel what's pending and schedule every alarm fire in the next **14 days**. Query
  `store.alarms(dayStart, dayStart + 1 day)` **day by day**, because to-do plans return only the latest fire per window.
  Include quick alarms and snoozes, and skip dismissed keys. Cap at the platform's limit (Android 400; iOS 60, plus one
  "Open ReminderFoxAgain to keep your reminders coming" notification at the time of the 60th). Notification id = a
  stable 31-bit hash of the alarm key; `extra = {key}`.
- **Content**: title = the summary (★ prefix if important). Body = the when-line in words, as the alarm card has it
  ("Today, 2:30 PM · Yonge & Eglinton", "To-do · due by Thu, Oct 29"), then the first line of the notes.
- **Sound**: the chosen built-in sound (`reference/assets/sounds/<alarmTone>.wav` / `.caf`: chime, bell, marimba,
  beeps, clock — bundled as native resources), or the user's chosen sound when `alarmTone` is `file`, copied into the
  native sound folder at choose time, or silent when `alarmSound` is off. `resoundMinutes` > 0 → also schedule repeats
  of the same notification every N minutes, up to 3 times, cancelled by any action on it. `resoundMinutes` -1
  ("Continuously until cleared"): on Android use an insistent notification (`FLAG_INSISTENT` on a channel with that
  sound) cancelled by any action on it; on iOS, which has no looping notification sound, schedule the notification
  every minute for 30 minutes (inside the 64-notification limit) and cancel the rest on any action; while the app is in
  the foreground the alarm sheet loops the sound exactly as the desktop alarm window does.
- **Actions** (action type `alarm`): **Snooze** (the default snooze: store `snoozed[key]` and schedule a notification at
  the new time), **Done** (complete), **Open** (foreground: open the editor). Tapping the notification opens the app
  on the **Due now** sheet.
- **Due now sheet**: the in-app equivalent of the alarm window. It lists the same cards (`alarm.js` logic mounted in a
  bottom sheet: when-line, location, notes, amount + unit + Snooze, Open, Done, Dismiss; footer Snooze all, Dismiss
  all). It opens on launch and resume whenever `alarmState()` has due alarms. On phones, the snooze controls may wrap
  onto two rows.
- **Suspend**: schedule nothing before the end of the suspension. "Until resumed" schedules nothing. Resume
  reschedules.
- **Reminder pop-up** (slider): when enabled, show the "Today & upcoming" sheet on app open (at most every
  `sliderEvery` minutes), and schedule a **daily summary notification** at 8:00 ("Today: 3 reminders — Dentist 2:30 PM,
  …") that opens that sheet. Corner and keep-open settings don't apply.
- **Badge**: the count per `badge` setting, updated whenever the host runs; on iOS also set on the summary
  notification.
- **Permissions**: ask for notification permission (and Android exact alarms) on first launch, after a one-screen
  explanation. If refused, show a persistent banner in Settings → Alarms with a button to open the system settings.

## 3. Feature mapping

| Desktop feature | Mobile |
| --- | --- |
| Tray, tray tooltip, keep running in tray, start with the OS, pop-up corner | Not shown (Settings hides them via `meta().platform`) |
| Alarm window | Notifications + the Due now sheet |
| Pop-up | Today & upcoming sheet + daily summary notification |
| Count on the icon | App icon badge |
| Import from ReminderFox (profile scan, and the list names from the profile's `prefs.js`) | Welcome page and Settings → Data offer **Import a reminderfox.ics or other calendar file…** (file picker; also lets the user pick the profile's `prefs.js` to bring the add-on's list names) with help text: "Copy reminderfox.ics from your computer's Firefox or Thunderbird profile ('reminderfox' folder) to this phone, then choose it here." |
| Open data folder / Open backups folder | Replaced by **Share the data file…** and the Restore dialog's list |
| Export, Save a backup copy | Share sheet |
| Custom sound | File picker; copied for notifications |
| Text size | Setting × the OS text scale (respect `prefers-reduced-motion` too) |
| Keyboard shortcuts | Kept for hardware keyboards; never shown in tooltips on phones |
| Right-click menu | Long-press (500 ms) opens the same menu as a bottom **action sheet** (with Duplicate, Move to list…, Copy to list…) |
| Drag to reorder (My order) | Long-press the row's handle (≡) then drag; Move up / Move down stay in the menu |
| Double-click | Single tap opens the editor on phones (tap the checkbox to tick) |

## 4. Phone layout: `src/ui/mobile.css` and `src/ui/mobile.js`

Load both on mobile builds only, after `themes.css` and after `features.js`. They must not change the desktop look.
Tablets (shortest side ≥ 720 px) keep the desktop layout with the calendar panel shown, plus touch sizes. Phones
(< 720 px wide) get the following, with ids, wording and colours kept:

- **Safe areas**: pad with `env(safe-area-inset-*)`. Make tap targets ≥ 44×44 px. Inputs use 16 px text, so iOS
  doesn't zoom.
- **Top bar**: the brand icon and "ReminderFox**Again**" (shortened to the icon below 360 px), then icon buttons: search
  (expands to a full-width field), ⏰ Quick alarm, ⚙ Settings. "＋ Reminder" and "＋ List Item" become a **floating action
  button** (＋) at the bottom right that opens a two-item menu. The FAB is hidden while a dialog is open.
- **Tabs** scroll sideways and stay sticky. The ◧ panel toggle is hidden.
- **Toolbars** wrap onto two lines. The hint moves under them.
- **Lists**: hide the `thead`. Each `tr[data-key]` becomes a card (CSS grid): checkbox | title, sub-line and flags |
  date (Today/Tue, Oct 27) over time on the right, then a second line with ↻ repeat, category chips and 🔔. Month
  separator rows become sticky headers with the count. The starred colour bar stays on the left edge.
- **Calendar panel** is hidden. On phones the **Month** tab shows the mini month (full width, from `renderSide`, with
  the months setting) above the selected day's agenda, instead of the 6-week chip grid. Swipe left/right changes the
  month. Tablets keep the grid.
- **Dialogs** (editor, settings, every manager and picker) open full screen: a header with ✕/Cancel, the title, and
  the primary action (Save, Done…), a scrolling body, and no footer bar. The Settings section switcher becomes a
  scrollable segmented row. Confirm and message dialogs stay centred cards.
- **Lists**: the List dropdown (the Lists tab) is a native picker in the scrolling tab row; the "Selected item" row becomes a
  sticky bottom bar (Duplicate · Move to… · Copy to… · Delete) while a card is selected, above the FAB.
- **Context menu** → bottom action sheet, with a Cancel row.
- **Toasts** sit above the FAB.
- **Language**: the system locale is `navigator.language` (Android `Locale.getDefault()`, iOS `Locale.preferredLanguages[0]`
  when the WebView differs); the host core gives the same `i18n` object to the page before the UI scripts run, and a
  language change reloads the WebView. Native notification texts and action buttons ("Snooze", "Done") use `tr()` too.
  Date and time pickers follow the OS language, not the app setting; say so in the build README.
- **Due now** and **Today & upcoming** are bottom sheets with a grab handle, which can be dismissed by swiping down.

## 5. Mobile-specific checks

- Unit tests in seven zones, and the compatibility benchmark (unchanged).
- **Host-core tests** (`test/host-core.test.js`, Node + `mock.js`), at least these 20: load and save atomically;
  unreadable file kept; daily backup rotation (30); manual backup / restore / undo with the safety copy; an old archive moves into the "Terminated or Suspended" list with a backup first; settings defaults and upgrades; notification schedule for the next 14 days
  (reminder alarms, carried RUC items, a daily to-do plan → one per day, quick alarms, snoozes); dismissed keys
  skipped; suspend for 2 h schedules nothing before the end; "until resumed" schedules nothing; the iOS cap (60 + the
  "open the app" notice); snooze from a notification action; Done from an action ticks the occurrence; resound repeats
  cancelled by an action; badge counts; daily summary text.
- **UI checks in a browser**: serve `www/` with `mock.js` as the host and run the shared `tools/ui/*.js` scripts with
  Playwright (Chromium, `/opt/pw-browsers` if present) at 1180×760 (desktop parity: every existing script must pass) and
  at 390×844 and 820×1180 (`tools/ui/mobile-*.js`, at least 25 checks): FAB menu, card layout (no horizontal scroll at
  320 px), sticky month headers with counts, long-press action sheet, full-screen editor with Save in the header, phone
  Month tab (mini month + agenda, swipe), Due now sheet actions, permission banner, hidden desktop-only settings, share
  export path, file-picker import.
- **Screenshots** at 390×844 (light, dark and high contrast) of: Upcoming, To-Do's, Month, the editor (reminder and
  to-do with a plan), Settings → Alarms, the Due now sheet, the action sheet, Welcome. Deliver them with the build. They
  must use the same wording and colours as the desktop screenshots.
