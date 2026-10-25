#!/usr/bin/env bash
# Fills in the setup template and writes it (CRLF) together with the .bat (CRLF) into a release folder.
#   installer/fill-setup.sh <releaseDir> <version> <runtimeVersion> <appAsar> <runtimeZipOrEmpty> <partCount>
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
out="$1"; ver="$2"; rtver="$3"; asar="$4"; zip="$5"; parts="$6"
apphash="$(sha256sum "$asar" | cut -d' ' -f1)"
rthash=""; [ -n "$zip" ] && rthash="$(sha256sum "$zip" | cut -d' ' -f1)"
sed -e "s/__VERSION__/$ver/g" -e "s/__RUNTIME_VERSION__/$rtver/g" -e "s/__APP_HASH__/$apphash/g" \
    -e "s/__RUNTIME_HASH__/$rthash/g" -e "s/__PART_COUNT__/$parts/g" "$here/ReminderFoxAgain-Setup.ps1" \
  | sed -e 's/\r$//' -e 's/$/\r/' > "$out/ReminderFoxAgain-Setup.ps1"
sed -e 's/\r$//' -e 's/$/\r/' "$here/Install or Update ReminderFoxAgain.bat" > "$out/Install or Update ReminderFoxAgain.bat"
