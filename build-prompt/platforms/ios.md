# Platform: iOS and iPadOS 15+

A Capacitor app per `mobile-common.md`. Read that file first. Building, signing and running need a Mac with Xcode 16
or later. On Linux, do everything else (web build, host core, tests, the Xcode project files) and hand over a
`build-ios.sh` for the Mac.

## Project

- Bundle id `org.reminderfoxagain.app`, display name **ReminderFoxAgain**, version `0.9.1`, build `901`. Deployment
  target iOS 15.0; iPhone and iPad (iPad uses the desktop layout).
- `npx cap add ios` (Capacitor 7 uses Swift Package Manager; no CocoaPods). Commit `ios/App` without `build/` and
  `DerivedData/`.
- `www/` exactly as for Android (same `build:web`). `crypto.randomUUID` needs iOS 15.4+: add a polyfill in `host.js`
  (based on `crypto.getRandomValues`) for 15.0–15.3.

## Native resources

- App icon: `reference/assets/ios/AppIcon-1024.png` (opaque, full bleed; iOS rounds the corners) in
  `Assets.xcassets/AppIcon.appiconset` as a single-size 1024 icon.
- Sounds: `chime.caf`, `bell.caf`, `marimba.caf`, `beeps.caf`, `clock.caf` (from `reference/assets/sounds/`) in the app bundle. A user-chosen sound is converted or copied to
  `Library/Sounds/alarm-sound.caf` (iOS plays notification sounds of 30 s or less, in caf/wav/aiff, from the bundle or
  `Library/Sounds`). Formats iOS can't use fall back to the chosen built-in sound, with a note in Settings.
- Launch screen: background `#fbf8f4` / dark `#1d1712`, the icon centred.

## Info.plist

- `UIFileSharingEnabled` and `LSSupportsOpeningDocumentsInPlace` = YES, so the data folder shows in the Files app under
  "On My iPhone → ReminderFoxAgain". Store the data files in `Documents/ReminderFoxAgain/` (`Directory.Documents`), so
  users can see and back them up.
- `CFBundleDocumentTypes` + `UTImportedTypeDeclarations` for `com.apple.ical.ics` / `public.calendar-event` (`.ics`),
  so "Open in ReminderFoxAgain" from Mail or Files imports the file after a confirmation.
- `UIBackgroundModes: fetch` and `BGTaskSchedulerPermittedIdentifiers: org.reminderfoxagain.app.refresh` for the
  background runner (top up the schedule).
- `NSUserNotificationsUsageDescription` is not needed. Request authorization with alert, sound and badge on first run,
  after the explanation screen.

## Notifications

- iOS keeps at most **64** pending local notifications: schedule the soonest 60 plus the "Open ReminderFoxAgain to
  keep your reminders coming" notice (mobile-common §2), and reschedule whenever the app or the background task runs.
- The category `alarm` has actions Snooze, Done and Open (Open uses `.foreground`). Use `threadIdentifier` = the item's
  UID, so a day's reminders for one item stack.
- Time-sensitive interruption level for alarms (`interruptionLevel: timeSensitive`) only if the entitlement is
  available; otherwise active. No critical alerts.
- The badge comes from the scheduled notifications (`badge` = the count at that time) and is set directly whenever the
  app runs.

## Build (`build-ios.sh`, run on a Mac)

1. `npm ci && npm run build:web && npx cap sync ios`.
2. Simulator build, always:
   `xcodebuild -project ios/App/App.xcodeproj -scheme App -sdk iphonesimulator -configuration Release -derivedDataPath build CODE_SIGNING_ALLOWED=NO`
   → `ReminderFoxAgain-0.9.1-simulator.app.zip`.
3. Device build: with `RFA_TEAM_ID` (and automatic signing), `xcodebuild archive` then `-exportArchive` with an
   `ExportOptions.plist` (`method: development` or `app-store`) → `ReminderFoxAgain-0.9.1.ipa`. Without a team, stop
   after step 2 and say so.
4. TestFlight/App Store submission is out of scope. The README lists the steps (App Store Connect record,
   `xcrun altool`/Transporter upload, privacy answers: no data collected, nothing leaves the device).

## Checks

- Everything in `mobile-common.md` §5, including the iOS cap test.
- On a Mac (simulator; or a device for notification timing and sound):
  - `xcodebuild test` with a small XCTest UI test that launches the app, dismisses the permission explanation, and
    finds the "Reminders" tab;
  - a reminder 1 minute ahead fires with the app in the background;
  - Snooze, Done and Open;
  - "Open in ReminderFoxAgain" for an `.ics` from Files;
  - the data folder is visible in Files;
  - dark mode, high contrast and Dynamic Type XXL;
  - iPad split view uses the desktop layout.
  When no Mac is available, put these in the README as a manual checklist and say which checks ran.

## Deliverables

`dist/ios/`: the simulator `.app` zip, the `.ipa` if signed, `SHA256SUMS`; the project source zip (no
`node_modules`, `build/`, `DerivedData/`); phone and iPad screenshots; a README covering:
- install: Xcode → run on a device, or TestFlight;
- update: keeps the data;
- uninstall: deletes the data unless it's backed up — use Files or "Save a backup copy…" first.
