#!/usr/bin/env bash
# Runs the installer in PowerShell 7 against fake %LOCALAPPDATA% / %APPDATA% folders. 20 checks.
#   tools/test-setup.sh [pwsh]
set -uo pipefail
cd "$(dirname "$0")/.."
PWSH="${1:-pwsh}"
VER="$(node -p 'require("./package.json").version')"
RTVER="$(node -p 'require("./node_modules/electron/package.json").version')"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
PASS=0; FAIL=0
check() { # description, then a shell test
  local d="$1"; shift
  if "$@" >/dev/null 2>&1; then PASS=$((PASS+1)); echo "PASS  $d"; else FAIL=$((FAIL+1)); echo "FAIL  $d"; fi
}
has() { grep -qF -- "$2" "$1"; }

# ------------------------------------------------------------ a small fake release
RT="$TMP/runtime"; mkdir -p "$RT/resources" "$RT/locales"
echo "fake exe" > "$RT/ReminderFoxAgain.exe"; echo "$RTVER" > "$RT/version"
echo "dll" > "$RT/ffmpeg.dll"; echo "pak" > "$RT/locales/en-US.pak"; echo "pak" > "$RT/locales/de.pak"; echo "LICENSE" > "$RT/LICENSE"
(cd "$RT" && zip -q -X -r "$TMP/runtime.zip" .)
REL="$TMP/release"; mkdir -p "$REL"
echo "app $VER build 1" > "$REL/ReminderFoxAgain-app-$VER.asar"
split -n 3 -d -a 1 "$TMP/runtime.zip" "$TMP/part."
for i in 0 1 2; do mv "$TMP/part.$i" "$REL/ReminderFoxAgain-runtime-$VER.part$((i+1)).bin"; done
installer/fill-setup.sh "$REL" "$VER" "$RTVER" "$REL/ReminderFoxAgain-app-$VER.asar" "$TMP/runtime.zip" 3
APPSHA="$(sha256sum "$REL/ReminderFoxAgain-app-$VER.asar" | cut -d' ' -f1)"

# a release folder with only the .bat, the .ps1 and the .asar (an update)
mkupdate() { # dir appText
  mkdir -p "$1"; echo "$2" > "$1/ReminderFoxAgain-app-$VER.asar"
  installer/fill-setup.sh "$1" "$VER" "$RTVER" "$1/ReminderFoxAgain-app-$VER.asar" "$TMP/runtime.zip" 3
}
run() { # home releaseDir [stdin] → output in $home/out.txt, exit code in $home/rc
  local home="$1"; mkdir -p "$home/Local" "$home/Roaming"
  LOCALAPPDATA="$home/Local" APPDATA="$home/Roaming" "$PWSH" -NoProfile -NonInteractive -File "$2/ReminderFoxAgain-Setup.ps1" > "$home/out.txt" 2>&1 < /dev/null
  echo $? > "$home/rc"
}
rc() { [ "$(cat "$1/rc")" = "$2" ]; }
P() { echo "$1/Local/Programs/$2"; }
# 1. fresh install from the parts
H="$TMP/h1"; run "$H" "$REL"; D="$(P "$H" ReminderFoxAgain)"
check "fresh install from parts succeeds" rc "$H" 0
check "fresh install: runtime extracted (exe, locales)" test -f "$D/ReminderFoxAgain.exe" -a -f "$D/locales/en-US.pak"
check "fresh install: installed app matches the release" test "$(sha256sum "$D/resources/app.asar" | cut -d' ' -f1)" = "$APPSHA"
check "fresh install: version file and uninstaller written" bash -c "[ \"\$(tr -d '\r\n' < '$D/reminderfoxagain-version.txt')\" = '$VER' ] && [ -f '$D/Uninstall ReminderFoxAgain.ps1' ]"
check "fresh install: no .new/.old folders left, success message" bash -c "[ ! -e '$D.new' ] && [ ! -e '$D.old' ] && grep -qF 'ReminderFoxAgain $VER is installed in $D' '$H/out.txt'"

# 2. update with only the app file reuses the installed runtime
U="$TMP/upd"; mkupdate "$U" "app $VER build 2"
run "$H" "$U"
check "update with only the app file succeeds" rc "$H" 0
check "update: says it reuses the installed runtime" has "$H/out.txt" "Reusing the installed runtime..."
check "update: app replaced, runtime kept" bash -c "grep -q 'build 2' '$D/resources/app.asar' && [ -f '$D/locales/en-US.pak' ] && [ -f '$D/ReminderFoxAgain.exe' ]"

# 3. a damaged app file is refused and nothing changes
B="$TMP/bad"; mkupdate "$B" "app $VER build 3"; echo "tampered" >> "$B/ReminderFoxAgain-app-$VER.asar"
BEFORE="$(cd "$D" && find . -type f -exec sha256sum {} + | sort | sha256sum)"
run "$H" "$B"
check "damaged app file is refused: says it is damaged and nothing was changed" bash -c "[ \"\$(cat '$H/rc')\" = 1 ] && grep -q 'is damaged' '$H/out.txt' && grep -qF 'Nothing was changed in your existing installation or your reminders.' '$H/out.txt'"
check "damaged app file: installation unchanged" test "$(cd "$D" && find . -type f -exec sha256sum {} + | sort | sha256sum)" = "$BEFORE"

# 4. missing parts are named
M="$TMP/miss"; cp -r "$REL" "$M"; rm "$M/ReminderFoxAgain-runtime-$VER.part2.bin"
H="$TMP/h4"; run "$H" "$M"
check "missing parts: refused, names the missing part" bash -c "[ \"\$(cat '$H/rc')\" = 1 ] && grep -q 'part2.bin' '$H/out.txt' && ! grep -q 'part1.bin,' '$H/out.txt'"
check "missing parts: nothing installed" test ! -e "$(P "$H" ReminderFoxAgain)"

# 5. nothing installed and no parts
H="$TMP/h5"; run "$H" "$U"
check "nothing installed, no parts: clear message" bash -c "[ \"\$(cat '$H/rc')\" = 1 ] && grep -q 'a new install needs the runtime parts' '$H/out.txt'"
check "nothing installed, no parts: nothing created" test ! -e "$(P "$H" ReminderFoxAgain)" -a ! -e "$(P "$H" ReminderFoxAgain).new"

# 6. an update over an install with stray files (a README, an old app backup) leaves a clean install, data untouched
H="$TMP/h6"; run "$H" "$REL"; D="$(P "$H" ReminderFoxAgain)"
echo "readme" > "$D/README.md"; echo "bak" > "$D/resources/app.asar.bak"
mkdir -p "$H/Roaming/ReminderFoxAgain/backups"; echo "BEGIN:VCALENDAR" > "$H/Roaming/ReminderFoxAgain/reminders.ics"
DATA_BEFORE="$(cd "$H/Roaming/ReminderFoxAgain" && find . -exec stat -c '%n %s %Y' {} + | sort | sha256sum)"
U1="$TMP/upd1"; mkupdate "$U1" "app $VER build 4"; run "$H" "$U1"
check "update over stray files: succeeds, strays removed, app replaced" bash -c "[ \"\$(cat '$H/rc')\" = 0 ] && [ ! -e '$D/README.md' ] && [ ! -e '$D/resources/app.asar.bak' ] && grep -q 'build 4' '$D/resources/app.asar' && [ -f '$D/ReminderFoxAgain.exe' ]"
check "update over stray files: data folder untouched" test "$(cd "$H/Roaming/ReminderFoxAgain" && find . -exec stat -c '%n %s %Y' {} + | sort | sha256sum)" = "$DATA_BEFORE"

# 7. a runtime from before 0.7.0 (no Chromium language files beyond English) is replaced when the parts are at hand
H="$TMP/h7"; run "$H" "$REL"; D="$(P "$H" ReminderFoxAgain)"; rm "$D/locales/de.pak"
U2="$TMP/upd2"; mkupdate "$U2" "app $VER build 5"; run "$H" "$U2"
check "old runtime, no parts: reused, with a note about the date pickers" bash -c "[ \"\$(cat '$H/rc')\" = 0 ] && grep -q 'date pickers in English only' '$H/out.txt' && grep -q 'build 5' '$D/resources/app.asar'"
run "$H" "$REL"
check "old runtime, parts at hand: the full runtime is installed" bash -c "[ \"\$(cat '$H/rc')\" = 0 ] && ! grep -q 'Reusing the installed runtime' '$H/out.txt' && [ -f '$D/locales/de.pak' ]"

# 8. uninstall removes the program and keeps the data unless YES is typed
H="$TMP/h1"; mkdir -p "$H/Roaming/ReminderFoxAgain"; echo "data" > "$H/Roaming/ReminderFoxAgain/reminders.ics"
UN="$(P "$H" ReminderFoxAgain)/Uninstall ReminderFoxAgain.ps1"
echo "no" | LOCALAPPDATA="$H/Local" APPDATA="$H/Roaming" "$PWSH" -NoProfile -File "$UN" > "$H/un1.txt" 2>&1
check "uninstall without YES: program removed, data kept" test ! -e "$(P "$H" ReminderFoxAgain)" -a -f "$H/Roaming/ReminderFoxAgain/reminders.ics"
run "$H" "$REL" >/dev/null
UN="$(P "$H" ReminderFoxAgain)/Uninstall ReminderFoxAgain.ps1"
echo "YES" | LOCALAPPDATA="$H/Local" APPDATA="$H/Roaming" "$PWSH" -NoProfile -File "$UN" > "$H/un2.txt" 2>&1
check "uninstall with YES: program and data removed" test ! -e "$(P "$H" ReminderFoxAgain)" -a ! -e "$H/Roaming/ReminderFoxAgain"

echo "$PASS/$((PASS+FAIL)) installer checks passed"
[ "$FAIL" -eq 0 ]
