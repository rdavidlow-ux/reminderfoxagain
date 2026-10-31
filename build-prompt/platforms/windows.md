# Platform: Windows 11 (x64)

The reference source **is** the Windows build. Reproduce it: same stack, same installer, same release files. Work in a
Linux shell. Everything is testable there except launching the final `.exe` (the installer is tested with PowerShell 7
on Linux).

## Stack

Node.js 22, Electron **44.7.0**, `ical.js` **2.2.1** (only runtime dependency), `@electron/packager` **20.3.0**. Pin
exact versions; commit `package-lock.json`. Plain HTML/CSS/JS, no framework. `package.json` as in the reference
(`name reminderfoxagain`, `productName ReminderFoxAgain`, `version 0.9.1`, `main src/main.js`) including its `package`
script.

## Host specifics

- `app.setAppUserModelId('org.reminderfoxagain.desktop')`, single-instance lock, `autoplay-policy=no-user-gesture-required`.
- Data in `%APPDATA%\ReminderFoxAgain` (`app.setPath('userData', …)` unless `RF_DATA_DIR`).
- ReminderFox add-on files (`rf:findOld`): `<profile>\reminderfox\reminderfox.ics` under the Firefox, Thunderbird, SeaMonkey,
  Waterfox and Pale Moon profile folders in `%APPDATA%`.
- Main window 1180×760 (min 820×540). Alarm window 500×360, frameless, always on top, bottom-right of the work area,
  `showInactive` + `flashFrame`. Pop-up 360×380 in the chosen corner.
- Tray `assets/tray.png`. The badge uses the tray image plus a taskbar overlay icon (`setOverlayIcon`).
- Start with Windows: `app.setLoginItemSettings({openAtLogin, args:['--hidden'], name:'org.reminderfoxagain.desktop'})`,
  and switch off the old run ids `org.remindmeagainfox.desktop`, `org.rfox.desktop`, `org.reminderfox.desktop`.
- `meta().platform = 'windows'`.

## Installer (per user, no admin; Windows PowerShell 5.1 syntax, also runs in pwsh 7 on Linux)

Exactly as `reference/source/installer/`:

- `Install or Update ReminderFoxAgain.bat` runs `ReminderFoxAgain-Setup.ps1`, a template filled by
  `installer/fill-setup.sh` (version, runtime version, hashes, part count).
- It verifies the `.asar`. For the runtime it uses the installed one if the Electron version matches, else the
  `…-runtime-<ver>.partN.bin` files (joined, SHA-256 checked, unzipped). From 0.7.0 an installed runtime without
  `locales\de.pak` (from 0.6.x, which kept only en-US, en-GB and fr) is replaced when the parts are present; without the
  parts it is kept, with the note "Note: the installed runtime has date pickers in English only…".
- It stages `Programs\ReminderFoxAgain.new` and swaps it in with rollback, and creates the shortcuts and the HKCU Uninstall key. It writes `Uninstall ReminderFoxAgain.ps1`,
  which keeps the data unless the user types YES.

## Build (`build.sh`)

1. Unit tests in seven time zones.
2. `npm run package` (win32 x64, asar, ignores tests/docs/installer).
3. Keep only the en-US and en-GB Chromium locales plus those in `CHROMIUM_LOCALES` in `src/main.js` (30 files), so date pickers follow the chosen language.
4. Copy `app.asar` → `ReminderFoxAgain-app-0.9.1.asar`.
5. Runtime zip: `touch` everything to 2026-01-01 UTC, `zip -X -9 -D` from a sorted list, split into 28 MiB parts.
6. Fill the setup template (CRLF) and the .bat (CRLF).

Two builds in a row must give identical SHA-256 for every release file.

## Checks

`npm test` in 7 zones · `tools/e2e.sh` (27 runs, ~532 lines, no WRONG/ERROR; five of them in German, French as the system language, a pick in Settings, and Arabic; one in the alarm window for the continuous sound) ·
`tools/test-setup.sh` 20/20 · `tools/shots.sh` vs `reference/screenshots/` · two identical builds.

## Deliverables

`dist/release/`: `Install or Update ReminderFoxAgain.bat`, `ReminderFoxAgain-Setup.ps1`,
`ReminderFoxAgain-app-0.9.1.asar`, `ReminderFoxAgain-runtime-0.9.1.part1.bin … part6.bin`; a source zip (no
`node_modules`, no `dist`); the screenshots. Updating from 0.7.x needs only the .bat, .ps1 and .asar; updating from 0.6.x should include the runtime parts so date
pickers follow the language.
