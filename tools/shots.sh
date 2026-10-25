#!/usr/bin/env bash
# Makes every screenshot to compare with reference/screenshots/ (uses tools/screenshot.sh and tools/sample-data.js).
#   tools/shots.sh <outDir>
set -uo pipefail
cd "$(dirname "$0")/.."
OUT="$(realpath -m "${1:-shots}")"; mkdir -p "$OUT"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
shot() { # name sample [script]
  local d="$TMP/$1"; rm -rf "$d"
  if [ "$2" = empty ]; then mkdir -p "$d"; else node tools/sample-data.js "$d" "$2" >/dev/null; fi
  cp test/reminderfox-addon-sample.ics "$d/addon-sample.ics"   # for the import dialog
  tools/screenshot.sh "$d" "$OUT/$1.png" ${3:+tools/ui/shots/$3} | grep saved
}
shot 01-reminders-upcoming basic
shot 02-reminders-all-with-history bills 02-all.js
shot 03-reminders-past bills 03-past.js
shot 04-todos basic 04-todos.js
shot 05-month basic 05-month.js
shot 06-editor-timed-weekly basic 06-editor-timed.js
shot 07-editor-allday-yearly basic 07-editor-allday.js
shot 08-editor-todo basic 08-editor-todo.js
shot 09-context-menu basic 09-context.js
shot 10-delete-repeating basic 10-delete.js
shot 11-export basic 11-export.js
shot 12-settings basic 12-settings.js
shot 13-welcome empty
shot 14-dark-reminders basic 14-dark.js
shot 15-dark-month basic 15-dark-month.js
shot 20-addon-flags basic 20-addon-flags.js
shot 21-addon-editor basic 21-addon-editor.js
shot 22-addon-todos basic 22-addon-todos.js
for n in 26-settings-alarms 27-settings-display 28-settings-lists 29-settings-data 30-quick-alarm-dialog 31-suspend 32-view-editor \
  33-lists-my-order 34-lists-manager 35-categories 36-restore 37-three-months 38-reminder-popup 39-formats-go-to 40-past-repeats 41-upcoming-bills 42-todo-reminders 43-schedule-as-reminder \
  44-lists-dropdown 45-list-item-actions 46-remove-list; do
  shot "$n" basic "$n.js"
done
shot 47-import-dialog basic 47-import-dialog.js
for n in 51-month-show-completed 52-settings-columns 53-reminders-columns-hidden 54-manage-reminders 55-lists-order 56-theme-editor 57-custom-theme; do shot "$n" basic "$n.js"; done
# languages: German, Japanese settings, Arabic right to left (RF_LANG sets the language for one run)
RF_LANG=de shot 48-german-reminders basic
RF_LANG=ja-JP shot 50-japanese-settings basic 27-settings-display.js
RF_LANG=ar shot 49-arabic-month basic 49-month-rtl.js
for t in default fox light dark ocean contrast; do
  shot "17-theme-$t" basic "theme-$t.js"; shot "18-theme-$t-month" basic "theme-$t-month.js"
  mv "$OUT/17-theme-$t-alarm.png" "$OUT/19-theme-$t-alarm.png" 2>/dev/null
done
mv "$OUT/01-reminders-upcoming-alarm.png" "$OUT/16-alarm-window.png" 2>/dev/null
find "$OUT" -name "*-alarm.png" ! -name "19-*" -delete
ls "$OUT"
