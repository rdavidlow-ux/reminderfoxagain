#!/usr/bin/env bash
# UI checks: runs each script in tools/ui/ against fresh sample data and prints its E2E lines.
# Every line shows the value found and the expected one; a mismatch is marked WRONG.
set -uo pipefail
cd "$(dirname "$0")/.."
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
run() { # name sample mainScript [alarmScript]   (env SIZE=WxH fixes the window size)
  [ -n "${ONLY:-}" ] && [[ " $ONLY " != *" $1 "* ]] && return 0   # ONLY="lists archive" runs just those
  local dir="$TMP/${KEEP:-$1}"   # KEEP=<earlier run> runs again on that run's data and settings
  if [ -z "${KEEP:-}" ]; then rm -rf "$dir"; node tools/sample-data.js "$dir" "$2" >/dev/null; fi
  cp test/reminderfox-addon-sample.ics "$dir/addon-sample.ics"
  [ -n "${ARCHIVE:-}" ] && cp "$ARCHIVE" "$dir/archive.ics"   # an archive.ics left by an earlier version
  mkdir -p "$dir/addon-profile/reminderfox"   # an add-on profile: its file plus the prefs.js with its list names
  cp test/reminderfox-addon-full.ics "$dir/addon-profile/reminderfox/reminderfox.ics"; cp test/reminderfox-addon-prefs.js "$dir/addon-profile/prefs.js"
  echo "== $1"
  RF_WINDOW_SIZE="${SIZE:-}" XDG_CONFIG_HOME="$TMP/profile-${KEEP:-$1}" RF_DATA_DIR="$dir" RF_SCREENSHOT="$TMP/$1.png" RF_SCRIPT="$(pwd)/tools/ui/$3" RF_ALARM_SCRIPT="${4:+$(pwd)/tools/ui/$4}" \
    timeout 120 xvfb-run -a -s "-screen 0 1400x900x24" ./node_modules/.bin/electron tools/console-wrapper.js --no-sandbox --disable-gpu \
    > "$TMP/$1.log" 2>/dev/null
  if grep -q '^E2E' "$TMP/$1.log"; then grep '^E2E' "$TMP/$1.log"; else echo "E2E ERROR no output from $1"; fi
}
run editor-and-todos basic editor-and-todos.js
run history bills history.js
run positions bills positions.js
run snooze basic snooze.js
run alarm-snooze basic none.js alarm-snooze.js
run alarm-continuous basic none.js alarm-continuous.js
run themes basic themes.js
run addon-compat basic addon-compat.js
ARCHIVE=test/archive-sample.ics run archive-to-list basic archive-to-list.js
run past-repeats basic past-repeats.js
run upcoming-import basic upcoming-import.js
run todo-remind basic todo-remind.js
run lists-views basic lists-views.js
run lists basic lists.js
run alarms-data basic alarms-data.js
run import-month basic import-month.js
run view-options basic view-options.js
run place-themes bills place-themes.js
# languages: chosen for the run, taken from the system locale, picked in Settings (used from the next start), right-to-left
RF_LANG=de run i18n-de basic i18n.js
LANG=fr_FR.UTF-8 LC_ALL=fr_FR.UTF-8 LANGUAGE=fr run i18n-system-fr basic i18n.js
run i18n-pick basic i18n-pick.js
KEEP=i18n-pick run i18n-picked basic i18n.js
RF_LANG=ar run i18n-ar basic i18n.js
for w in 990 1180; do
  SIZE=${w}x760 run "layout-$w-bills" bills layout.js
  SIZE=${w}x760 run "layout-$w-basic" basic layout.js
done
echo "== done: $(grep -h '^E2E' "$TMP"/*.log | grep -c -E 'WRONG|ERROR') problem(s)"
