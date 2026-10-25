#!/bin/sh
# Removes ReminderFoxAgain installed by install.sh. Your reminders are kept (~/.config/ReminderFoxAgain)
# unless you add --purge.
set -eu
DATA_HOME=${XDG_DATA_HOME:-$HOME/.local/share}
CONF=${XDG_CONFIG_HOME:-$HOME/.config}
OPT=$HOME/.local/opt/ReminderFoxAgain
if pgrep -f "$OPT/reminderfoxagain" >/dev/null 2>&1; then echo "ReminderFoxAgain is running. Quit it first." >&2; exit 1; fi
rm -rf "$OPT"
rm -f "$HOME/.local/bin/reminderfoxagain" "$DATA_HOME/applications/reminderfoxagain.desktop" "$CONF/autostart/reminderfoxagain.desktop"
for d in "$DATA_HOME"/icons/hicolor/*/apps; do rm -f "$d/reminderfoxagain.png" "$d/reminderfoxagain.svg"; done
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database -q "$DATA_HOME/applications" 2>/dev/null || true
if [ "${1:-}" = "--purge" ]; then rm -rf "$CONF/ReminderFoxAgain"; echo "ReminderFoxAgain and your reminders were removed."
else echo "ReminderFoxAgain was removed. Your reminders are still in $CONF/ReminderFoxAgain (./uninstall.sh --purge removes them)."; fi
