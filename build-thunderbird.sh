#!/usr/bin/env bash
# Builds the experimental Thunderbird add-on (Thunderbird 128 or later) into dist/release-thunderbird/:
#   ReminderFoxAgain-<ver>-thunderbird.xpi
# Two builds in a row give identical SHA-256 hashes. Install it in Thunderbird from Add-ons and Themes → ⚙ →
# Install Add-on From File…, or load dist/thunderbird/manifest.json from about:debugging for a quick try.
set -euo pipefail
cd "$(dirname "$0")"
export TZ=UTC LC_ALL=C SOURCE_DATE_EPOCH=1767225600   # 2026-01-01 00:00:00 UTC
umask 022
VER="$(node -p 'require("./package.json").version')"
echo "== unit tests"
npm test --silent >/dev/null
echo "== add-on files"
node thunderbird/build.js
REL="dist/release-thunderbird"; rm -rf "$REL"; mkdir -p "$REL"
XPI="$(pwd)/$REL/ReminderFoxAgain-$VER-thunderbird.xpi"
find dist/thunderbird -exec touch -h -d "@$SOURCE_DATE_EPOCH" {} +
# manifest.json first, then everything else in a fixed order
( cd dist/thunderbird && { echo manifest.json; find . -type f ! -name manifest.json -printf '%P\n' | sort; } | zip -q -X -9 -D "$XPI" -@ )
( cd "$REL" && ls -l && sha256sum * ) | tee dist/SHA256SUMS-thunderbird.txt
