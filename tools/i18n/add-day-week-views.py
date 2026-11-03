#!/usr/bin/env python3
# The Month tab's Day and Week views. Run once, then node tools/i18n/build.js
# "Day (calendar view)" and "Week (calendar view)" are the names of the views (shown without the brackets in English):
# "Day" alone is the list's day-of-the-week column in some languages.
import os
DIR = os.path.dirname(os.path.abspath(__file__))
EN = ["Day (calendar view)", "Week (calendar view)", "Previous day", "Next day", "Previous week", "Next week"]
L = {
 'de': ["Tag", "Woche", "Vorheriger Tag", "Nächster Tag", "Vorherige Woche", "Nächste Woche"],
 'fr': ["Jour", "Semaine", "Jour précédent", "Jour suivant", "Semaine précédente", "Semaine suivante"],
 'es-ES': ["Día", "Semana", "Día anterior", "Día siguiente", "Semana anterior", "Semana siguiente"],
 'it': ["Giorno", "Settimana", "Giorno precedente", "Giorno successivo", "Settimana precedente", "Settimana successiva"],
 'nl': ["Dag", "Week", "Vorige dag", "Volgende dag", "Vorige week", "Volgende week"],
 'pt-BR': ["Dia", "Semana", "Dia anterior", "Próximo dia", "Semana anterior", "Próxima semana"],
 'pt-PT': ["Dia", "Semana", "Dia anterior", "Dia seguinte", "Semana anterior", "Semana seguinte"],
 'ca-AD': ["Dia", "Setmana", "Dia anterior", "Dia següent", "Setmana anterior", "Setmana següent"],
 'gl-ES': ["Día", "Semana", "Día anterior", "Día seguinte", "Semana anterior", "Semana seguinte"],
 'da': ["Dag", "Uge", "Forrige dag", "Næste dag", "Forrige uge", "Næste uge"],
 'nb-NO': ["Dag", "Uke", "Forrige dag", "Neste dag", "Forrige uke", "Neste uke"],
 'sv-SE': ["Dag", "Vecka", "Föregående dag", "Nästa dag", "Föregående vecka", "Nästa vecka"],
 'fi': ["Päivä", "Viikko", "Edellinen päivä", "Seuraava päivä", "Edellinen viikko", "Seuraava viikko"],
 'et-EE': ["Päev", "Nädal", "Eelmine päev", "Järgmine päev", "Eelmine nädal", "Järgmine nädal"],
 'fy-NL': ["Dei", "Wike", "Foarige dei", "Folgjende dei", "Foarige wike", "Folgjende wike"],
 'ga-IE': ["Lá", "Seachtain", "An lá roimhe", "An chéad lá eile", "An tseachtain roimhe", "An tseachtain seo chugainn"],
 'cs-CZ': ["Den", "Týden", "Předchozí den", "Další den", "Předchozí týden", "Další týden"],
 'sk-SK': ["Deň", "Týždeň", "Predchádzajúci deň", "Nasledujúci deň", "Predchádzajúci týždeň", "Nasledujúci týždeň"],
 'pl': ["Dzień", "Tydzień", "Poprzedni dzień", "Następny dzień", "Poprzedni tydzień", "Następny tydzień"],
 'hu-HU': ["Nap", "Hét", "Előző nap", "Következő nap", "Előző hét", "Következő hét"],
 'ro-RO': ["Zi", "Săptămână", "Ziua anterioară", "Ziua următoare", "Săptămâna anterioară", "Săptămâna următoare"],
 'ru-RU': ["День", "Неделя", "Предыдущий день", "Следующий день", "Предыдущая неделя", "Следующая неделя"],
 'uk-UA': ["День", "Тиждень", "Попередній день", "Наступний день", "Попередній тиждень", "Наступний тиждень"],
 'be-BY': ["Дзень", "Тыдзень", "Папярэдні дзень", "Наступны дзень", "Папярэдні тыдзень", "Наступны тыдзень"],
 'tr': ["Gün", "Hafta", "Önceki gün", "Sonraki gün", "Önceki hafta", "Sonraki hafta"],
 'ar': ["يوم", "أسبوع", "اليوم السابق", "اليوم التالي", "الأسبوع السابق", "الأسبوع التالي"],
 'he-IL': ["יום", "שבוע", "היום הקודם", "היום הבא", "השבוע הקודם", "השבוע הבא"],
 'ja-JP': ["日", "週", "前の日", "次の日", "前の週", "次の週"],
 'ko-KR': ["일", "주", "이전 날", "다음 날", "이전 주", "다음 주"],
 'zh-CN': ["日", "周", "前一天", "后一天", "上一周", "下一周"],
 'zh-TW': ["日", "週", "前一天", "後一天", "上一週", "下一週"],
 'vi': ["Ngày", "Tuần", "Ngày trước", "Ngày sau", "Tuần trước", "Tuần sau"],
 'mn-MN': ["Өдөр", "Долоо хоног", "Өмнөх өдөр", "Дараагийн өдөр", "Өмнөх долоо хоног", "Дараагийн долоо хоног"],
}
def main():
    cat = os.path.join(DIR, 'catalog.txt')
    lines = [l for l in open(cat, encoding='utf8').read().split('\n') if l.strip() and not l.startswith('#')]
    if EN[0] in lines: print('already added'); return
    start = len(lines) + 1
    have = sorted(f[:-4] for f in os.listdir(DIR) if f.endswith('.txt') and f != 'catalog.txt')
    assert not [c for c in have if c not in L], [c for c in have if c not in L]
    assert all(len(v) == len(EN) for v in L.values())
    with open(cat, 'a', encoding='utf8') as f:
        f.write('# the Month tab: Day and Week views\n')
        for s in EN: f.write(s + '\n')
    for code, tr in L.items():
        p = os.path.join(DIR, f'{code}.txt')
        txt = open(p, encoding='utf8').read()
        if not txt.endswith('\n'): txt += '\n'
        txt += ''.join(f'{start + i}| {t}\n' for i, t in enumerate(tr))
        open(p, 'w', encoding='utf8').write(txt)
    print('added', len(EN), 'from', start)
main()
