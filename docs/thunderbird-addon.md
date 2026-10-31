# ReminderFoxAgain 0.9.2 — Thunderbird Add-on (experimental)

Oct 31, 2026 · David

ReminderFoxAgain runs inside Thunderbird 128 or later as an add-on, with the same features as the desktop app: reminders, to-do lists, the Month view, alarms, quick alarms, the pop-up, saved filters, categories, themes, 34 languages, import and export, and daily backups. It is on the experimental-add-on branch and not released. It works in Thunderbird 153.6.0esr on Windows 11; the desktop app is unchanged by it.

## How it is built

The add-on reuses the desktop app's code; only the part that talks to the operating system is new.

<img src="media/thunderbird-addon/image1.png" style="width:6in;height:3.05357in" alt="the add-on&#39;s parts · background page, bridge, three pages" />

the add-on's parts · background page, bridge, three pages

| Part                | File                                       | What it does                                                                                                                                                                                                                                                                                                          |
|---------------------|--------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Host core           | src/host/core.js                           | The data file, backups, state and settings, the alarm engine, quick alarms, suspend, the pop-up data, import and export, and every window.rf call. No Electron or Node imports; it takes an adapter for the platform. It is the host core the build prompt pack describes for the phone apps, so they can use it too. |
| Thunderbird adapter | thunderbird/background.js                  | Runs the core in the add-on's background page and connects it to Thunderbird's APIs: storage, the tab, popup windows, the toolbar button and its menu, notifications, links and shortcuts.                                                                                                                            |
| Page bridge         | thunderbird/bridge.js                      | Gives each page the same window.rf as the desktop's src/preload.js. Calls go to the background page as messages. Picking and saving files happens in the page, because only a page can show a file dialog.                                                                                                            |
| Overlay             | thunderbird/tb.css, thunderbird/tb.js      | Hides the desktop-only settings and adds a note on where the data is kept.                                                                                                                                                                                                                                            |
| Wording             | src/ui/i18n-dom.js                         | Three texts read differently in the add-on, and the tooltips show the Thunderbird shortcuts. This applies only when the host says it is Thunderbird.                                                                                                                                                                  |
| Shortcuts           | thunderbird/shortcuts.json                 | The Alt+Shift shortcuts and the desktop key each one presses.                                                                                                                                                                                                                                                         |
| Build               | build-thunderbird.sh, thunderbird/build.js | Bundles the core, the store, ical.js and the translations into host.js, copies src/ui with the bridge added, writes the manifest and zips a deterministic .xpi.                                                                                                                                                       |

The pages in src/ui are used unchanged. The desktop app still runs on its own src/main.js.

## Desktop features in the add-on

Every desktop feature is there; the ones tied to the operating system work the Thunderbird way.

| Desktop app                                                              | Add-on                                                                                                                                                                                                                                                          |
|--------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Main window                                                              | A Thunderbird tab. The toolbar button (or Alt+Shift+R) opens it or brings it to the front. The first install opens it on the welcome page.                                                                                                                      |
| Tray icon, its menu and tooltip                                          | The ReminderFoxAgain toolbar button. Its tooltip lists today's reminders, a number on it counts them (Settings → Alarms), and its right-click menu has Open, Add reminder…, Add list item…, Quick alarm…, Suspend or Resume alarms, and Show today's reminders. |
| Alarm window                                                             | A popup window (500×360) at the bottom right of the screen, plus a notification. Its “–” button minimises it.                                                                                                                                                   |
| Pop-up (today and upcoming)                                              | A popup window (360×380) in the chosen corner.                                                                                                                                                                                                                  |
| Data folder (reminders.ics, state.json, backups/)                        | The add-on's storage in the Thunderbird profile, one entry per file, with the same names and the same daily backups (30 days).                                                                                                                                  |
| Open data folder, Open backups folder                                    | Hidden. The status bar's “Data file” saves a copy of reminders.ics instead. Settings → Data → Restore… still lists every backup.                                                                                                                                |
| Import from ReminderFox (searching the Firefox and Thunderbird profiles) | Hidden: an add-on can't read other profile folders. “Import a reminderfox.ics or other calendar file…” lets you pick the file; picking the profile's prefs.js with it also brings the add-on's list names.                                                      |
| Export, Save a backup copy                                               | The file is saved as a download.                                                                                                                                                                                                                                |
| Choose a sound file                                                      | A file picker; the sound is kept in storage.                                                                                                                                                                                                                    |
| Start when you log in, Keep running in the tray                          | Hidden: Thunderbird starts the add-on, and alarms ring whenever Thunderbird is running.                                                                                                                                                                         |
| Keyboard shortcuts (Ctrl+N…)                                             | Alt+Shift shortcuts (next section).                                                                                                                                                                                                                             |
| Text size                                                                | The page is zoomed (CSS zoom).                                                                                                                                                                                                                                  |
| Links (maps, web pages in notes)                                         | Open in the system browser.                                                                                                                                                                                                                                     |
| After sleep or unlock: check alarms                                      | Checked 1 second after the computer is used again.                                                                                                                                                                                                              |

Permissions: storage, unlimited storage, notifications, menus, tabs, idle, and keyboard shortcuts. The add-on uses no network and collects nothing. It needs Thunderbird 128 or later (Manifest V2, with a background page that keeps running, so alarms keep their timers as in the desktop app).

## Keyboard shortcuts

Thunderbird keeps Ctrl+N, Ctrl+T, Ctrl+Q and the other Ctrl keys for itself, so the add-on has its own Thunderbird shortcuts: **Alt+Shift** and the same letter as the desktop app. They work anywhere in Thunderbird, bring the ReminderFoxAgain tab to the front, and then do exactly what the Ctrl key does in the desktop app (nothing while a dialog is open, as there).

| Shortcut    | Desktop app | What it does                     |
|-------------|-------------|----------------------------------|
| Alt+Shift+R | —           | Open ReminderFoxAgain            |
| Alt+Shift+N | Ctrl+N      | New reminder                     |
| Alt+Shift+T | Ctrl+T      | New item in the list being shown |
| Alt+Shift+Q | Ctrl+Q      | Quick alarm                      |
| Alt+Shift+F | Ctrl+F      | Search reminders and to-dos      |
| Alt+Shift+G | Ctrl+G      | Go to a date                     |
| Alt+Shift+B | Ctrl+B      | Show or hide the calendar panel  |
| Alt+Shift+I | Ctrl+I      | Import an .ics file              |
| Alt+Shift+E | Ctrl+E      | Export to .ics                   |
| Alt+Shift+D | Ctrl+D      | Duplicate the selected item      |
| Alt+Shift+S | Ctrl+S      | Save the reminder being edited   |

To change one: Add-ons and Themes → ⚙ → Manage Extension Shortcuts. The tooltips (“New reminder (Alt+Shift+N)”) show the shortcuts as they are set, in every language; a shortcut that was removed is left out of its tooltip.

## The data

The add-on keeps its own copy of your reminders in the Thunderbird profile, in the same iCalendar format as the desktop app; the two don't share a file. To move from one to the other, export in one and import in the other (Settings → Data).

Everything the desktop import keeps is kept here too: the ReminderFox add-on's X-REMINDERFOX-\* properties, anything unknown, and the add-on's own form when an item isn't changed. An unreadable file is never overwritten: it is kept aside as reminders.ics.unreadable, as on the desktop.

## Building, installing, testing

./build-thunderbird.sh \# unit tests, then dist/release-thunderbird/ReminderFoxAgain-\<ver\>-thunderbird.xpi  
thunderbird/test/e2e.sh \# UI checks in Chromium with a mock Thunderbird; last line: 606 checks, 0 problem(s)

- **Install:** Add-ons and Themes → ⚙ → Install Add-on From File… → the .xpi. Thunderbird asks to confirm because the add-on isn't signed. To try it without installing: Tools → Developer Tools → Debug Add-ons → Load Temporary Add-on… → dist/thunderbird/manifest.json (removed when Thunderbird closes).

- **Deterministic:** two builds give the same .xpi, byte for byte.

- **Unit tests:** test/host-core.test.js (10 tests, part of npm test, 46 in all, in 7 time zones) runs the host core with an in-memory adapter and a clock the test moves: saving and reloading, daily backups, import with a picked prefs.js, an unreadable file kept aside, alarms (due, snooze, dismiss), quick alarms and suspend, backup and restore, export, the toolbar menu, a chosen language and a chosen sound.

- **UI checks:** thunderbird/test/run.js serves the built add-on, opens its background page in Chromium with mock-browser.js (storage, tabs, popup windows, the toolbar button, menus, notifications, shortcuts, messages), clicks the toolbar button, and runs the desktop's tools/ui/\*.js scripts in the tab and the alarm window, plus tb-smoke.js for what the add-on does its own way (storage, export, the hidden settings, the tooltips, Alt+Shift+N and Alt+Shift+B, the pop-up and a quick alarm). Desktop scripts that import test files by their path get those files uploaded the add-on's way. One desktop check is different on purpose (the hidden “Import from ReminderFox…”) and is reported as such.

- **Desktop app:** its own checks still pass (tools/e2e.sh, 658 checks), since the add-on shares its pages.

- **Lint:** Mozilla's web-ext lint gives no errors. It warns that windows.openDefaultBrowser is not a Firefox API (it is Thunderbird's) and that the pages set innerHTML (the UI escapes every value it puts in).

## Tried in a real Thunderbird

The add-on works in Thunderbird 153.6.0esr (64-bit) on Windows 11, tried by David on Oct 31, 2026.

| What                              | Result                                                                                                                             |
|-----------------------------------|------------------------------------------------------------------------------------------------------------------------------------|
| Installing and running the add-on | Works.                                                                                                                             |
| Keyboard shortcuts                | Thunderbird took the Ctrl keys before the add-on saw them. Fixed with the Alt+Shift shortcuts, to be checked again in Thunderbird. |
| Alarm sound                       | Plays without the alarm window being clicked first.                                                                                |
| Alarm window placement            | Near the bottom right, close to the system tray, as on the desktop.                                                                |

## Still to try, and ideas for later

Still to try in a real Thunderbird:

- [ ] The Alt+Shift shortcuts, and that none of them clashes with Thunderbird or Windows.

- [ ] Where Export and “Data file” save the file, and whether Thunderbird asks.

- [ ] macOS and Linux: placement and focus of the alarm and pop-up windows, and the shortcuts there.

- [ ] The welcome page on first install, and the toolbar button's place in the toolbar.

- [ ] Storage size with years of backups (the unlimited-storage permission should cover it).

Ideas for later:

- **Reminders from email:** a message-list menu item “Add reminder…” that opens the editor with the subject and a link back to the message, and later the email scanning in the plans.

- **Sharing data with the desktop app:** the same file through a synced folder, or Thunderbird's native messaging to the app (which the antivirus discussion argued against for now).

- **Manifest V3** when Thunderbird requires it: the background page becomes an event page, so alarms would move to browser.alarms.

- **Publishing** on addons.thunderbird.net, which signs the add-on for free and offers updates.
