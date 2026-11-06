#!/usr/bin/env python3
# The Android app's phone layout: the ⋮ menu. Run once, then node tools/i18n/build.js
import os
DIR = os.path.dirname(os.path.abspath(__file__))
EN = ['More']  # "Views" is already in the catalog
L = {'de': ['Mehr'], 'fr': ['Plus'], 'es-ES': ['Más'], 'it': ['Altro'], 'nl': ['Meer'], 'pt-BR': ['Mais'], 'pt-PT': ['Mais'], 'ca-AD': ['Més'], 'gl-ES': ['Máis'], 'da': ['Mere'], 'nb-NO': ['Mer'], 'sv-SE': ['Mer'], 'fi': ['Lisää'], 'et-EE': ['Veel'], 'fy-NL': ['Mear'], 'ga-IE': ['Tuilleadh'], 'cs-CZ': ['Další'], 'sk-SK': ['Ďalšie'], 'pl': ['Więcej'], 'hu-HU': ['Továbbiak'], 'ro-RO': ['Mai mult'], 'ru-RU': ['Ещё'], 'uk-UA': ['Більше'], 'be-BY': ['Яшчэ'], 'tr': ['Daha fazla'], 'ar': ['المزيد'], 'he-IL': ['עוד'], 'ja-JP': ['その他'], 'ko-KR': ['더보기'], 'zh-CN': ['更多'], 'zh-TW': ['更多'], 'vi': ['Thêm'], 'mn-MN': ['Бусад']}
def main():
    cat = os.path.join(DIR, 'catalog.txt')
    lines = [l for l in open(cat, encoding='utf8').read().split('\n') if l.strip() and not l.startswith('#')]
    if EN[-1] in lines: print('already added'); return
    start = len(lines) + 1
    have = sorted(f[:-4] for f in os.listdir(DIR) if f.endswith('.txt') and f != 'catalog.txt')
    assert not [c for c in have if c not in L], [c for c in have if c not in L]
    assert all(len(v) == len(EN) for v in L.values())
    with open(cat, 'a', encoding='utf8') as f:
        f.write('# the Android app: the phone layout\n')
        for s in EN: f.write(s + '\n')
    for code, tr in L.items():
        p = os.path.join(DIR, f'{code}.txt')
        txt = open(p, encoding='utf8').read()
        if not txt.endswith('\n'): txt += '\n'
        txt += ''.join(f'{start + i}| {t}\n' for i, t in enumerate(tr))
        open(p, 'w', encoding='utf8').write(txt)
    print('added', len(EN), 'from', start)
main()
