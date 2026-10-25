#!/usr/bin/env bash
# Builds the macOS release of ReminderFoxAgain into dist/release-macos/:
#   ReminderFoxAgain-<ver>-macos-universal.zip   one app for Apple silicon and Intel Macs (macOS 13 or later)
# Built on Linux: the app is ad-hoc signed (rcodesign), not notarized, so macOS asks once before it opens it.
# Two builds in a row give identical SHA-256 hashes. RCODESIGN=/path/to/rcodesign if it isn't on PATH.
set -euo pipefail
cd "$(dirname "$0")"
export TZ=UTC LC_ALL=C SOURCE_DATE_EPOCH=1767225600   # 2026-01-01 00:00:00 UTC
umask 022
VER="$(node -p 'require("./package.json").version')"
STAMP='2026-01-01 00:00:00 UTC'
RCODESIGN="${RCODESIGN:-$(command -v rcodesign || echo /home/claude/tools-bin/rcodesign)}"
OUT="dist/macos"; REL="dist/release-macos"
rm -rf "$OUT" "$REL"; mkdir -p "$OUT" "$REL"
KEEP="en en_GB $(node -e "const t=require('fs').readFileSync('src/main.js','utf8');console.log(eval(/CHROMIUM_LOCALES = (\[[^\]]*\])/.exec(t)[1]).map((l)=>l.replace('-','_')).join(' '))")"
IGNORE=(--ignore='^/test' --ignore='^/tools' --ignore='^/shots' --ignore='^/dist' --ignore='^/installer' --ignore='^/build($|/)' --ignore='^/build.*\.sh$'
  --ignore='\.zip$' --ignore='^/docs' --ignore='\.md$' --ignore='^/node_modules/(?!ical\.js)' --ignore='^/node_modules/ical\.js/(lib|dist/types)')

for A in arm64 x64; do
  echo "== package darwin $A"
  npx --no-install electron-packager . ReminderFoxAgain --platform=darwin --arch="$A" --out="$OUT" --overwrite --asar \
    --icon=build/macos/icon.icns --app-bundle-id=org.reminderfoxagain.desktop --app-category-type=public.app-category.productivity \
    --app-version="$VER" --build-version="$VER" --app-copyright=ReminderFoxAgain --darwin-dark-mode-support \
    --extend-info=build/macos/extend-info.plist "${IGNORE[@]}" >/dev/null
  APP="$OUT/ReminderFoxAgain-darwin-$A/ReminderFoxAgain.app"
  [ -d "$APP/Contents/MacOS" ] || { echo "packaging failed"; exit 1; }
  # keep the Chromium locales of the app's languages
  for d in "$APP/Contents/Frameworks/Electron Framework.framework/Versions/A/Resources/"*.lproj; do
    n="$(basename "$d" .lproj)"; [[ " $KEEP " == *" $n "* ]] || rm -rf "$d"
  done
done

echo "== universal (arm64 + x64)"
U="$OUT/universal/ReminderFoxAgain.app"; mkdir -p "$OUT/universal"
PATH="$(pwd)/build/macos:$PATH" node build/macos/universal.mjs "$OUT/ReminderFoxAgain-darwin-x64/ReminderFoxAgain.app" "$OUT/ReminderFoxAgain-darwin-arm64/ReminderFoxAgain.app" "$U"
build/macos/lipo -archs "$U/Contents/MacOS/ReminderFoxAgain"
chmod -R u+w,go-w "$U"

echo "== ad-hoc signature"
"$RCODESIGN" sign --entitlements-xml-file build/macos/entitlements.plist "$U" >/dev/null 2>"$OUT/sign.log" || { cat "$OUT/sign.log"; exit 1; }
"$RCODESIGN" verify "$U/Contents/MacOS/ReminderFoxAgain" >/dev/null 2>&1 && echo "   signature verifies"

echo "== zip (deterministic)"
cp LICENSE "$OUT/universal/LICENSE.txt"
cat > "$OUT/universal/README.txt" <<R
ReminderFoxAgain $VER for macOS (Apple silicon and Intel, macOS 13 Ventura or later)

1. Drag ReminderFoxAgain.app into your Applications folder.
2. The first time, macOS says it can't check the app for malicious software (it isn't notarized by Apple).
   Open it once anyway: macOS 15 Sequoia and later — try to open it, then System Settings → Privacy & Security →
   "Open Anyway"; macOS 13–14 — Control-click the app → Open → Open.
   Or, in Terminal:  xattr -dr com.apple.quarantine /Applications/ReminderFoxAgain.app
To update, quit the app and replace it with the new one. Your reminders are in
~/Library/Application Support/ReminderFoxAgain/reminders.ics and stay where they are.
R
find "$OUT/universal" -exec touch -h -d "$STAMP" {} +
ZIP="$(pwd)/$REL/ReminderFoxAgain-$VER-macos-universal.zip"
( cd "$OUT/universal" && find . -mindepth 1 -printf '%P\n' | sort | zip -q -y -X -9 "$ZIP" -@ )
touch -d "$STAMP" "$ZIP"
echo "== release"
( cd "$REL" && ls -l && sha256sum * ) | tee dist/SHA256SUMS-macos.txt
