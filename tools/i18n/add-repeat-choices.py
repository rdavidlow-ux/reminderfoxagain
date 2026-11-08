#!/usr/bin/env python3
# The original ReminderFox's repeat choices: Yearly by day, Monthly by day, Biweekly and More repeat options…, and how a
# choice and the day it means are joined ("Yearly by day: On the 1st Saturday of November"). Run once, then
# node tools/i18n/build.js
import os
DIR = os.path.dirname(os.path.abspath(__file__))
EN = ["Yearly by day", "Monthly by day", "Biweekly", "More repeat options…", "{name}: {detail}"]
L = {
 'de': ["Jährlich nach Wochentag", "Monatlich nach Wochentag", "Alle zwei Wochen", "Weitere Wiederholungsoptionen…", "{name}: {detail}"],
 'fr': ["Annuel par jour", "Mensuel par jour", "Toutes les deux semaines", "Plus d'options de répétition…", "{name} : {detail}"],
 'es-ES': ["Anual por día", "Mensual por día", "Cada dos semanas", "Más opciones de repetición…", "{name}: {detail}"],
 'it': ["Annuale per giorno", "Mensile per giorno", "Ogni due settimane", "Altre opzioni di ripetizione…", "{name}: {detail}"],
 'nl': ["Jaarlijks op weekdag", "Maandelijks op weekdag", "Om de week", "Meer herhaalopties…", "{name}: {detail}"],
 'pt-BR': ["Anual por dia da semana", "Mensal por dia da semana", "Quinzenal", "Mais opções de repetição…", "{name}: {detail}"],
 'pt-PT': ["Anual por dia da semana", "Mensal por dia da semana", "Quinzenal", "Mais opções de repetição…", "{name}: {detail}"],
 'ca-AD': ["Anual per dia", "Mensual per dia", "Cada dues setmanes", "Més opcions de repetició…", "{name}: {detail}"],
 'gl-ES': ["Anual por día", "Mensual por día", "Cada dúas semanas", "Máis opcións de repetición…", "{name}: {detail}"],
 'da': ["Årligt efter ugedag", "Månedligt efter ugedag", "Hver anden uge", "Flere gentagelsesmuligheder…", "{name}: {detail}"],
 'nb-NO': ["Årlig etter ukedag", "Månedlig etter ukedag", "Annenhver uke", "Flere gjentakelsesvalg…", "{name}: {detail}"],
 'sv-SE': ["Årligen per veckodag", "Månadsvis per veckodag", "Varannan vecka", "Fler upprepningsalternativ…", "{name}: {detail}"],
 'fi': ["Vuosittain viikonpäivän mukaan", "Kuukausittain viikonpäivän mukaan", "Joka toinen viikko", "Lisää toistovalintoja…", "{name}: {detail}"],
 'et-EE': ["Igal aastal nädalapäeva järgi", "Igal kuul nädalapäeva järgi", "Ülenädalati", "Rohkem kordamise valikuid…", "{name}: {detail}"],
 'fy-NL': ["Jierliks op wikedei", "Moanliks op wikedei", "Om de wike", "Mear werhellingsopsjes…", "{name}: {detail}"],
 'ga-IE': ["Bliantúil de réir lae", "Míosúil de réir lae", "Gach re seachtain", "Tuilleadh roghanna athdhéanta…", "{name}: {detail}"],
 'cs-CZ': ["Ročně podle dne v týdnu", "Měsíčně podle dne v týdnu", "Každý druhý týden", "Další možnosti opakování…", "{name}: {detail}"],
 'sk-SK': ["Ročne podľa dňa v týždni", "Mesačne podľa dňa v týždni", "Každý druhý týždeň", "Ďalšie možnosti opakovania…", "{name}: {detail}"],
 'pl': ["Co roku według dnia tygodnia", "Co miesiąc według dnia tygodnia", "Co dwa tygodnie", "Więcej opcji powtarzania…", "{name}: {detail}"],
 'hu-HU': ["Évente a hét napja szerint", "Havonta a hét napja szerint", "Kéthetente", "További ismétlési beállítások…", "{name}: {detail}"],
 'ro-RO': ["Anual după zi", "Lunar după zi", "La două săptămâni", "Mai multe opțiuni de repetare…", "{name}: {detail}"],
 'ru-RU': ["Ежегодно по дню недели", "Ежемесячно по дню недели", "Раз в две недели", "Другие варианты повтора…", "{name}: {detail}"],
 'uk-UA': ["Щороку за днем тижня", "Щомісяця за днем тижня", "Раз на два тижні", "Інші варіанти повтору…", "{name}: {detail}"],
 'be-BY': ["Штогод па дні тыдня", "Штомесяц па дні тыдня", "Раз на два тыдні", "Іншыя варыянты паўтору…", "{name}: {detail}"],
 'tr': ["Yıllık, haftanın gününe göre", "Aylık, haftanın gününe göre", "İki haftada bir", "Diğer yineleme seçenekleri…", "{name}: {detail}"],
 'ar': ["سنويًا حسب يوم الأسبوع", "شهريًا حسب يوم الأسبوع", "كل أسبوعين", "خيارات تكرار أخرى…", "{name}: {detail}"],
 'he-IL': ["שנתי לפי יום בשבוע", "חודשי לפי יום בשבוע", "כל שבועיים", "אפשרויות חזרה נוספות…", "{name}: {detail}"],
 'ja-JP': ["毎年（曜日指定）", "毎月（曜日指定）", "隔週", "その他の繰り返し…", "{name}：{detail}"],
 'ko-KR': ["매년(요일 기준)", "매월(요일 기준)", "격주", "추가 반복 옵션…", "{name}: {detail}"],
 'zh-CN': ["每年（按星期）", "每月（按星期）", "每两周", "更多重复选项…", "{name}：{detail}"],
 'zh-TW': ["每年（依星期）", "每月（依星期）", "每兩週", "更多重複選項…", "{name}：{detail}"],
 'vi': ["Hằng năm theo thứ", "Hằng tháng theo thứ", "Hai tuần một lần", "Thêm tùy chọn lặp lại…", "{name}: {detail}"],
 'mn-MN': ["Жил бүр гаригаар", "Сар бүр гаригаар", "Хоёр долоо хоног тутам", "Давталтын нэмэлт сонголт…", "{name}: {detail}"],
}
def main():
    cat = os.path.join(DIR, 'catalog.txt')
    lines = [l for l in open(cat, encoding='utf8').read().split('\n') if l.strip() and not l.startswith('#')]
    if EN[0] in lines: print('already added'); return
    start = len(lines) + 1
    have = sorted(f[:-4] for f in os.listdir(DIR) if f.endswith('.txt') and f != 'catalog.txt')
    assert not [c for c in have if c not in L], [c for c in have if c not in L]
    with open(cat, 'a', encoding='utf8') as f:
        f.write('# the repeat choices of the original ReminderFox\n')
        for s in EN: f.write(s + '\n')
    for code, tr in L.items():
        p = os.path.join(DIR, f'{code}.txt')
        txt = open(p, encoding='utf8').read()
        if not txt.endswith('\n'): txt += '\n'
        txt += ''.join(f'{start + i}| {t}\n' for i, t in enumerate(tr))
        open(p, 'w', encoding='utf8').write(txt)
main()
