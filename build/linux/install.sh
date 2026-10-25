#!/bin/sh
# ReminderFoxAgain for Linux — installs or updates the app for you (no root needed):
#   the app        ~/.local/opt/ReminderFoxAgain
#   the launcher   ~/.local/bin/reminderfoxagain
#   the menu entry ~/.local/share/applications/reminderfoxagain.desktop (+ icons)
# Your reminders stay where they are (~/.config/ReminderFoxAgain). Run it again to update; ./uninstall.sh removes it.
# Options: --force (update even while the app is running)
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
FORCE=0; [ "${1:-}" = "--force" ] && FORCE=1
DATA_HOME=${XDG_DATA_HOME:-$HOME/.local/share}
OPT=$HOME/.local/opt/ReminderFoxAgain
BIN=$HOME/.local/bin
LAUNCHER=$BIN/reminderfoxagain
DESKTOP=$DATA_HOME/applications/reminderfoxagain.desktop
VER=$(cat "$HERE/VERSION")

[ -x "$HERE/app/reminderfoxagain" ] || { echo "The app folder is missing next to install.sh — unpack the whole .tar.gz first." >&2; exit 1; }
case "$(uname -m)" in x86_64|amd64) M=x64 ;; aarch64|arm64) M=arm64 ;; *) M=$(uname -m) ;; esac
[ "$M" = "$(cat "$HERE/ARCH")" ] || { echo "This download is for $(cat "$HERE/ARCH"); this computer is $M. Please get the matching file." >&2; exit 1; }
if [ $FORCE = 0 ] && pgrep -f "$OPT/reminderfoxagain" >/dev/null 2>&1; then
  echo "ReminderFoxAgain is running. Quit it first (right-click the fox in the tray → Quit), or run: $0 --force" >&2; exit 1
fi

# Chromium's sandbox needs unprivileged user namespaces when it isn't installed as root (the .deb does that).
# Where the system turns them off (e.g. Ubuntu 24.04 and later), the launcher starts the app with --no-sandbox.
userns_ok() {
  if command -v unshare >/dev/null 2>&1; then unshare -Ur true >/dev/null 2>&1; return $?; fi
  [ "$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null || echo 0)" = 0 ] &&
    [ "$(cat /proc/sys/kernel/unprivileged_userns_clone 2>/dev/null || echo 1)" = 1 ]
}
FLAGS=""; userns_ok || FLAGS=" --no-sandbox"

echo "Installing ReminderFoxAgain $VER for $(id -un)…"
mkdir -p "$(dirname "$OPT")" "$BIN" "$DATA_HOME/applications" "$DATA_HOME/icons"
NEW="$OPT.new.$$"; OLD="$OPT.old.$$"
cleanup() { rm -rf "$NEW"; if [ -d "$OLD" ] && [ ! -d "$OPT" ]; then mv "$OLD" "$OPT"; echo "Something went wrong; the earlier version was put back." >&2; fi; }
trap cleanup EXIT
cp -a "$HERE/app" "$NEW"
[ -d "$OPT" ] && mv "$OPT" "$OLD"
mv "$NEW" "$OPT"
rm -rf "$OLD"
trap - EXIT

cat > "$LAUNCHER.tmp" <<L
#!/bin/sh
exec "$OPT/reminderfoxagain"$FLAGS "\$@"
L
chmod 755 "$LAUNCHER.tmp"; mv "$LAUNCHER.tmp" "$LAUNCHER"

cp -R "$HERE/icons/hicolor" "$DATA_HOME/icons/"
sed "s|^Exec=.*|Exec=$LAUNCHER|" "$HERE/reminderfoxagain.desktop" > "$DESKTOP.tmp"; mv "$DESKTOP.tmp" "$DESKTOP"
# an autostart entry from an earlier version: point it at the launcher
AUTO=${XDG_CONFIG_HOME:-$HOME/.config}/autostart/reminderfoxagain.desktop
[ -f "$AUTO" ] && sed -i "s|^Exec=.*|Exec=\"$LAUNCHER\" --hidden|" "$AUTO"
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database -q "$DATA_HOME/applications" 2>/dev/null || true
command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -q -t "$DATA_HOME/icons/hicolor" 2>/dev/null || true

echo "Done. Start it from your applications menu (ReminderFoxAgain) or run: $LAUNCHER"
[ -n "$FLAGS" ] && echo "Note: this system doesn't let apps make their own sandbox, so it runs with --no-sandbox. The .deb package installs the sandbox helper instead."
case ":$PATH:" in *":$BIN:"*) ;; *) echo "($BIN is not on your PATH; the menu entry works anyway.)" ;; esac
