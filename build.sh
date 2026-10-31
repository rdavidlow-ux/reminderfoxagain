#!/usr/bin/env bash
# Builds the Windows x64 release of ReminderFoxAgain into dist/release/: one installer, ReminderFoxAgain-Setup-<ver>.exe
# (NSIS, per user, no administrator rights). Needs makensis (apt install nsis).
# Two builds in a row give identical SHA-256 hashes for every release file.
set -euo pipefail
cd "$(dirname "$0")"
export TZ=UTC LC_ALL=C SOURCE_DATE_EPOCH=1767225600   # 2026-01-01 00:00:00 UTC
VER="$(node -p 'require("./package.json").version')"
STAMP='2026-01-01 00:00:00 UTC'

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

echo "== 4. installer (NSIS)"
REL="dist/release"; mkdir -p "$REL"
node tools/installer-lang.js dist/lang.nsh
find "$APP" -exec touch -h -d "$STAMP" {} +
SETUP="$REL/ReminderFoxAgain-Setup-$VER.exe"
makensis -V2 -INPUTCHARSET UTF8 -DVERSION="$VER" -DAPPDIR="$(pwd)/$APP" -DLANGFILE="$(pwd)/dist/lang.nsh" \
  -DICON="$(pwd)/assets/icon.ico" -DWIZARD="$(pwd)/installer/wizard.bmp" -DOUTFILE="$(pwd)/$SETUP" installer/ReminderFoxAgain.nsi
[ -f "$SETUP" ] || { echo "makensis failed"; exit 1; }
# optional signing: SIGN_CERT=<.pfx> SIGN_PASS=<password> (osslsigncode)
if [ -n "${SIGN_CERT:-}" ]; then
  osslsigncode sign -pkcs12 "$SIGN_CERT" -pass "${SIGN_PASS:-}" -n ReminderFoxAgain -t http://timestamp.digicert.com -in "$SETUP" -out "$SETUP.signed" && mv "$SETUP.signed" "$SETUP"
fi
touch -d "$STAMP" "$SETUP"

echo "== release"
( cd "$REL" && ls -l && sha256sum * ) | tee dist/SHA256SUMS.txt
