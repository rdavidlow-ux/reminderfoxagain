#!/usr/bin/env python3
# Adds the strings for calendar subscriptions and the item colours of themes (desktop app and Thunderbird add-on) to
# catalog.txt and every <code>.txt (run once), then run: node tools/i18n/build.js
# The English strings are add-subscriptions-themes/en.txt, one per line; each language's are <code>.txt, line for line.
import os, re
DIR = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(DIR, 'add-subscriptions-themes')
rd = lambda f: open(os.path.join(SRC, f), encoding='utf8').read().rstrip('\n').split('\n')

def main():
    EN = rd('en.txt')
    cat = os.path.join(DIR, 'catalog.txt')
    lines = [l for l in open(cat, encoding='utf8').read().split('\n') if l.strip() and not l.startswith('#')]
    if EN[0] in lines: print('already added'); return
    for s in EN: assert s not in lines, s
    start = len(lines) + 1
    have = sorted(f[:-4] for f in os.listdir(DIR) if f.endswith('.txt') and f != 'catalog.txt')
    out = {}
    for code in have:
        tr = rd(f'{code}.txt')
        assert len(tr) == len(EN), (code, len(tr))
        for en, x in zip(EN, tr):
            assert x.strip(), (code, en)
            assert sorted(re.findall(r'\{\w+\}', en)) == sorted(re.findall(r'\{\w+\}', x)), (code, en, x)
            for w in ('https://', 'webcal://', '.ics', 'ReminderFoxAgain', '📅'):
                assert (w in en) == (w in x), (code, w, x)
        out[code] = tr
    with open(cat, 'a', encoding='utf8') as f:
        f.write('# calendar subscriptions, and the item colours of themes (desktop app and Thunderbird add-on)\n')
        for s in EN: f.write(s + '\n')
    for code, tr in out.items():
        p = os.path.join(DIR, f'{code}.txt')
        txt = open(p, encoding='utf8').read()
        if not txt.endswith('\n'): txt += '\n'
        txt += ''.join(f'{start + i}| {t}\n' for i, t in enumerate(tr))
        open(p, 'w', encoding='utf8').write(txt)
    print('added', len(EN), 'from', start, 'to', len(out), 'languages')

main()
