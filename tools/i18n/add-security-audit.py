#!/usr/bin/env python3
# The security audit: the desktop app opens only files picked in it (a window that names any other file is refused).
# Run once, then node tools/i18n/build.js
import os
DIR = os.path.dirname(os.path.abspath(__file__))
EN = ["That file was not picked in ReminderFoxAgain, so it was not opened."]
L = {
 'de': ["Diese Datei wurde nicht in ReminderFoxAgain ausgewählt und daher nicht geöffnet."],
 'fr': ["Ce fichier n'a pas été choisi dans ReminderFoxAgain : il n'a donc pas été ouvert."],
 'es-ES': ["Ese archivo no se eligió en ReminderFoxAgain, así que no se abrió."],
 'it': ["Quel file non è stato scelto in ReminderFoxAgain, quindi non è stato aperto."],
 'nl': ["Dat bestand is niet in ReminderFoxAgain gekozen en is daarom niet geopend."],
 'pt-BR': ["Esse arquivo não foi escolhido no ReminderFoxAgain, por isso não foi aberto."],
 'pt-PT': ["Esse ficheiro não foi escolhido no ReminderFoxAgain, por isso não foi aberto."],
 'ca-AD': ["Aquest fitxer no s'ha triat a ReminderFoxAgain, així que no s'ha obert."],
 'gl-ES': ["Ese ficheiro non se escolleu en ReminderFoxAgain, así que non se abriu."],
 'da': ["Den fil blev ikke valgt i ReminderFoxAgain, så den blev ikke åbnet."],
 'nb-NO': ["Den filen ble ikke valgt i ReminderFoxAgain, så den ble ikke åpnet."],
 'sv-SE': ["Den filen valdes inte i ReminderFoxAgain, så den öppnades inte."],
 'fi': ["Tiedostoa ei valittu ReminderFoxAgainissa, joten sitä ei avattu."],
 'et-EE': ["Seda faili ei valitud ReminderFoxAgainis, seega seda ei avatud."],
 'fy-NL': ["Dat bestân is net yn ReminderFoxAgain keazen en is dêrom net iepene."],
 'ga-IE': ["Níor roghnaíodh an comhad sin in ReminderFoxAgain, mar sin níor osclaíodh é."],
 'cs-CZ': ["Tento soubor nebyl vybrán v ReminderFoxAgain, proto nebyl otevřen."],
 'sk-SK': ["Tento súbor nebol vybraný v ReminderFoxAgain, preto sa neotvoril."],
 'pl': ["Ten plik nie został wybrany w ReminderFoxAgain, więc nie został otwarty."],
 'hu-HU': ["Ezt a fájlt nem a ReminderFoxAgainben választották ki, ezért nem nyílt meg."],
 'ro-RO': ["Fișierul nu a fost ales în ReminderFoxAgain, așa că nu a fost deschis."],
 'ru-RU': ["Этот файл не был выбран в ReminderFoxAgain, поэтому он не открыт."],
 'uk-UA': ["Цей файл не було вибрано в ReminderFoxAgain, тому його не відкрито."],
 'be-BY': ["Гэты файл не быў выбраны ў ReminderFoxAgain, таму ён не адкрыты."],
 'tr': ["Bu dosya ReminderFoxAgain içinde seçilmedi, bu yüzden açılmadı."],
 'ar': ["لم يتم اختيار هذا الملف في ReminderFoxAgain، لذا لم يُفتح."],
 'he-IL': ["הקובץ הזה לא נבחר ב־ReminderFoxAgain, ולכן הוא לא נפתח."],
 'ja-JP': ["このファイルは ReminderFoxAgain で選ばれていないため、開きませんでした。"],
 'ko-KR': ["이 파일은 ReminderFoxAgain에서 선택하지 않았으므로 열지 않았습니다."],
 'zh-CN': ["该文件不是在 ReminderFoxAgain 中选择的，因此未打开。"],
 'zh-TW': ["這個檔案不是在 ReminderFoxAgain 中選取的，因此沒有開啟。"],
 'vi': ["Tệp này không được chọn trong ReminderFoxAgain nên không được mở."],
 'mn-MN': ["Энэ файлыг ReminderFoxAgain-д сонгоогүй тул нээгээгүй."],
}
def main():
    cat = os.path.join(DIR, 'catalog.txt')
    lines = [l for l in open(cat, encoding='utf8').read().split('\n') if l.strip() and not l.startswith('#')]
    if EN[0] in lines: print('already added'); return
    start = len(lines) + 1
    have = sorted(f[:-4] for f in os.listdir(DIR) if f.endswith('.txt') and f != 'catalog.txt')
    assert not [c for c in have if c not in L], [c for c in have if c not in L]
    with open(cat, 'a', encoding='utf8') as f:
        f.write('# the desktop app opens only files picked in it (security audit)\n')
        for s in EN: f.write(s + '\n')
    for code, tr in L.items():
        p = os.path.join(DIR, f'{code}.txt')
        txt = open(p, encoding='utf8').read()
        if not txt.endswith('\n'): txt += '\n'
        txt += ''.join(f'{start + i}| {t}\n' for i, t in enumerate(tr))
        open(p, 'w', encoding='utf8').write(txt)
main()
