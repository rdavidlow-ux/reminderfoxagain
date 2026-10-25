#!/usr/bin/env bash
# Runs the app against a data folder and saves a screenshot of the main window (and the alarm window, if any).
#   tools/screenshot.sh <dataDir> <out.png> [script.js]
set -euo pipefail
cd "$(dirname "$0")/.."
DATA="$(realpath -m "$1")"; OUT="$(realpath -m "$2")"; SCRIPT="${3:-}"
[ -n "$SCRIPT" ] && SCRIPT="$(realpath "$SCRIPT")"
mkdir -p "$(dirname "$OUT")"
# a throw-away browser profile per run, so remembered filters (localStorage) never leak between runs
PROFILE="$(mktemp -d)"; trap 'rm -rf "$PROFILE"' EXIT
XDG_CONFIG_HOME="$PROFILE" RF_DATA_DIR="$DATA" RF_SCREENSHOT="$OUT" RF_SCRIPT="$SCRIPT" RF_ALARM_SCRIPT="${RF_ALARM_SCRIPT:-}" \
  timeout 90 xvfb-run -a -s "-screen 0 1400x900x24" ./node_modules/.bin/electron . --no-sandbox --disable-gpu 2>&1 \
  | grep -v -E 'dbus|Fontconfig|libva|viz_main|gpu_init|ERROR:.*(bus|gl_|angle|command_buffer)' || true
[ -f "$OUT" ] && echo "saved $OUT"
