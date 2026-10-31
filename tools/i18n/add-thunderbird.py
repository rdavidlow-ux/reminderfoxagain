#!/usr/bin/env python3
# Adds the strings of the experimental Thunderbird add-on (thunderbird/) to catalog.txt and every <code>.txt (run once),
# then run: node tools/i18n/build.js
import os, re
DIR = os.path.dirname(os.path.abspath(__file__))
EN = [
 "Your reminders, to-dos and alarms in Thunderbird — a tribute to the original ReminderFox add-on.",
 "Save a copy of your reminders file",
 "Show a number on the ReminderFoxAgain toolbar button",
 "Your reminders are kept in your Thunderbird profile, with a backup every day.",
]
L = {
 'de': ["Ihre Erinnerungen, Aufgaben und Alarme in Thunderbird — eine Hommage an das ursprüngliche ReminderFox-Add-on.",
        "Eine Kopie Ihrer Erinnerungsdatei speichern", "Eine Zahl auf der ReminderFoxAgain-Schaltfläche in der Symbolleiste anzeigen",
        "Ihre Erinnerungen werden in Ihrem Thunderbird-Profil aufbewahrt, mit einer Sicherung pro Tag."],
 'fr': ["Vos rappels, tâches et alarmes dans Thunderbird — un hommage au module ReminderFox d'origine.",
        "Enregistrer une copie de votre fichier de rappels", "Afficher un nombre sur le bouton ReminderFoxAgain de la barre d'outils",
        "Vos rappels sont conservés dans votre profil Thunderbird, avec une sauvegarde chaque jour."],
 'es-ES': ["Sus recordatorios, tareas y alarmas en Thunderbird — un homenaje al complemento ReminderFox original.",
        "Guardar una copia de su archivo de recordatorios", "Mostrar un número en el botón de ReminderFoxAgain de la barra de herramientas",
        "Sus recordatorios se guardan en su perfil de Thunderbird, con una copia de seguridad cada día."],
 'it': ["I tuoi promemoria, attività e allarmi in Thunderbird — un omaggio al componente aggiuntivo ReminderFox originale.",
        "Salva una copia del file dei promemoria", "Mostra un numero sul pulsante di ReminderFoxAgain nella barra degli strumenti",
        "I tuoi promemoria sono conservati nel tuo profilo di Thunderbird, con un backup ogni giorno."],
 'nl': ["Uw herinneringen, taken en alarmen in Thunderbird — een eerbetoon aan de oorspronkelijke ReminderFox-add-on.",
        "Een kopie van uw herinneringenbestand opslaan", "Een getal op de ReminderFoxAgain-knop in de werkbalk tonen",
        "Uw herinneringen worden bewaard in uw Thunderbird-profiel, met elke dag een back-up."],
 'pt-BR': ["Seus lembretes, tarefas e alarmes no Thunderbird — uma homenagem ao complemento ReminderFox original.",
        "Salvar uma cópia do seu arquivo de lembretes", "Mostrar um número no botão do ReminderFoxAgain na barra de ferramentas",
        "Seus lembretes ficam guardados no seu perfil do Thunderbird, com um backup por dia."],
 'pt-PT': ["Os seus lembretes, tarefas e alarmes no Thunderbird — uma homenagem ao extra ReminderFox original.",
        "Guardar uma cópia do seu ficheiro de lembretes", "Mostrar um número no botão do ReminderFoxAgain na barra de ferramentas",
        "Os seus lembretes ficam guardados no seu perfil do Thunderbird, com uma cópia de segurança por dia."],
 'ca-AD': ["Els vostres recordatoris, tasques i alarmes al Thunderbird — un homenatge al complement ReminderFox original.",
        "Desa una còpia del fitxer de recordatoris", "Mostra un número al botó del ReminderFoxAgain de la barra d'eines",
        "Els vostres recordatoris es guarden al vostre perfil del Thunderbird, amb una còpia de seguretat cada dia."],
 'gl-ES': ["Os seus lembretes, tarefas e alarmas no Thunderbird — unha homenaxe ao complemento ReminderFox orixinal.",
        "Gardar unha copia do ficheiro de lembretes", "Mostrar un número no botón de ReminderFoxAgain da barra de ferramentas",
        "Os seus lembretes gárdanse no seu perfil de Thunderbird, cunha copia de seguranza cada día."],
 'da': ["Dine påmindelser, opgaver og alarmer i Thunderbird — en hyldest til den oprindelige ReminderFox-tilføjelse.",
        "Gem en kopi af din påmindelsesfil", "Vis et tal på ReminderFoxAgain-knappen i værktøjslinjen",
        "Dine påmindelser gemmes i din Thunderbird-profil med en sikkerhedskopi hver dag."],
 'nb-NO': ["Påminnelsene, oppgavene og alarmene dine i Thunderbird — en hyllest til det opprinnelige ReminderFox-tillegget.",
        "Lagre en kopi av påminnelsesfilen", "Vis et tall på ReminderFoxAgain-knappen i verktøylinjen",
        "Påminnelsene dine lagres i Thunderbird-profilen din, med en sikkerhetskopi hver dag."],
 'sv-SE': ["Dina påminnelser, uppgifter och larm i Thunderbird — en hyllning till det ursprungliga ReminderFox-tillägget.",
        "Spara en kopia av påminnelsefilen", "Visa ett tal på ReminderFoxAgain-knappen i verktygsfältet",
        "Dina påminnelser sparas i din Thunderbird-profil, med en säkerhetskopia varje dag."],
 'fi': ["Muistutuksesi, tehtäväsi ja hälytyksesi Thunderbirdissä — kunnianosoitus alkuperäiselle ReminderFox-lisäosalle.",
        "Tallenna kopio muistutustiedostosta", "Näytä luku ReminderFoxAgainin työkalupalkin painikkeessa",
        "Muistutuksesi säilytetään Thunderbird-profiilissasi, ja niistä otetaan varmuuskopio joka päivä."],
 'et-EE': ["Sinu meeldetuletused, ülesanded ja alarmid Thunderbirdis — austusavaldus algsele ReminderFoxi lisale.",
        "Salvesta meeldetuletuste faili koopia", "Näita arvu ReminderFoxAgaini tööriistariba nupul",
        "Sinu meeldetuletusi hoitakse sinu Thunderbirdi profiilis ja neist tehakse iga päev varukoopia."],
 'fy-NL': ["Jo oantinkers, taken en alarms yn Thunderbird — in earbetoan oan de oarspronklike ReminderFox-add-on.",
        "In kopy fan jo oantinkersbestân bewarje", "In getal op de ReminderFoxAgain-knop yn de arkbalke sjen litte",
        "Jo oantinkers wurde bewarre yn jo Thunderbird-profyl, mei alle dagen in reservekopy."],
 'ga-IE': ["Do mheabhrúcháin, do thascanna agus d'aláraim in Thunderbird — ómós don bhreiseán bunaidh ReminderFox.",
        "Sábháil cóip de do chomhad meabhrúchán", "Taispeáin uimhir ar chnaipe ReminderFoxAgain sa bharra uirlisí",
        "Coinnítear do mheabhrúcháin i do phróifíl Thunderbird, le cúltaca gach lá."],
 'cs-CZ': ["Vaše připomínky, úkoly a alarmy v Thunderbirdu — pocta původnímu doplňku ReminderFox.",
        "Uložit kopii souboru připomínek", "Zobrazit číslo na tlačítku ReminderFoxAgain na nástrojové liště",
        "Vaše připomínky jsou uloženy ve vašem profilu Thunderbirdu, se zálohou každý den."],
 'sk-SK': ["Vaše pripomienky, úlohy a alarmy v Thunderbirde — pocta pôvodnému doplnku ReminderFox.",
        "Uložiť kópiu súboru pripomienok", "Zobraziť číslo na tlačidle ReminderFoxAgain na paneli nástrojov",
        "Vaše pripomienky sú uložené vo vašom profile Thunderbirdu, so zálohou každý deň."],
 'pl': ["Twoje przypomnienia, zadania i alarmy w Thunderbirdzie — hołd dla oryginalnego dodatku ReminderFox.",
        "Zapisz kopię pliku przypomnień", "Pokazuj liczbę na przycisku ReminderFoxAgain na pasku narzędzi",
        "Twoje przypomnienia są przechowywane w profilu Thunderbirda, z kopią zapasową każdego dnia."],
 'hu-HU': ["Emlékeztetői, teendői és riasztásai a Thunderbirdben — tisztelgés az eredeti ReminderFox kiegészítő előtt.",
        "Másolat mentése az emlékeztetőfájlról", "Szám megjelenítése a ReminderFoxAgain eszköztárgombján",
        "Emlékeztetőit a Thunderbird-profilja tárolja, naponta készülő biztonsági mentéssel."],
 'ro-RO': ["Mementourile, sarcinile și alarmele dvs. în Thunderbird — un omagiu adus suplimentului ReminderFox original.",
        "Salvează o copie a fișierului de mementouri", "Afișează un număr pe butonul ReminderFoxAgain din bara de instrumente",
        "Mementourile dvs. sunt păstrate în profilul Thunderbird, cu o copie de rezervă în fiecare zi."],
 'ru-RU': ["Ваши напоминания, задачи и сигналы в Thunderbird — дань уважения оригинальному дополнению ReminderFox.",
        "Сохранить копию файла напоминаний", "Показывать число на кнопке ReminderFoxAgain на панели инструментов",
        "Ваши напоминания хранятся в профиле Thunderbird, резервная копия делается каждый день."],
 'uk-UA': ["Ваші нагадування, завдання й сигнали в Thunderbird — данина оригінальному додатку ReminderFox.",
        "Зберегти копію файлу нагадувань", "Показувати число на кнопці ReminderFoxAgain на панелі інструментів",
        "Ваші нагадування зберігаються у профілі Thunderbird, резервна копія створюється щодня."],
 'be-BY': ["Вашы напаміны, задачы і сігналы ў Thunderbird — даніна павагі арыгінальнаму дадатку ReminderFox.",
        "Захаваць копію файла напамінаў", "Паказваць лік на кнопцы ReminderFoxAgain на панэлі інструментаў",
        "Вашы напаміны захоўваюцца ў профілі Thunderbird, рэзервовая копія робіцца кожны дзень."],
 'tr': ["Thunderbird'de hatırlatıcılarınız, görevleriniz ve alarmlarınız — özgün ReminderFox eklentisine bir saygı.",
        "Hatırlatıcı dosyanızın bir kopyasını kaydet", "Araç çubuğundaki ReminderFoxAgain düğmesinde bir sayı göster",
        "Hatırlatıcılarınız Thunderbird profilinizde saklanır ve her gün yedeklenir."],
 'ar': ["تذكيراتك ومهامك ومنبّهاتك في Thunderbird — تحية للإضافة الأصلية ReminderFox.",
        "حفظ نسخة من ملف التذكيرات", "إظهار رقم على زر ReminderFoxAgain في شريط الأدوات",
        "تُحفظ تذكيراتك في ملف تعريف Thunderbird الخاص بك، مع نسخة احتياطية كل يوم."],
 'he-IL': ["התזכורות, המשימות וההתראות שלך ב־Thunderbird — מחווה לתוספת ReminderFox המקורית.",
        "שמירת עותק של קובץ התזכורות", "להציג מספר על הכפתור של ReminderFoxAgain בסרגל הכלים",
        "התזכורות שלך נשמרות בפרופיל של Thunderbird, עם גיבוי בכל יום."],
 'ja-JP': ["Thunderbird で使うリマインダー、ToDo、アラーム — オリジナルの ReminderFox アドオンへのオマージュです。",
        "リマインダーファイルのコピーを保存", "ツールバーの ReminderFoxAgain ボタンに数を表示する",
        "リマインダーは Thunderbird のプロファイルに保存され、毎日バックアップされます。"],
 'ko-KR': ["Thunderbird에서 쓰는 미리 알림, 할 일, 알람 — 원조 ReminderFox 부가 기능에 바치는 헌정입니다.",
        "미리 알림 파일의 사본 저장", "도구 모음의 ReminderFoxAgain 버튼에 숫자 표시",
        "미리 알림은 Thunderbird 프로필에 보관되며 매일 백업됩니다."],
 'zh-CN': ["在 Thunderbird 中管理你的提醒、待办和闹钟 — 向最初的 ReminderFox 附加组件致敬。",
        "保存提醒文件的副本", "在工具栏的 ReminderFoxAgain 按钮上显示数字",
        "你的提醒保存在 Thunderbird 配置文件中，每天备份一次。"],
 'zh-TW': ["在 Thunderbird 中管理你的提醒、待辦事項和鬧鐘 — 向最初的 ReminderFox 附加元件致敬。",
        "儲存提醒檔案的副本", "在工具列的 ReminderFoxAgain 按鈕上顯示數字",
        "你的提醒保存在 Thunderbird 設定檔中，每天備份一次。"],
 'vi': ["Lời nhắc, việc cần làm và báo thức của bạn trong Thunderbird — để tưởng nhớ tiện ích ReminderFox gốc.",
        "Lưu một bản sao tệp lời nhắc", "Hiện số trên nút ReminderFoxAgain ở thanh công cụ",
        "Lời nhắc của bạn được lưu trong hồ sơ Thunderbird, với một bản sao lưu mỗi ngày."],
 'mn-MN': ["Thunderbird доторх таны сануулга, хийх ажил, сэрүүлэг — анхны ReminderFox нэмэлтэд зориулсан хүндэтгэл.",
        "Сануулгын файлын хуулбарыг хадгалах", "Хэрэгслийн мөрийн ReminderFoxAgain товч дээр тоо харуулах",
        "Таны сануулгууд Thunderbird-ийн профайлд хадгалагдаж, өдөр бүр нөөцлөгдөнө."],
}

def main():
    cat = os.path.join(DIR, 'catalog.txt')
    lines = [l for l in open(cat, encoding='utf8').read().split('\n') if l.strip() and not l.startswith('#')]
    if EN[0] in lines: print('already added'); return
    start = len(lines) + 1
    have = sorted(f[:-4] for f in os.listdir(DIR) if f.endswith('.txt') and f != 'catalog.txt')
    missing = [c for c in have if c not in L]
    assert not missing, missing
    for code, tr in L.items(): assert len(tr) == len(EN), code
    with open(cat, 'a', encoding='utf8') as f:
        f.write('# the Thunderbird add-on (experimental): its wording\n')
        for s in EN: f.write(s + '\n')
    for code, tr in L.items():
        p = os.path.join(DIR, f'{code}.txt')
        txt = open(p, encoding='utf8').read()
        if not txt.endswith('\n'): txt += '\n'
        txt += ''.join(f'{start + i}| {t}\n' for i, t in enumerate(tr))
        open(p, 'w', encoding='utf8').write(txt)
    print('added', len(EN), 'from', start, 'to', len(L), 'languages')

main()
