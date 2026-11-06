# ReminderFoxAgain for Android (test branch `new/android-test`)

ReminderFoxAgain as an Android app for phones and tablets (Android 7.0 and later). It has the desktop app's features
(everything except those that need email), from the same pages (`src/ui`) and the same host core
(`src/host/core.js`) as the Thunderbird add-on, in a [Capacitor](https://capacitorjs.com) app.

What is different on Android:

- **The calendar panel is a view of its own.** The mini calendar and the picked day's agenda are the **Calendar** tab,
  beside Reminders, the lists and Month/Week/Day; there is no panel beside the list. On a tablet the mini calendar
  and the agenda sit side by side.
- **Alarms are notifications.** Every alarm of the next 14 days is scheduled as an Android notification, with
  **Snooze**, **Done** and **Open**, so it rings when the app is closed. They are scheduled again whenever reminders
  or settings change, and when the app is put away or opened. With the app open, what is due shows in a sheet from
  the bottom (the desktop's alarm window); the "Today and upcoming" pop-up is a sheet too.
- **A round ＋ button** replaces "＋ Reminder" and "＋ List Item". On a phone the lists are cards, dialogs fill the
  screen, a tap opens an item, and a long press opens its menu from the bottom. **Back** closes what is open, then goes
  back to Reminders.
- **Files:** reminders, settings and the daily backups are kept in the app's private folder (Android's own backup
  includes them). Export, "Save a backup copy…" and "Data file" open Android's share sheet (save to Files or Drive, or
  send). Import picks a file with Android's file picker. To bring the ReminderFox add-on's file, copy
  `reminderfox.ics` to the phone first (Settings → Data → Import from ReminderFox… says so).
- Not on Android: email features, the tray, start at login and the folders.

Screenshots (made-up sample data, in a phone-sized browser): `mobile/screenshots/`.

## Get the app (APK)

This branch builds the APK on GitHub's servers: **Actions → Android app** runs on every push to
`new/android-test` (or press **Run workflow**). Open the finished run and download **ReminderFoxAgain-android** under
Artifacts. It has:

- `ReminderFoxAgain-0.9.5-debug.apk` — install this one to try the app;
- `ReminderFoxAgain-0.9.5-release-unsigned.apk` — for signing later;
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
desktop's `tools/ui` scripts at the desktop size (the same app must pass them) and `mobile/test/android-phone.js` at a
phone and a tablet size, in English and German: the Calendar view, the ＋ button, cards, full-screen dialogs, the menu
from the bottom, Back, the alarm sheet and the notifications that are scheduled.

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
| `mobile/src/android.js`, `android.css` | The Calendar tab, the ＋ button, touch, Back, the phone layout, hidden desktop settings |
| `mobile/src/plugins.js` | The Capacitor plugins, bundled into `www/m/cap.js` |
| `mobile/build-web.js` | Builds `www/` with esbuild (the host core into `www/m/host.js`) |
| `mobile/android/` | The native project (`npx cap add android`, then `mobile/tools/android-res.py`: icons, splash, sounds, permissions, version 0.9.5 / 905) |
| `.github/workflows/android.yml` | Builds the APKs on GitHub |

The app's shared code has one change for this: `src/ui/app.js` knows a `calendar` tab (the calendar panel as a view),
used only when a page adds a tab for it, as the Android app does.
