# Platform: Linux desktop (x64; arm64 optional)

Same Electron app as Windows, with a Linux host and Linux packaging. Linux is where you work, so **everything** can be
built, installed and tested for real.

## Stack

As Windows: Node.js 22, Electron **44.7.0**, `ical.js` **2.2.1**, `@electron/packager` **20.3.0**. Add nothing else to
the runtime.

## Host changes (`src/main.js`)

Keep one `main.js` for all desktop targets; branch on `process.platform` (`linux` here). `meta().platform = 'linux'`.

| Area | Linux behaviour |
| --- | --- |
| Data folder | `$XDG_CONFIG_HOME/ReminderFoxAgain` (default `~/.config/ReminderFoxAgain`) via `app.getPath('appData')`; `RF_DATA_DIR` still overrides. |
| ReminderFox add-on files | `~/.mozilla/firefox/*/reminderfox/reminderfox.ics`, `~/.thunderbird/*/…`, Snap `~/snap/firefox/common/.mozilla/firefox/*/…`, `~/snap/thunderbird/common/.thunderbird/*/…`, Flatpak `~/.var/app/org.mozilla.firefox/.mozilla/firefox/*/…`, `~/.var/app/org.mozilla.Thunderbird/.thunderbird/*/…`, plus SeaMonkey/Waterfox/Pale Moon (`~/.mozilla/seamonkey`, `~/.waterfox`, `~/.moonchild productions/pale moon`). |
| Window class | `app.setName('ReminderFoxAgain')`; the `.desktop` file's `StartupWMClass=ReminderFoxAgain` so docks group the windows. |
| Tray | Electron `Tray` with `assets/tray.png` (also ship 22/24 px from `reference/assets/linux/hicolor`). GNOME shows trays only with the AppIndicator extension. When `Tray` is unavailable or `process.env.XDG_CURRENT_DESKTOP` is GNOME and no StatusNotifier watcher exists on D-Bus, default `closeToTray` to false and explain in Settings → General: "Your desktop doesn't show tray icons; ReminderFoxAgain keeps running in the background while it's open — use Start when you log in so alarms still come." |
| Start at login | Electron's login items don't work on Linux: write/remove `~/.config/autostart/reminderfoxagain.desktop` (`Exec=<launcher> --hidden`, `X-GNOME-Autostart-enabled=true`). Label "Start ReminderFoxAgain when you log in". |
| Badge | `app.setBadgeCount(n)` (Unity launcher API; ignored where unsupported) and the tray image with the count. No overlay icon. |
| Alarm window | As Windows (frameless, always on top, bottom-right of the work area). Also send a desktop notification (`new Notification({title, body, silent:true})`) when a new alarm appears, in case the window is behind a full-screen app; clicking it shows the alarm window. |
| File dialogs | Electron's (GTK/portal). |
| Open folder / links | `shell.openPath`, `shell.openExternal` (xdg-open). |

Everything else is unchanged, including the UI, the alarm engine and the pop-up.

## Packaging (`build-linux.sh`)

1. Unit tests in seven zones.
2. `electron-packager . ReminderFoxAgain --platform=linux --arch=x64 (and again with --arch=arm64) --asar --icon=assets/icon.png
   --executable-name=reminderfoxagain` with the same ignore list as Windows. Keep only the en-US and en-GB locales plus those in `CHROMIUM_LOCALES` in `src/main.js` (30 files).
3. **Tarball** `ReminderFoxAgain-0.9.1-linux-x64.tar.gz` (and `-linux-arm64`): the app folder plus `install.sh`, `uninstall.sh`,
   `reminderfoxagain.desktop` and the hicolor icons. Make it deterministic with `tar --sort=name
   --mtime=@$SOURCE_DATE_EPOCH --owner=0 --group=0 --numeric-owner | gzip -n -9`, where `SOURCE_DATE_EPOCH=1767225600`.
4. **Debian package** `reminderfoxagain_0.9.1_amd64.deb` (and `_arm64.deb`) (`dpkg-deb --root-owner-group --build`, with
   `SOURCE_DATE_EPOCH` set and every file `touch`ed to it):
   - the app in `/opt/ReminderFoxAgain/`, a `/usr/bin/reminderfoxagain` symlink, the desktop file and
     `/usr/share/icons/hicolor/*/apps/reminderfoxagain.png`;
   - `chrome-sandbox` owned by root with mode 4755 (set in `postinst`);
   - an AppArmor profile `/etc/apparmor.d/reminderfoxagain` (`abi <abi/4.0>, include <tunables/global>, profile
     reminderfoxagain /opt/ReminderFoxAgain/reminderfoxagain flags=(unconfined) { userns, include if exists
     <local/reminderfoxagain> }`), loaded in `postinst` when `apparmor_parser` exists. Ubuntu 24.04+ needs it for
     Electron's sandbox;
   - `Depends: libgtk-3-0 | libgtk-3-0t64, libnss3, libasound2 | libasound2t64, libxss1, libgbm1, xdg-utils`.
5. Release files may exceed 30 MB: if a delivery limit applies, split them into 28 MiB `.partN` files plus a
   `join.sh`, as on Windows.

Two builds in a row must give identical SHA-256 for the tarball and the .deb.

### `install.sh` (per user, no root) and `uninstall.sh`

- `install.sh` copies the app to `~/.local/opt/ReminderFoxAgain` (staging folder, then swap, with rollback), links
  `~/.local/bin/reminderfoxagain`, and installs the desktop file to `~/.local/share/applications` and the icons to
  `~/.local/share/icons/hicolor`. It runs `update-desktop-database` and `gtk-update-icon-cache` when present.
- Updating replaces the program only. The data in `~/.config/ReminderFoxAgain` is never touched.
- Sandbox: if unprivileged user namespaces work (`unshare -Ur true`), launch normally. Otherwise the launcher passes
  `--no-sandbox` and `install.sh` prints why and how to install the .deb instead.
- `uninstall.sh` removes the program, links, desktop file, icons and autostart entry. It deletes the data only with
  `--purge` or when the user types YES.

## Checks

- `npm test` in 7 zones; the compatibility benchmark.
- `tools/e2e.sh` against the **packaged** Linux app as well as from source. Add `linux-host.js` checks: data folder
  under `XDG_CONFIG_HOME`; the autostart file is written and removed when "Start when you log in" is toggled;
  `findOld` finds a fake profile under each of the six locations above; `meta().platform` is `linux`; the tray-less
  default.
- `tools/test-linux-install.sh` with a fake `HOME`, at least 14 checks: fresh install, files in place, the launcher
  runs `--version`-style smoke (start with `RF_SCREENSHOT` and get a PNG), update keeps data, failed update rolls back,
  uninstall keeps data, `--purge` removes it, the .deb's contents and permissions (`dpkg-deb -c`) and maintainer
  scripts, the desktop file passes `desktop-file-validate` if available.
- Screenshots from the packaged app match `reference/screenshots/` (fonts may differ slightly; layout must not).

## Deliverables

`dist/release/`: the tarball, the .deb (and `.partN` splits if needed), `SHA256SUMS`; a source zip; screenshots; a
README with install, update and uninstall steps for both packages.
