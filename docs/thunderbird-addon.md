# ReminderFoxAgain for Thunderbird (experimental)

Branch `experimental-add-on`. This is a Thunderbird add-on with the same features as the ReminderFoxAgain desktop app:
reminders, to-do lists, the Month view, alarms, quick alarms, the pop-up, saved filters, categories, themes, 34
languages, import and export, and daily backups. Like the original ReminderFox, it lives inside Thunderbird again.

It is **not released**. It was built and tested with a stand-in for Thunderbird (see *Testing*), not yet in a real
Thunderbird. The desktop app is unchanged by it.

## How it is built

The add-on reuses the desktop app's code. Only the part that talks to the operating system is new.

```
 Thunderbird
 ├─ background page ─────────────────────────────────────────────────────────────┐
 │   host.js        src/host/core.js  (new: the platform-neutral half of main.js) │
 │                  src/core/store.js (the data layer, unchanged)                 │
 │                  src/ui/i18n.js, ical.js                                       │
 │   background.js  the Thunderbird adapter: storage, tab, popup windows,         │
 │                  toolbar button, menu, notifications, links                    │
 └──────────────▲──────────────────────────────────────────────────────────────────┘
                │ runtime messages (the same channels as the desktop preload)
 ┌──────────────┴────────────────┐  ┌─────────────────────┐  ┌──────────────────────┐
 │ main tab: src/ui/index.html   │  │ alarm window        │  │ pop-up window        │
 │  bridge.js → window.rf        │  │ src/ui/alarm.html   │  │ src/ui/slider.html   │
 │  tb.css, tb.js (overlay)      │  │  bridge.js          │  │  bridge.js           │
 └───────────────────────────────┘  └─────────────────────┘  └──────────────────────┘
```

| Part | File | What it does |
| --- | --- | --- |
| Host core | `src/host/core.js` | The data file, backups, state and settings, the alarm engine, quick alarms, suspend, the pop-up data, import and export, and every `window.rf` call. It has no Electron or Node imports and takes an *adapter* for the platform. It is the "host core" the build prompt pack describes for the phone apps, so they can use it too. |
| Thunderbird adapter | `thunderbird/background.js` | Runs the core in the add-on's background page and connects it to Thunderbird's WebExtension APIs. |
| Page bridge | `thunderbird/bridge.js` | Gives each page the same `window.rf` as the desktop's `src/preload.js`. Calls go to the background page as messages. Picking and saving files happens in the page, because a page can show a file dialog and the background page can't. |
| Overlay | `thunderbird/tb.css`, `thunderbird/tb.js` | Hides the desktop-only settings and adds a note on where the data is kept. |
| Wording | `src/ui/i18n-dom.js` | Three texts read differently in the add-on (the welcome line, "Data file", the count setting). This applies only when the host says it is Thunderbird. |
| Build | `build-thunderbird.sh`, `thunderbird/build.js` | Bundles the core, the store, ical.js and the translations into `host.js`, copies `src/ui` with the bridge added, writes the manifest, and zips a deterministic `.xpi`. |

The pages in `src/ui` are used unchanged. The desktop app still runs on its own `src/main.js`; moving it onto the host
core too is possible later, but not needed now.

## Desktop features in the add-on

| Desktop app | Add-on |
| --- | --- |
| Main window | A Thunderbird tab. The toolbar button (or its menu → Open ReminderFoxAgain) opens it or brings it to the front. The first install opens it on the welcome page. |
| Tray icon, its menu and tooltip | The ReminderFoxAgain toolbar button: its tooltip lists today's reminders, a number on it counts them (Settings → Alarms), and its right-click menu has Open, Add reminder…, Add list item…, Quick alarm…, Suspend or Resume alarms, and Show today's reminders. |
| Alarm window | A popup window (500×360) at the bottom right of the screen, plus a notification. Its "–" button minimises it. |
| Pop-up (today and upcoming) | A popup window (360×380) in the chosen corner. |
| Data folder (`reminders.ics`, `state.json`, `backups/`) | The add-on's storage in the Thunderbird profile, one entry per file, with the same names and the same daily backups (30 days). |
| Open data folder, Open backups folder | Hidden. The status bar's "Data file" saves a copy of `reminders.ics` instead. Settings → Data → Restore… still lists every backup. |
| Import from ReminderFox (searching the Firefox/Thunderbird profiles) | Hidden: an add-on can't read other profile folders. "Import a reminderfox.ics or other calendar file…" lets you pick the file. Picking the profile's `prefs.js` with it also brings the add-on's list names. |
| Export, Save a backup copy | The file is saved as a download. |
| Choose a sound file | A file picker; the sound is kept in storage. |
| Start when you log in, Keep running in the tray | Hidden: Thunderbird starts the add-on, and alarms ring whenever Thunderbird is running. |
| Text size | The page is zoomed (CSS `zoom`). |
| Links (maps, web pages in notes) | Open in the system browser (`windows.openDefaultBrowser`). |
| After sleep or unlock: check alarms | `idle.onStateChanged` → check after 1 second. |

Permissions: `storage`, `unlimitedStorage`, `notifications`, `menus`, `tabs`, `idle`. The add-on uses no network and
collects nothing (`data_collection_permissions: none`). Thunderbird 128 or later; Manifest V2 with a persistent
background page, so alarms keep their timers like the desktop app.

## The data

The add-on keeps its own copy of your reminders in the Thunderbird profile, in the same iCalendar format. It does not
share a file with the desktop app. To move from one to the other, export in one and import in the other
(Settings → Data). Everything the import keeps on the desktop is kept here too: the add-on's `X-REMINDERFOX-*`
properties, anything unknown, and the add-on's own form when an item isn't changed.

## Building, installing, testing

```sh
./build-thunderbird.sh           # unit tests, then dist/release-thunderbird/ReminderFoxAgain-<ver>-thunderbird.xpi
thunderbird/test/e2e.sh          # the UI checks in Chromium with a mock Thunderbird; last line: 601 checks, 0 problem(s)
```

- **Install in Thunderbird:** Add-ons and Themes → ⚙ → Install Add-on From File… → the `.xpi`. Thunderbird asks to
  confirm because the add-on isn't signed. Or, to try without installing: Tools → Developer Tools → Debug Add-ons →
  Load Temporary Add-on… → `dist/thunderbird/manifest.json` (it is removed when Thunderbird closes).
- **Unit tests:** `test/host-core.test.js` (10 tests, part of `npm test`) runs the host core with an in-memory
  adapter and a clock the test moves: saving and reloading, daily backups, import with a picked `prefs.js`, an
  unreadable file kept aside, alarms (due, snooze, dismiss), quick alarms and suspend, backup and restore, export, the
  toolbar menu, a chosen language and a chosen sound.
- **UI checks:** `thunderbird/test/run.js` serves the built add-on, opens its background page in Chromium with
  `mock-browser.js` (storage, tabs, popup windows, the toolbar button, menus, notifications, messages), clicks the
  toolbar button, and runs the desktop's `tools/ui/*.js` scripts in the tab and the alarm window, plus
  `tb-smoke.js` for what the add-on does its own way. The desktop scripts that import test files by their path get
  those files uploaded the add-on's way. One desktop check is different on purpose (the hidden "Import from
  ReminderFox…") and is reported as such.
- **Lint:** `web-ext lint` (Mozilla's checker) passes with no errors. It warns that `windows.openDefaultBrowser` is
  not a Firefox API (it is Thunderbird's) and that the pages set `innerHTML` (the UI escapes every value it puts in).

## Still to try in a real Thunderbird

These can't be checked without Thunderbird itself:

1. **Keyboard shortcuts.** Thunderbird may handle Ctrl+N (new message), Ctrl+T, Ctrl+Q (quit on Windows and Linux)
   and Ctrl+F before the tab sees them. If so, the add-on needs other keys, or `commands` in the manifest.
2. **Alarm sound.** The built-in sounds are played with Web Audio in the alarm popup. Thunderbird's autoplay rules
   may hold the sound until the window is clicked.
3. **Saving files.** Export and "Data file" save through a download link. Check where Thunderbird puts the file and
   whether it asks.
4. **Window placement and focus** of the alarm and pop-up windows on Windows, macOS and Linux, and the popup window's
   title bar (the desktop's alarm window has no frame).
5. **The welcome page on first install**, and the toolbar button's place in the unified toolbar (Thunderbird 115+).
6. **Storage size** with years of backups (the `unlimitedStorage` permission should cover it).

## Ideas for later

- **Reminders from email:** a message-list menu item "Add reminder…" that opens the editor with the subject and a
  link back to the message (the `messages` and `messageDisplay` APIs), and later the email scanning in the plans.
- **Sharing data with the desktop app:** the same file through a synced folder, or Thunderbird's native messaging
  to the app (which the antivirus discussion in the handoff argued against for now).
- **Manifest V3** when Thunderbird requires it: the background page becomes an event page, so alarms would move to
  `browser.alarms`.
- **Publishing** on addons.thunderbird.net, which signs the add-on (free) and offers updates.
