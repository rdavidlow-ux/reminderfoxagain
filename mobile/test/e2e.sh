#!/usr/bin/env bash
# UI checks for the Android app's web part (mobile/www) in Chromium: the desktop's tools/ui scripts at the desktop
# size (the same app must pass them), and the Android checks at a phone and a tablet size.
# Every line shows the value found and the expected one; WRONG or ERROR is a problem. Build first: node mobile/build-web.js
set -uo pipefail
cd "$(dirname "$0")/../.."
LOG="$(mktemp)"; trap 'rm -f "$LOG"' EXIT
run() { echo "== $*"; timeout 180 node mobile/test/run.js "$@" 2>&1 | grep '^E2E' | tee -a "$LOG"; }
run --size 390x844 android-phone.js
run --size 820x1180 android-phone.js
run --size 412x915 --lang de android-phone.js
run editor-and-todos.js
run --sample bills history.js
run --sample bills positions.js
run snooze.js
run --alarm alarm-snooze.js none.js
run --alarm alarm-continuous.js none.js
run themes.js
run addon-compat.js
run past-repeats.js
run upcoming-import.js
run todo-remind.js
run lists-views.js
run lists.js
run alarms-data.js
run alarms-view.js
run month-scroll.js
run --sample bills day-week.js
run archive-list.js
run subscriptions.js
run item-colours.js
run safe-html.js
run injection.js
run --sample bills keep-place.js
run import-month.js
run view-options.js
run --sample bills place-themes.js
run --lang de i18n.js
run --lang ar i18n.js
echo "== done: $(grep -c '^E2E' "$LOG") checks, $(grep -c -E 'WRONG|ERROR' "$LOG") problem(s)"
