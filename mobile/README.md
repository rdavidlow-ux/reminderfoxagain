# ReminderFoxAgain for Android (test branch `new/android-test`)

ReminderFoxAgain as an Android app for phones and tablets (Android 7.0 and later). It has the desktop app's features
(everything except those that need email), from the same pages (`src/ui`) and the same host core
(`src/host/core.js`) as the Thunderbird add-on, in a [Capacitor](https://capacitorjs.com) app.

What is different on Android:

- **A simple, streamlined design, with the Calendar first.** The app opens on the **Calendar** view: a small month on
  top (only the weeks it needs; a dot on days with something on them, a red dot when something there is overdue,
  today ringed) and the picked day's agenda under it. **List | Hours** switches the agenda between a list and the
  24 hours like a day planner, which opens at the time now with a line across it; the choice is remembered. A tap on
  an item opens it; a double tap in the hours adds a reminder at that time. There are no Month, Week or Day views,
  and no calendar panel beside the list. On a tablet the month and the agenda sit side by side.
- **Simpler editors.** A reminder shows its title, date and time, how it repeats and its alarm; a list item its title,
  due date, list, repeat and when to remind. The end time, "Remind me daily until completed", the category, place,
  link and notes are under **More options**, which opens by itself when the item has any of them. A new list item
  has no "Completed" or "Schedule as a reminder…" yet.
- **Alarms are notifications.** Every alarm of the next 14 days is scheduled as an Android notification, with
  **Snooze**, **Done** and **Open**, so it rings when the app is closed. They are scheduled again whenever reminders
  or settings change, and when the app is put away or opened. With the app open, what is due shows in a sheet from
  the bottom (the desktop's alarm window); the "Today and upcoming" pop-up is a sheet too.
- **A phone layout in today's style** (below 720 px wide; tablets keep the desktop layout with touch sizes):
  - a **navigation bar** at the bottom for the Calendar, Reminders and Lists, instead of the tabs;
  - a **top bar** with the view's name (on Lists, the list picker), 🔍 search that opens across the bar, and a **⋮ menu**
    with Quick alarm, Alarms, suspend or resume alarms, Data file and Settings (the desktop's header and status bar);
  - the filters as a row of **chips** that scrolls sideways (Upcoming ▾, a category, ✓ Show completed, Calendars);
  - roomy list items with **round tick boxes**, the date and time on the right, how it repeats underneath, months as
    quiet headings, and a ★ before starred items;
  - a ＋ button for a new reminder or list item; dialogs fill the screen with their buttons at the bottom; a tap opens
    an item, and a long press opens its menu as a sheet from the bottom. **Back** closes what is open (a menu, the
    search, a dialog, the alarm sheet), then goes back to the Calendar.
  The colours come from the theme, so dark and high contrast work as on the desktop.
- **Files:** reminders, settings and the daily backups are kept in the app's private folder (Android's own backup
  includes them). Export, "Save a backup copy…" and "Data file" open Android's share sheet (save to Files or Drive, or
  send). Import picks a file with Android's file picker. To bring the ReminderFox add-on's file, copy
  `reminderfox.ics` to the phone first (Settings → Data → Import from ReminderFox… says so).
- Not on Android: email features, the tray, start at login and the folders.

Screenshots (made-up sample data, in a phone-sized browser): `mobile/screenshots/` (the Calendar as a list and as the
hours, Reminders, a list, the editors, the menus, an alarm, dark, and a tablet).

## Get the app (APK)

This branch builds the APK on GitHub's servers: **Actions → Android app** runs on every push to
`new/android-test` (or press **Run workflow**). Open the finished run and download **ReminderFoxAgain-android** under
Artifacts. It has:

- `ReminderFoxAgain-0.9.5.1-debug.apk` — install this one to try the app;
- `ReminderFoxAgain-0.9.5.1-release-unsigned.apk` — for signing later;
- `SHA256SUMS.txt`.

**Install:** copy the debug APK to the phone and open it; Android asks to allow installs from that app (Files or
the browser) once. **Update:** install a newer APK over it; your reminders stay. **Uninstall** removes the reminders
too, so first use Settings → Data → **Save a backup copy…** or **Export**.

The first time it runs, the app asks to send notifications; allow it. On Android 12 and later, for alarms on the
minute, also allow **Alarms & reminders** for ReminderFoxAgain in the system settings (Apps → ReminderFoxAgain).

## Build it yourself

Needs Node.js 22, JDK 21 and the Android SDK (Android Studio installs it).

```sh
npm ci                               # in the repository root (ical.js; ELECTRON_SKIP_BINARY_DOWNLOAD=1 skips Electron)
cd mobile
npm ci
node build-web.js                    # www/: the pages, the host and the plugins (the same files every time)
npx cap sync android                 # copies www/ into the Android project
cd android && ./gradlew assembleDebug   # app/build/outputs/apk/debug/app-debug.apk
```

Or open `mobile/android` in Android Studio and press Run with a phone connected (USB debugging on).
After a change to the version or the icons: `python3 mobile/tools/android-res.py` (from the repository root).

## Checks

```sh
node mobile/build-web.js && mobile/test/e2e.sh   # last line: … checks, 0 problem(s)
```

`mobile/test/run.js` opens the app's pages in Chromium with Capacitor's web versions of the plugins and runs the
desktop's `tools/ui` scripts at the desktop size (the same app must pass them; they start on Reminders, as on the
desktop, and may use the Month view and the calendar's months setting, whose code is shared but which the app never
shows) and `mobile/test/android-phone.js` at a phone and a tablet size, in English and German: starting on the
Calendar, the small month, the agenda as a list and as the hours (opened at the time now), no Month, Week or Day
views, the simple editors and More options, the ＋ button, cards, full-screen dialogs, the menu from the bottom, Back,
the alarm sheet and the notifications that are scheduled.

**Not checked yet (needs a phone or an emulator):** installing the APK; the permission questions; a reminder a few
minutes ahead ringing with the app closed and the screen off; Snooze, Done and Open on the notification; a
notification after a restart of the phone; picking a file to import; sharing an export; the Back button; dark mode
and a large font size; the alarm sounds on each channel.

## How it fits together

| File | What it does |
| --- | --- |
| `mobile/src/android-host.js` | Runs the host core in the main page with an Android adapter: files (Capacitor Filesystem, `rfa/` in the app's data folder, written atomically), the alarm and pop-up sheets (`alarm.html`, `slider.html` in a frame), scheduled notifications and their actions, links in the system browser |
| `mobile/src/shim.js` | Gives the add-on's `thunderbird/bridge.js` a `browser.runtime` that reaches the host directly (the sheets reach it through their parent) |
| `mobile/src/android-page.js` | After the bridge: no email features; saving a file shares it |
| `mobile/src/android.js`, `android.css` | The Calendar as the main view (the small month, List \| Hours), no Month view, the simple editors (More options), the ＋ button, touch, Back, the phone layout (app bar, ⋮ menu, navigation bar, chips, list items), hidden desktop settings |
| `mobile/src/plugins.js` | The Capacitor plugins, bundled into `www/m/cap.js` |
| `mobile/build-web.js` | Builds `www/` with esbuild (the host core into `www/m/host.js`) |
| `mobile/android/` | The native project (`npx cap add android`, then `mobile/tools/android-res.py`: icons, splash, sounds, permissions, version 0.9.5.1 / 9051) |
| `.github/workflows/android.yml` | Builds the APKs on GitHub |

The app's shared code has one change for this: `src/ui/app.js` knows a `calendar` tab (the calendar panel as a view),
used only when a page adds a tab for it, as the Android app does.
