#!/usr/bin/env bash
# Checks the Linux tar.gz: install.sh into a fake home (twice: install, then update), the files it puts in place,
# the app starting from the launcher, then uninstall.sh and --purge.   tools/test-linux-install.sh <the .tar.gz>
set -uo pipefail
TGZ="$(realpath "$1")"; T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
export HOME="$T/home" XDG_DATA_HOME= XDG_CONFIG_HOME=; unset XDG_DATA_HOME XDG_CONFIG_HOME; mkdir -p "$HOME"
PROB=0
ok() { if eval "$2"; then echo "OK   $1"; else echo "FAIL $1"; PROB=$((PROB + 1)); fi; }
mkdir "$T/x"; tar -xzf "$TGZ" -C "$T/x"; D="$(ls -d "$T"/x/ReminderFoxAgain-*)"
ok "unpacks to one folder with install.sh, uninstall.sh, app/" '[ -x "$D/install.sh" ] && [ -x "$D/uninstall.sh" ] && [ -x "$D/app/reminderfoxagain" ]'
ok "files in the archive belong to root (0/0)" '[ -z "$(tar -tvzf "$TGZ" | awk "{print \$2}" | grep -v "^root/root$\|^0/0$")" ]'
out="$("$D/install.sh" 2>&1)"; rc=$?
ok "install.sh succeeds" '[ $rc = 0 ]'
OPT="$HOME/.local/opt/ReminderFoxAgain"; L="$HOME/.local/bin/reminderfoxagain"; DT="$HOME/.local/share/applications/reminderfoxagain.desktop"
ok "app in ~/.local/opt" '[ -x "$OPT/reminderfoxagain" ] && [ -f "$OPT/resources/app.asar" ]'
ok "launcher runs the installed app" 'grep -q "^exec \"$OPT/reminderfoxagain\"" "$L" && [ -x "$L" ]'
ok "menu entry points at the launcher" 'grep -qx "Exec=$L" "$DT" && grep -qx "Icon=reminderfoxagain" "$DT"'
ok "icons in place (16…512 and scalable)" '[ "$(ls "$HOME"/.local/share/icons/hicolor/*/apps/reminderfoxagain.* | wc -l)" -ge 10 ]'
ok "the menu entry is valid" '! command -v desktop-file-validate >/dev/null || desktop-file-validate "$DT"'
# an earlier autostart entry is pointed at the launcher
mkdir -p "$HOME/.config/autostart"; printf '[Desktop Entry]\nType=Application\nExec="/somewhere/old" --hidden\n' > "$HOME/.config/autostart/reminderfoxagain.desktop"
echo "user data" > "$T/mark"; mkdir -p "$HOME/.config/ReminderFoxAgain"; cp "$T/mark" "$HOME/.config/ReminderFoxAgain/reminders.ics"
touch "$OPT/stale-file"
out="$("$D/install.sh" 2>&1)"; rc=$?
ok "running it again updates" '[ $rc = 0 ] && [ ! -e "$OPT/stale-file" ] && [ -x "$OPT/reminderfoxagain" ]'
ok "no leftovers of the swap" '[ -z "$(ls -d "$OPT".* 2>/dev/null)" ]'
ok "autostart entry now uses the launcher" 'grep -qx "Exec=\"$L\" --hidden" "$HOME/.config/autostart/reminderfoxagain.desktop"'
ok "reminders untouched by the update" 'cmp -s "$T/mark" "$HOME/.config/ReminderFoxAgain/reminders.ics"'
# a wrong download is refused
cp -a "$D" "$T/wrong"; echo other > "$T/wrong/ARCH"
ok "the wrong architecture is refused" '! "$T/wrong/install.sh" >/dev/null 2>&1'
# the app starts from the launcher and draws its window
mkdir -p "$T/data"
RF_DATA_DIR="$T/data" RF_SCREENSHOT="$T/shot.png" timeout 90 xvfb-run -a "$L" --no-sandbox --disable-gpu >/dev/null 2>&1
ok "the installed app starts and draws its window" '[ -s "$T/shot.png" ] && [ -f "$T/data/state.json" ]'
for i in $(seq 20); do pgrep -f "$OPT/" >/dev/null || break; sleep 0.5; done
( exec -a "$OPT/reminderfoxagain" sleep 30 ) & FAKE=$!; sleep 0.3
ok "uninstall.sh refuses while the app runs" '! "$D/uninstall.sh" >/dev/null 2>&1 && [ -e "$OPT" ]'
kill $FAKE 2>/dev/null; wait $FAKE 2>/dev/null
out="$("$D/uninstall.sh" 2>&1)"; rc=$?; [ $rc = 0 ] || echo "$out"
ok "uninstall.sh removes the app, launcher, menu entry, icons, autostart" '[ $rc = 0 ] && [ ! -e "$OPT" ] && [ ! -e "$L" ] && [ ! -e "$DT" ] && [ -z "$(find "$HOME/.local/share/icons" -name "reminderfoxagain.*")" ] && [ ! -e "$HOME/.config/autostart/reminderfoxagain.desktop" ]'
ok "…and keeps the reminders" 'cmp -s "$T/mark" "$HOME/.config/ReminderFoxAgain/reminders.ics"'
"$D/install.sh" >/dev/null 2>&1; "$D/uninstall.sh" --purge >/dev/null 2>&1
ok "--purge removes the reminders too" '[ ! -e "$HOME/.config/ReminderFoxAgain" ]'
echo "== $PROB problem(s)"; exit $PROB
