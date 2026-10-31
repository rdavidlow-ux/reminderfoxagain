#!/usr/bin/env bash
# Checks the Windows installer (NSIS) under Wine in a fresh, throw-away Wine prefix: a new install, an update over a
# 0.9.1-style install (the earlier PowerShell setup), and a silent uninstall.
#   tools/test-installer.sh [dist/release/ReminderFoxAgain-Setup-<ver>.exe]     (needs wine with 64-bit support)
set -uo pipefail
cd "$(dirname "$0")/.."
VER="$(node -p 'require("./package.json").version')"
SETUP="$(realpath "${1:-dist/release/ReminderFoxAgain-Setup-$VER.exe}")"
export WINEPREFIX="$(mktemp -d)" WINEDEBUG=-all
trap 'wineserver -k >/dev/null 2>&1; rm -rf "$WINEPREFIX"' EXIT
PROB=0
ok() { if eval "$2"; then echo "OK   $1"; else echo "FAIL $1"; PROB=$((PROB + 1)); fi; }
wine wineboot -i >/dev/null 2>&1
U="$WINEPREFIX/drive_c/users/$(whoami)"
DIR="$U/AppData/Local/Programs/ReminderFoxAgain"
DATA="$U/AppData/Roaming/ReminderFoxAgain"
KEY='HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\ReminderFoxAgain'
RUNKEY='HKCU\Software\Microsoft\Windows\CurrentVersion\Run'
reg() { wine reg query "$1" ${2:+/v "$2"} 2>/dev/null | tr -d '\r'; }
install() { timeout 600 wine "$SETUP" /S >/dev/null 2>&1; }

# the file itself
ok "a 64-bit Windows program" "python3 -c \"import struct,sys;d=open('$SETUP','rb').read(4096);o=struct.unpack_from('<I',d,0x3c)[0];sys.exit(0 if d[o:o+4]==b'PE\\\\0\\\\0' and struct.unpack_from('<H',d,o+4)[0]==0x8664 else 1)\""
ok "its version information says $VER" "python3 -c \"import sys;d=open('$SETUP','rb').read();sys.exit(0 if 'ReminderFoxAgain Setup'.encode('utf-16-le') in d and '$VER'.encode('utf-16-le') in d else 1)\""

# 1. a new install
install; rc=$?
ok "a silent install succeeds" '[ $rc = 0 ]'
ok "the app is in %LOCALAPPDATA%\\Programs\\ReminderFoxAgain" '[ -f "$DIR/ReminderFoxAgain.exe" ] && [ -f "$DIR/resources/app.asar" ] && [ -f "$DIR/locales/de.pak" ]'
ok "with its uninstaller" '[ -f "$DIR/Uninstall ReminderFoxAgain.exe" ]'
ok "Start-menu and desktop shortcuts" '[ -f "$U/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/ReminderFoxAgain.lnk" ] && [ -f "$U/Desktop/ReminderFoxAgain.lnk" ]'
ok "listed in Settings → Apps with version $VER" 'reg "$KEY" DisplayVersion | grep -q "$VER" && reg "$KEY" UninstallString | grep -q "Uninstall ReminderFoxAgain.exe"'
ok "a silent uninstall string" 'reg "$KEY" QuietUninstallString | grep -q "/S"'
ok "no PowerShell anywhere" '! reg "$KEY" | grep -qi powershell && ! ls "$DIR" | grep -qi "\.ps1$"'
ok "no staging folders left" '[ ! -e "$DIR.new" ] && [ ! -e "$DIR.old" ]'

# 2. an update over a 0.9.1-style install (the PowerShell setup) with your reminders in place
wine "$DIR/Uninstall ReminderFoxAgain.exe" /S _?="$(winepath -w "$DIR")" >/dev/null 2>&1
rm -rf "$DIR"; wine reg delete "$KEY" /f >/dev/null 2>&1
mkdir -p "$DIR/resources" "$DATA"
echo old > "$DIR/ReminderFoxAgain.exe"; echo old > "$DIR/resources/app.asar"; echo stale > "$DIR/stale-file.txt"
echo '# ps1' > "$DIR/Uninstall ReminderFoxAgain.ps1"
wine reg add "$KEY" /v DisplayVersion /d 0.9.1 /f >/dev/null 2>&1
wine reg add "$KEY" /v UninstallString /d 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "x.ps1"' /f >/dev/null 2>&1
printf 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n' > "$DATA/reminders.ics"; cp "$DATA/reminders.ics" "$WINEPREFIX/mark.ics"
install; rc=$?
ok "an update over 0.9.1 succeeds" '[ $rc = 0 ] && [ "$(head -c 2 "$DIR/ReminderFoxAgain.exe")" = MZ ]'
ok "old files and the old PowerShell uninstaller are gone" '[ ! -e "$DIR/stale-file.txt" ] && [ ! -e "$DIR/Uninstall ReminderFoxAgain.ps1" ]'
ok "the Settings → Apps entry is the new one" 'reg "$KEY" DisplayVersion | grep -q "$VER" && ! reg "$KEY" UninstallString | grep -qi powershell'
ok "your reminders untouched by the update" 'cmp -s "$DATA/reminders.ics" "$WINEPREFIX/mark.ics"'
install; rc=$?
ok "running Setup again (repair) works" '[ $rc = 0 ] && [ -f "$DIR/ReminderFoxAgain.exe" ] && [ ! -e "$DIR.old" ]'

# 3. a silent uninstall
wine reg add "$RUNKEY" /v org.reminderfoxagain.desktop /d '"x" --hidden' /f >/dev/null 2>&1
wine "$DIR/Uninstall ReminderFoxAgain.exe" /S >/dev/null 2>&1
for i in $(seq 60); do [ -e "$DIR" ] || break; sleep 1; done
ok "uninstall removes the app" '[ ! -e "$DIR" ]'
ok "…the shortcuts" '[ ! -e "$U/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/ReminderFoxAgain.lnk" ] && [ ! -e "$U/Desktop/ReminderFoxAgain.lnk" ]'
ok "…the Settings → Apps entry and start at login" '! reg "$KEY" | grep -q DisplayName && ! reg "$RUNKEY" org.reminderfoxagain.desktop | grep -q hidden'
ok "…and keeps your reminders (a silent uninstall never deletes them)" 'cmp -s "$DATA/reminders.ics" "$WINEPREFIX/mark.ics"'
echo "== $PROB problem(s)"; exit $PROB
