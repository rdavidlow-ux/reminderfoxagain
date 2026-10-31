# Platform: macOS 13 Ventura or later (Apple silicon and Intel)

Same Electron app as Windows, with a macOS host, a menu bar and an `.app` bundle. You can do most of the work on Linux:
code, unit tests, UI checks (they run the same code under Electron on Linux), and packaging the `.app`. Signing a
`.dmg`, notarizing, and checking the real menu bar and Dock need a Mac. Say clearly which checks ran where.

## Stack

As Windows: Node.js 22, Electron **44.7.0**, `ical.js` **2.2.1**, `@electron/packager` **20.3.0**. For a universal
binary add `@electron/universal` (pin the current 2.x). For ad-hoc signing from Linux use `rcodesign` (apple-codesign),
pinned. Nothing else at runtime.

## Host changes (`src/main.js`, branch on `process.platform === 'darwin'`)

`meta().platform = 'macos'`.

| Area | macOS behaviour |
| --- | --- |
| Identity | Bundle id `org.reminderfoxagain.desktop`, `CFBundleDisplayName` ReminderFoxAgain, category `public.app-category.productivity`, `LSMinimumSystemVersion` 13.0, icon `reference/assets/macos/icon.icns`. |
| Data folder | `~/Library/Application Support/ReminderFoxAgain` (`app.getPath('appData')`); `RF_DATA_DIR` overrides. |
| ReminderFox add-on files | `~/Library/Application Support/Firefox/Profiles/*/reminderfox/reminderfox.ics`, `~/Library/Thunderbird/Profiles/*/…`, `~/Library/Application Support/SeaMonkey/Profiles/*/…`, `~/Library/Application Support/Waterfox/Profiles/*/…`. |
| Application menu | **Required** (don't call `removeMenu` on macOS: without an Edit menu ⌘C/⌘V/⌘X/⌘A/⌘Z don't work in text fields). App menu: About ReminderFoxAgain, Settings… (⌘,), Services, Hide (⌘H), Hide Others, Show All, Quit (⌘Q). File: New Reminder (⌘N), New To-Do (⌘T), Quick Alarm (⇧⌘A), Import… (⌘I), Export… (⌘E). Edit: the standard roles. View: Show/Hide Calendar Panel (⌘B), Go to Date… (⌘G), Find (⌘F). Window: minimize, zoom, front. Menu items send the same `ui:*` events the tray uses (add `ui:import`, `ui:export`, `ui:settings`, `ui:goto`, `ui:side` to the preload's allowed channels). |
| Keyboard | The UI already accepts ⌘ for Ctrl. On macOS, Quick alarm is ⇧⌘A (⌘Q quits); show ⌘ in tooltips (for example "New reminder (⌘N)"). |
| Window close | Closing the main window hides it; the app keeps running with its Dock icon and menu-bar icon. Clicking the Dock icon (`app.on('activate')`) shows it again. ⌘Q quits for real. `closeToTray` is labelled "Keep running in the menu bar when the window is closed". |
| Menu-bar icon | `Tray` with `trayTemplate.png` (+ `@2x`), so macOS tints it. The tooltip is the templated text. The menu is the tray menu. |
| Badge | `app.dock.setBadge(n ? String(n) : '')`; leave the tray image as the template (no number). |
| Start at login | `app.setLoginItemSettings({openAtLogin, openAsHidden:true, type:'mainAppService'})`. Label "Start ReminderFoxAgain when you log in". |
| Alarm window | Frameless, `setAlwaysOnTop(true, 'floating')`, `setVisibleOnAllWorkspaces(true, {visibleOnFullScreen:true})`, bottom-right of the work area. Bounce the Dock (`app.dock.bounce('informational')`) instead of `flashFrame`. Also post a Notification Center notification for a new alarm (clicking shows the window). Request permission on first run. |
| Pop-up | As Windows, with `type:'panel'`, so it never steals focus. |
| Appearance | Default theme follows the system (already true); `nativeTheme.themeSource` as on Windows. Use the system font stack already in `styles.css`. |

## Packaging (`build-macos.sh`)

1. Unit tests in seven zones.
2. `electron-packager . ReminderFoxAgain --platform=darwin --arch=arm64` and `--arch=x64` (same ignores, `--asar`,
   `--icon`, `--app-bundle-id`, `--app-category-type`, `--extend-info` with the keys above). Merge them with
   `@electron/universal` into `ReminderFoxAgain.app` (universal); on Linux, patch `process.platform` to `darwin` for the
   call and put a small `lipo` stand-in on PATH (`lipo A B -create -output C`: a fat header, magic 0xcafebabe, x86_64 then
   arm64, aligned 2^12 and 2^14). Keep only the `.lproj` folders of `en`, `en_GB` and the app's languages
   (`CHROMIUM_LOCALES`, `-` → `_`).
3. **Signing.** Electron's bundle is signed; changing it (asar, Info.plist) breaks the signature, and Apple-silicon
   Macs refuse unsigned code. Re-sign ad hoc: `codesign --force --deep --sign - ReminderFoxAgain.app` on a Mac, or
   `rcodesign sign` on Linux, with the hardened-runtime entitlements Electron needs
   (`com.apple.security.cs.allow-jit`, `…allow-unsigned-executable-memory`, `…disable-library-validation`). If
   `APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_APP_PASSWORD` and a Developer ID certificate are available, sign with it and
   notarize (`xcrun notarytool submit --wait`, then `xcrun stapler staple`). Otherwise say the build is ad-hoc signed.
4. **Release files**:
   - `ReminderFoxAgain-0.9.2-macos-universal.zip`: `ditto -c -k --keepParent` on a Mac, or on Linux `zip -y -r -X` (keep
     the symlinks) after touching every file to `SOURCE_DATE_EPOCH`;
   - `ReminderFoxAgain-0.9.2.dmg` (Mac only): `hdiutil create -volname ReminderFoxAgain -srcfolder <dir with the .app
     and an /Applications symlink> -format UDZO`.
   Split anything over a delivery limit into 28 MiB parts with a `join.command`.
5. Two builds in a row of the zip must be identical. The dmg and notarized builds needn't be.

## Install, update, uninstall

- Install: open the dmg (or unzip) and drag ReminderFoxAgain to Applications. With an ad-hoc build, the first launch
  needs right-click → Open (or `xattr -dr com.apple.quarantine /Applications/ReminderFoxAgain.app`); the README says
  so.
- Update: replace the app. The data in `~/Library/Application Support/ReminderFoxAgain` stays.
- Uninstall: drag the app to the Trash. Settings → Data gets **"Remove all my data…"** on macOS (asks for YES), since
  there is no uninstaller.

## Checks

- On Linux: unit tests in 7 zones; the compatibility benchmark; `tools/e2e.sh` with `RF_FAKE_PLATFORM=darwin` (a test
  hook that makes the host take its macOS branches where that's possible without macOS: the menu template, labels,
  ⇧⌘A, data-path logic via a fake HOME, close-hides). Print the menu template and check every accelerator. Package the
  universal `.app`, check `Info.plist` keys, the icon, both architectures (`lipo -info` or `file`), the locales, and
  verify the ad-hoc signature with `rcodesign verify`.
- On a Mac (if available, otherwise a manual checklist in the README): launch, menu bar icon tinted in light and dark
  mode, Dock badge, ⌘C/⌘V in the editor, close hides and Dock click shows, alarm window over a full-screen app, login
  item, notification permission, screenshots match the reference.

## Deliverables

`dist/release/`: the universal zip (and the dmg if built on a Mac), `SHA256SUMS`; a source zip; screenshots; a README
with install/update/uninstall and the Gatekeeper note.
