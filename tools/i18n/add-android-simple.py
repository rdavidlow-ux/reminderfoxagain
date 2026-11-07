#!/usr/bin/env python3
# Android, simple and streamlined: the Calendar view's agenda as a list or the hours, and the editors' More options.
# Run once, then node tools/i18n/build.js
import os
DIR = os.path.dirname(os.path.abspath(__file__))
EN = ["Hours", "Show the day as", "More options", "Fewer options"]
L = {
 'de': ["Stunden", "Den Tag zeigen als", "Weitere Optionen", "Weniger Optionen"],
 'fr': ["Heures", "Afficher la journée en", "Plus d'options", "Moins d'options"],
 'es-ES': ["Horas", "Mostrar el día como", "Más opciones", "Menos opciones"],
 'it': ["Ore", "Mostra la giornata come", "Altre opzioni", "Meno opzioni"],
 'nl': ["Uren", "Toon de dag als", "Meer opties", "Minder opties"],
 'pt-BR': ["Horas", "Mostrar o dia como", "Mais opções", "Menos opções"],
 'pt-PT': ["Horas", "Mostrar o dia como", "Mais opções", "Menos opções"],
 'ca-AD': ["Hores", "Mostra el dia com a", "Més opcions", "Menys opcions"],
 'gl-ES': ["Horas", "Amosar o día como", "Máis opcións", "Menos opcións"],
 'da': ["Timer", "Vis dagen som", "Flere indstillinger", "Færre indstillinger"],
 'nb-NO': ["Timer", "Vis dagen som", "Flere valg", "Færre valg"],
 'sv-SE': ["Timmar", "Visa dagen som", "Fler alternativ", "Färre alternativ"],
 'fi': ["Tunnit", "Näytä päivä", "Lisää valintoja", "Vähemmän valintoja"],
 'et-EE': ["Tunnid", "Näita päeva kui", "Rohkem valikuid", "Vähem valikuid"],
 'fy-NL': ["Oeren", "Lit de dei sjen as", "Mear opsjes", "Minder opsjes"],
 'ga-IE': ["Uaireanta", "Taispeáin an lá mar", "Tuilleadh roghanna", "Níos lú roghanna"],
 'cs-CZ': ["Hodiny", "Zobrazit den jako", "Další možnosti", "Méně možností"],
 'sk-SK': ["Hodiny", "Zobraziť deň ako", "Ďalšie možnosti", "Menej možností"],
 'pl': ["Godziny", "Pokaż dzień jako", "Więcej opcji", "Mniej opcji"],
 'hu-HU': ["Órák", "A nap megjelenítése", "További beállítások", "Kevesebb beállítás"],
 'ro-RO': ["Ore", "Arată ziua ca", "Mai multe opțiuni", "Mai puține opțiuni"],
 'ru-RU': ["Часы", "Показывать день как", "Другие параметры", "Меньше параметров"],
 'uk-UA': ["Години", "Показувати день як", "Інші параметри", "Менше параметрів"],
 'be-BY': ["Гадзіны", "Паказваць дзень як", "Іншыя параметры", "Менш параметраў"],
 'tr': ["Saatler", "Günü şöyle göster", "Daha fazla seçenek", "Daha az seçenek"],
 'ar': ["الساعات", "عرض اليوم على شكل", "خيارات أخرى", "خيارات أقل"],
 'he-IL': ["שעות", "הצגת היום כ", "אפשרויות נוספות", "פחות אפשרויות"],
 'ja-JP': ["時間", "1日の表示", "その他のオプション", "オプションを減らす"],
 'ko-KR': ["시간", "하루 보기 방식", "추가 옵션", "옵션 줄이기"],
 'zh-CN': ["小时", "当天显示为", "更多选项", "更少选项"],
 'zh-TW': ["小時", "當天顯示為", "更多選項", "較少選項"],
 'vi': ["Giờ", "Hiển thị ngày dạng", "Thêm tùy chọn", "Ít tùy chọn hơn"],
 'mn-MN': ["Цаг", "Өдрийг харуулах", "Нэмэлт сонголт", "Цөөн сонголт"],
}
def main():
    cat = os.path.join(DIR, 'catalog.txt')
    lines = [l for l in open(cat, encoding='utf8').read().split('\n') if l.strip() and not l.startswith('#')]
    if EN[0] in lines: print('already added'); return
    start = len(lines) + 1
    have = sorted(f[:-4] for f in os.listdir(DIR) if f.endswith('.txt') and f != 'catalog.txt')
    assert not [c for c in have if c not in L], [c for c in have if c not in L]
    with open(cat, 'a', encoding='utf8') as f:
        f.write('# Android: the agenda as the hours, and More options in the editors\n')
        for s in EN: f.write(s + '\n')
    for code, tr in L.items():
        p = os.path.join(DIR, f'{code}.txt')
        txt = open(p, encoding='utf8').read()
        if not txt.endswith('\n'): txt += '\n'
        txt += ''.join(f'{start + i}| {t}\n' for i, t in enumerate(tr))
        open(p, 'w', encoding='utf8').write(txt)
main()
