# Platform: Windows 11 (x64)

The reference source **is** the Windows build. Reproduce it: same stack, same installer, same release files. Work in a
Linux shell. Everything is testable there except launching the app itself: the installer is built with `makensis`
(`apt install nsis`) and tested under Wine (64-bit).

## Stack

Node.js 22, Electron **44.7.0**, `ical.js` **2.2.1** (only runtime dependency), `@electron/packager` **20.3.0**. Pin
exact versions; commit `package-lock.json`. Plain HTML/CSS/JS, no framework. `package.json` as in the reference
(`name reminderfoxagain`, `productName ReminderFoxAgain`, `version 0.9.2`, `main src/main.js`) including its `package`
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

## Installer (NSIS 3, 64-bit, per user, no admin)

Exactly as `reference/source/installer/ReminderFoxAgain.nsi` (0.9.2; before that a .bat + PowerShell script):

- `Unicode true`, `Target amd64-unicode`, solid LZMA, `RequestExecutionLevel user`, `InstallDir
  $LOCALAPPDATA\Programs\ReminderFoxAgain`, MUI2 pages Welcome → Install → Finish (with "Run ReminderFoxAgain"), the
  welcome/finish bitmap `installer/wizard.bmp`, version information "ReminderFoxAgain Setup".
- Languages: English plus the NSIS language of each app language (Frisian has none), and two strings of its own —
  the shortcut description and the uninstaller's question — written by `tools/installer-lang.js` from
  `src/ui/locales/` into `dist/lang.nsh`.
- Install: `taskkill /IM ReminderFoxAgain.exe /T /F`; write the app and `Uninstall ReminderFoxAgain.exe` into
  `ReminderFoxAgain.new`; rename the old folder to `.old`, the new one into place (on failure put the old one back),
  then delete `.old`. Start-menu and desktop shortcuts `ReminderFoxAgain.lnk`; HKCU Uninstall key `ReminderFoxAgain`
  (DisplayName, DisplayVersion, Publisher, DisplayIcon, InstallLocation, URLInfoAbout, UninstallString,
  QuietUninstallString `/S`, NoModify, NoRepair, EstimatedSize). It replaces a .bat-era install in place.
- Uninstall: close the app; remove the shortcuts, the Uninstall key, the `Run` value `org.reminderfoxagain.desktop`
  and the program folder; then ask (Yes/No, No default; silent = No) whether to delete `%APPDATA%\ReminderFoxAgain`.

## Build (`build.sh`)

1. Unit tests in seven time zones.
2. `npm run package` (win32 x64, asar, ignores tests/docs/installer).
3. Keep only the en-US and en-GB Chromium locales plus those in `CHROMIUM_LOCALES` in `src/main.js` (30 files), so date pickers follow the chosen language.
4. `node tools/installer-lang.js dist/lang.nsh`.
5. `touch` every app file to 2026-01-01 UTC and, with `SOURCE_DATE_EPOCH=1767225600`, run `makensis -DVERSION=…
   -DAPPDIR=… -DLANGFILE=… -DICON=assets/icon.ico -DWIZARD=installer/wizard.bmp -DOUTFILE=… installer/ReminderFoxAgain.nsi`.
6. Optional signing with `osslsigncode` (`SIGN_CERT`, `SIGN_PASS`).

Two builds in a row must give identical SHA-256 for every release file.

## Checks

`npm test` in 7 zones · `tools/e2e.sh` (27 runs, ~532 lines, no WRONG/ERROR; five of them in German, French as the system language, a pick in Settings, and Arabic; one in the alarm window for the continuous sound) ·
`tools/test-installer.sh` (Wine; 19 checks, 0 problems) · `tools/shots.sh` vs `reference/screenshots/` · two identical builds.

## Deliverables

`dist/release/ReminderFoxAgain-Setup-0.9.2.exe`; a source zip (no `node_modules`, no `dist`); the screenshots. The Setup
file installs, updates (from any earlier version, including the .bat-era installs) and repairs.
