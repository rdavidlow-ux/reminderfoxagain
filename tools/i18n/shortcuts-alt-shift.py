#!/usr/bin/env python3
# The desktop app's shortcuts become the Thunderbird add-on's (Alt+Shift and a letter, owner's request, Nov 1 2026):
# rewrites "Ctrl+N" / "Strg+N"… in catalog.txt and every <code>.txt, in place (line numbers stay), then run
# node tools/i18n/build.js. Run once; a second run changes nothing.
import os, re
DIR = os.path.dirname(os.path.abspath(__file__))
MAP = {'N': 'A', 'T': 'O', 'Q': 'Q', 'F': 'K', 'G': 'J', 'B': 'B', 'I': 'I', 'E': 'X', 'D': 'D', 'S': 'S', 'L': 'L'}
RX = re.compile(r'\b(?:Ctrl|Strg)\+([NTQFGBIEDSL])\b')
n = 0
for f in sorted(os.listdir(DIR)):
    if not f.endswith('.txt'): continue
    p = os.path.join(DIR, f)
    s = open(p, encoding='utf8').read()
    t = RX.sub(lambda m: f'Alt+Shift+{MAP[m.group(1)]}', s)
    if t != s: open(p, 'w', encoding='utf8').write(t); n += 1
print('rewrote', n, 'files')
