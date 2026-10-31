#!/usr/bin/env bash
# Builds the Windows x64 release of ReminderFoxAgain into dist/release/.
# Two builds in a row give identical SHA-256 hashes for every release file.
set -euo pipefail
cd "$(dirname "$0")"
export TZ=UTC LC_ALL=C SOURCE_DATE_EPOCH=1767225600   # 2026-01-01 00:00:00 UTC
VER="$(node -p 'require("./package.json").version')"
RTVER="$(node -p 'require("./node_modules/electron/package.json").version')"
STAMP='2026-01-01 00:00:00 UTC'
PART_SIZE=$((28 * 1024 * 1024))

echo "== 1. unit tests"
for tz in America/Toronto UTC America/Los_Angeles Asia/Kolkata Australia/Sydney Pacific/Auckland Pacific/Honolulu; do
  printf '%-22s' "$tz"; TZ=$tz npm test --silent 2>&1 | grep -E '^# (pass|fail)' | tr '\n' ' '; echo
  TZ=$tz npm test --silent >/dev/null 2>&1 || { echo "unit tests failed in $tz"; exit 1; }
done

echo "== 2. package (win32 x64)"
rm -rf dist
npm run package --silent
APP="dist/ReminderFoxAgain-win32-x64"
[ -f "$APP/ReminderFoxAgain.exe" ] || { echo "packaging failed"; exit 1; }

echo "== 3. keep the Chromium locales of the app's languages (CHROMIUM_LOCALES in src/main.js)"
KEEP="en-US en-GB $(node -e "const t=require('fs').readFileSync('src/main.js','utf8');console.log(eval(/CHROMIUM_LOCALES = (\[[^\]]*\])/.exec(t)[1]).join(' '))")"
for f in "$APP"/locales/*.pak; do n="$(basename "$f" .pak)"; [[ " $KEEP " == *" $n "* ]] || rm -f "$f"; done
echo "   $(ls "$APP/locales" | wc -l) locale files" 

echo "== 4. app file"
REL="dist/release"; mkdir -p "$REL"
cp "$APP/resources/app.asar" "$REL/ReminderFoxAgain-app-$VER.asar"

echo "== 5. runtime zip (deterministic) in 28 MiB parts"
find "$APP" -exec touch -h -d "$STAMP" {} +
ZIP="$(pwd)/dist/runtime.zip"; rm -f "$ZIP"
( cd "$APP" && find . -mindepth 1 ! -path './resources/app.asar' -printf '%P\n' | sort | zip -q -X -9 -D "$ZIP" -@ )
split -b "$PART_SIZE" -d -a 2 "$ZIP" "dist/runtime.part."
PARTS=0
for f in $(ls dist/runtime.part.* | sort); do
  PARTS=$((PARTS + 1))
  mv "$f" "$REL/ReminderFoxAgain-runtime-$VER.part$PARTS.bin"
done

echo "== 6. setup script and .bat (CRLF)"
installer/fill-setup.sh "$REL" "$VER" "$RTVER" "$REL/ReminderFoxAgain-app-$VER.asar" "$ZIP" "$PARTS"
find "$REL" -exec touch -h -d "$STAMP" {} +

echo "== release"
( cd "$REL" && ls -l && sha256sum * ) | tee dist/SHA256SUMS.txt
