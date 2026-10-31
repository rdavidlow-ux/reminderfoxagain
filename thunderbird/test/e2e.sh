#!/usr/bin/env bash
# UI checks for the experimental Thunderbird add-on: the built add-on (dist/thunderbird) in Chromium with a mock of
# Thunderbird's WebExtension API, running the desktop's tools/ui scripts plus its own (tb-smoke.js).
# Every line shows the value found and the expected one; WRONG or ERROR is a problem. Build first: ./build-thunderbird.sh
set -uo pipefail
cd "$(dirname "$0")/../.."
LOG="$(mktemp)"; trap 'rm -f "$LOG"' EXIT
run() { echo "== $*"; timeout 180 node thunderbird/test/run.js "$@" 2>&1 | grep '^E2E' | tee -a "$LOG"; }
run tb-smoke.js
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
run import-month.js
run view-options.js
run --sample bills place-themes.js
run --lang de i18n.js
run --lang ar i18n.js
for w in 820 990 1180; do run --size ${w}x760 --sample bills layout.js; run --size ${w}x760 layout.js; done
run --lang uk-UA --size 820x760 layout.js
echo "== done: $(grep -c '^E2E' "$LOG") checks, $(grep -c -E 'WRONG|ERROR' "$LOG") problem(s)"
