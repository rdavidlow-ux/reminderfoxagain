#!/usr/bin/env bash
# Builds the Linux releases of ReminderFoxAgain into dist/release-linux/ (x64 and arm64):
#   ReminderFoxAgain-<ver>-linux-<arch>.tar.gz   unpack, run ./install.sh (for you, no root)
#   reminderfoxagain_<ver>_<amd64|arm64>.deb     Debian, Ubuntu, Mint…: sudo apt install ./reminderfoxagain_….deb
# Two builds in a row give identical SHA-256 hashes. ARCHS="x64" builds just one.
set -euo pipefail
cd "$(dirname "$0")"
export TZ=UTC LC_ALL=C SOURCE_DATE_EPOCH=1767225600   # 2026-01-01 00:00:00 UTC
umask 022
VER="$(node -p 'require("./package.json").version')"
STAMP='2026-01-01 00:00:00 UTC'
ARCHS="${ARCHS:-x64 arm64}"
OUT="dist/linux"; REL="dist/release-linux"
rm -rf "$OUT" "$REL"; mkdir -p "$OUT" "$REL"
KEEP="en-US en-GB $(node -e "const t=require('fs').readFileSync('src/main.js','utf8');console.log(eval(/CHROMIUM_LOCALES = (\[[^\]]*\])/.exec(t)[1]).join(' '))")"
IGNORE=(--ignore='^/test' --ignore='^/tools' --ignore='^/shots' --ignore='^/dist' --ignore='^/installer' --ignore='^/build($|/)' --ignore='^/build.*\.sh$'
  --ignore='\.zip$' --ignore='^/docs' --ignore='\.md$' --ignore='^/node_modules/(?!ical\.js)' --ignore='^/node_modules/ical\.js/(lib|dist/types)')

for A in $ARCHS; do
  DA=$([ "$A" = x64 ] && echo amd64 || echo arm64)
  echo "== $A: package"
  npx --no-install electron-packager . ReminderFoxAgain --platform=linux --arch="$A" --executable-name=reminderfoxagain --out="$OUT" --overwrite --asar \
    --app-copyright=ReminderFoxAgain "${IGNORE[@]}" >/dev/null
  APP="$OUT/ReminderFoxAgain-linux-$A"
  [ -x "$APP/reminderfoxagain" ] || { echo "packaging failed"; exit 1; }
  for f in "$APP"/locales/*.pak; do n="$(basename "$f" .pak)"; [[ " $KEEP " == *" $n "* ]] || rm -f "$f"; done
  chmod -R u=rwX,go=rX "$APP"; chmod 755 "$APP/reminderfoxagain" "$APP/chrome-sandbox" "$APP/chrome_crashpad_handler"

  echo "== $A: tar.gz"
  T="$OUT/ReminderFoxAgain-$VER-linux-$A"; rm -rf "$T"; mkdir -p "$T/icons"
  cp -a "$APP" "$T/app"
  cp build/linux/install.sh build/linux/uninstall.sh build/linux/reminderfoxagain.desktop "$T/"
  cp -R build/linux/hicolor "$T/icons/"; mkdir -p "$T/icons/hicolor/scalable/apps"; cp build/linux/reminderfoxagain.svg "$T/icons/hicolor/scalable/apps/"
  echo "$VER" > "$T/VERSION"; echo "$A" > "$T/ARCH"; cp LICENSE "$T/LICENSE.txt"
  cat > "$T/README.txt" <<R
ReminderFoxAgain $VER for Linux ($A)

Install or update (for you, no root needed):   ./install.sh
Remove (your reminders are kept):              ./uninstall.sh      (./uninstall.sh --purge removes them too)

The app goes to ~/.local/opt/ReminderFoxAgain, with a menu entry and the command ~/.local/bin/reminderfoxagain.
Your reminders are in ~/.config/ReminderFoxAgain/reminders.ics.
On Debian, Ubuntu, Mint and the like you can use the .deb instead: sudo apt install ./reminderfoxagain_${VER}_$DA.deb
On GNOME, add the "AppIndicator and KStatusNotifierItem Support" extension to see the fox in the top bar.
R
  find "$T" -exec touch -h -d "$STAMP" {} +
  tar --sort=name --mtime="@$SOURCE_DATE_EPOCH" --owner=0 --group=0 --numeric-owner --format=gnu -C "$OUT" -cf - "$(basename "$T")" | gzip -n -9 > "$REL/ReminderFoxAgain-$VER-linux-$A.tar.gz"

  echo "== $A: .deb"
  D="$OUT/deb-$A"; rm -rf "$D"
  mkdir -p "$D/DEBIAN" "$D/opt" "$D/usr/bin" "$D/usr/share/applications" "$D/usr/share/icons" "$D/usr/share/reminderfoxagain" "$D/usr/share/doc/reminderfoxagain"
  cp -a "$APP" "$D/opt/ReminderFoxAgain"
  ln -s ../../opt/ReminderFoxAgain/reminderfoxagain "$D/usr/bin/reminderfoxagain"
  cp build/linux/reminderfoxagain.desktop "$D/usr/share/applications/"
  cp -R build/linux/hicolor "$D/usr/share/icons/"; mkdir -p "$D/usr/share/icons/hicolor/scalable/apps"; cp build/linux/reminderfoxagain.svg "$D/usr/share/icons/hicolor/scalable/apps/"
  cp build/linux/deb/apparmor-profile "$D/usr/share/reminderfoxagain/"
  { echo "Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/"; echo "Upstream-Name: ReminderFoxAgain"; echo "Source: https://github.com/rdavidlow-ux/reminderfoxagain"; echo
    echo "Files: *"; echo "Copyright: ReminderFoxAgain contributors"; echo "License: GPL-3.0-or-later"; echo " On Debian systems the full text is in /usr/share/common-licenses/GPL-3."; } > "$D/usr/share/doc/reminderfoxagain/copyright"
  cp build/linux/deb/postinst build/linux/deb/postrm "$D/DEBIAN/"
  SIZE=$(du -sk --exclude=DEBIAN "$D" | cut -f1)
  cat > "$D/DEBIAN/control" <<C
Package: reminderfoxagain
Version: $VER
Architecture: $DA
Maintainer: ReminderFoxAgain <rdavidlow@gmail.com>
Installed-Size: $SIZE
Depends: libgtk-3-0 | libgtk-3-0t64, libnss3, libasound2 | libasound2t64, libxss1, libgbm1, xdg-utils
Recommends: libnotify4, libayatana-appindicator3-1 | libappindicator3-1
Section: utils
Priority: optional
Homepage: https://github.com/rdavidlow-ux/reminderfoxagain
Description: Reminders, to-dos and pop-up alarms
 ReminderFoxAgain is a desktop app for reminders, to-do lists and alarms,
 a tribute to the ReminderFox add-on for Firefox and Thunderbird. It reads
 and writes the add-on's .ics file, so your old reminders come with you.
C
  ( cd "$D" && find . -type f ! -path './DEBIAN/*' -printf '%P\n' | sort | xargs -d '\n' md5sum ) > "$D/DEBIAN/md5sums"
  chmod 644 "$D/DEBIAN/control" "$D/DEBIAN/md5sums"
  find "$D" -exec touch -h -d "$STAMP" {} +
  dpkg-deb --root-owner-group -Zxz -z9 --build "$D" "$REL/reminderfoxagain_${VER}_$DA.deb" >/dev/null
done
find "$REL" -exec touch -h -d "$STAMP" {} +
echo "== release"
( cd "$REL" && ls -l && sha256sum * ) | tee dist/SHA256SUMS-linux.txt
