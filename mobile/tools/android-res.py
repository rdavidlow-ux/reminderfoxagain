#!/usr/bin/env python3
# Puts ReminderFoxAgain's own resources into the native project (mobile/android), after `npx cap add android`:
# launcher icons (adaptive and legacy), the notification icon, the splash screens, the five alarm sounds,
# the permissions, the version and the backup rules. Run from the repository root:  python3 mobile/tools/android-res.py
# (needs Pillow). The results are committed; run it again after the version or the icons change.
import json, os, re, shutil
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
A = os.path.join(ROOT, 'build-prompt', 'reference', 'assets', 'android')
RES = os.path.join(ROOT, 'mobile', 'android', 'app', 'src', 'main', 'res')
APP = os.path.join(ROOT, 'mobile', 'android', 'app')
VER = json.load(open(os.path.join(ROOT, 'package.json')))['version']
a, b, c, d = ([int(x) for x in VER.split('.')] + [0])[:4]
CODE = a * 100000 + b * 1000 + c * 10 + d  # 0.9.5.1 -> 9051, 0.9.6 -> 9060: always growing (0.9.5 was 905)
BG = (0xFB, 0xF8, 0xF4)
DPI = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}


def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, optimize=True)


# launcher: legacy and round from the prepared mipmaps, the adaptive foreground and background from the 432 px masters
fg = Image.open(os.path.join(A, 'adaptive-foreground-432.png')).convert('RGBA')
bgimg = Image.open(os.path.join(A, 'adaptive-background-432.png')).convert('RGBA')
for d, f in DPI.items():
    legacy = Image.open(os.path.join(A, f'mipmap-{d}', 'ic_launcher.png')).convert('RGBA')
    save(legacy, os.path.join(RES, f'mipmap-{d}', 'ic_launcher.png'))
    save(legacy, os.path.join(RES, f'mipmap-{d}', 'ic_launcher_round.png'))
    n = round(108 * f)
    save(fg.resize((n, n), Image.LANCZOS), os.path.join(RES, f'mipmap-{d}', 'ic_launcher_foreground.png'))
    save(bgimg.resize((n, n), Image.LANCZOS), os.path.join(RES, f'mipmap-{d}', 'ic_launcher_background.png'))
    os.makedirs(os.path.join(RES, f'drawable-{d}'), exist_ok=True)
    shutil.copy(os.path.join(A, f'drawable-{d}', 'ic_stat_reminderfoxagain.png'), os.path.join(RES, f'drawable-{d}', 'ic_stat_reminderfoxagain.png'))
for name in ('ic_launcher.xml', 'ic_launcher_round.xml'):
    with open(os.path.join(RES, 'mipmap-anydpi-v26', name), 'w') as fh:
        fh.write('<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
                 '    <background android:drawable="@mipmap/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n')
with open(os.path.join(RES, 'values', 'ic_launcher_background.xml'), 'w') as fh:
    fh.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#FBF8F4</color>\n</resources>\n')

# splash screens: the icon in the middle of the app's background colour, at the template's sizes
icon = Image.open(os.path.join(ROOT, 'assets', 'icon.png')).convert('RGBA')
for dirpath, _, files in os.walk(RES):
    if 'splash.png' not in files:
        continue
    p = os.path.join(dirpath, 'splash.png')
    w, h = Image.open(p).size
    img = Image.new('RGB', (w, h), BG)
    s = round(min(w, h) * 0.28)
    ic = icon.resize((s, s), Image.LANCZOS)
    img.paste(ic, ((w - s) // 2, (h - s) // 2), ic)
    save(img, p)

# the alarm sounds (res/raw), for the notification channels
raw = os.path.join(RES, 'raw')
os.makedirs(raw, exist_ok=True)
for t in ('chime', 'bell', 'marimba', 'beeps', 'clock'):
    shutil.copy(os.path.join(ROOT, 'build-prompt', 'reference', 'assets', 'sounds', f'{t}.wav'), os.path.join(raw, f'{t}.wav'))

# what the app may do, the backup rules, the version
man = os.path.join(APP, 'src', 'main', 'AndroidManifest.xml')
m = open(man).read()
PERMS = ['INTERNET', 'POST_NOTIFICATIONS', 'SCHEDULE_EXACT_ALARM', 'RECEIVE_BOOT_COMPLETED', 'VIBRATE', 'WAKE_LOCK']
m = re.sub(r'\s*<uses-permission android:name="android\.permission\.[A-Z_]+" />', '', m)
m = m.replace('<!-- Permissions -->', '<!-- Permissions -->\n' + '\n'.join(f'    <uses-permission android:name="android.permission.{p}" />' for p in PERMS))
if 'dataExtractionRules' not in m:
    m = m.replace('android:allowBackup="true"', 'android:allowBackup="true"\n        android:dataExtractionRules="@xml/data_extraction_rules"\n        android:fullBackupContent="@xml/backup_rules"')
open(man, 'w').write(m)
with open(os.path.join(RES, 'xml', 'data_extraction_rules.xml'), 'w') as fh:
    fh.write('<?xml version="1.0" encoding="utf-8"?>\n<!-- Android\'s backup and device transfer keep the reminders, settings and backups (files/rfa) -->\n'
             '<data-extraction-rules>\n    <cloud-backup>\n        <include domain="file" path="rfa/" />\n    </cloud-backup>\n'
             '    <device-transfer>\n        <include domain="file" path="rfa/" />\n    </device-transfer>\n</data-extraction-rules>\n')
with open(os.path.join(RES, 'xml', 'backup_rules.xml'), 'w') as fh:
    fh.write('<?xml version="1.0" encoding="utf-8"?>\n<full-backup-content>\n    <include domain="file" path="rfa/" />\n</full-backup-content>\n')
g = os.path.join(APP, 'build.gradle')
s = open(g).read()
s = re.sub(r'versionCode \d+', f'versionCode {CODE}', s)
s = re.sub(r'versionName "[^"]*"', f'versionName "{VER}"', s)
open(g, 'w').write(s)
print('android resources for', VER, CODE)
