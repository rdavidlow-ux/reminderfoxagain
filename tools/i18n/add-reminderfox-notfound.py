#!/usr/bin/env python3
# Thunderbird add-on, Import from ReminderFox…: what it says when no reminderfox.ics was found in the profiles (the
# add-on now searches them, as the desktop app does). Run once, then node tools/i18n/build.js
import os
DIR = os.path.dirname(os.path.abspath(__file__))
EN = ["No reminderfox.ics was found in your Thunderbird or Firefox profiles. The ReminderFox add-on kept it in the reminderfox folder of a profile: pick it yourself."]
L = {
 'de': "In Ihren Thunderbird- oder Firefox-Profilen wurde keine reminderfox.ics gefunden. Das ReminderFox-Add-on hat sie im Ordner reminderfox eines Profils gespeichert: Wählen Sie sie selbst aus.",
 'fr': "Aucun fichier reminderfox.ics n'a été trouvé dans vos profils Thunderbird ou Firefox. L'extension ReminderFox le gardait dans le dossier reminderfox d'un profil : choisissez-le vous-même.",
 'es-ES': "No se encontró ningún reminderfox.ics en tus perfiles de Thunderbird o Firefox. El complemento ReminderFox lo guardaba en la carpeta reminderfox de un perfil: elígelo tú mismo.",
 'it': "Nessun reminderfox.ics trovato nei tuoi profili di Thunderbird o Firefox. Il componente aggiuntivo ReminderFox lo teneva nella cartella reminderfox di un profilo: sceglilo tu.",
 'nl': "Er is geen reminderfox.ics gevonden in je Thunderbird- of Firefox-profielen. De ReminderFox-add-on bewaarde het in de map reminderfox van een profiel: kies het zelf.",
 'pt-BR': "Nenhum reminderfox.ics foi encontrado nos seus perfis do Thunderbird ou do Firefox. O complemento ReminderFox o guardava na pasta reminderfox de um perfil: escolha-o você mesmo.",
 'pt-PT': "Não foi encontrado nenhum reminderfox.ics nos seus perfis do Thunderbird ou do Firefox. O extra ReminderFox guardava-o na pasta reminderfox de um perfil: escolha-o.",
 'ca-AD': "No s'ha trobat cap reminderfox.ics als teus perfils del Thunderbird o del Firefox. El complement ReminderFox el desava a la carpeta reminderfox d'un perfil: tria'l tu mateix.",
 'gl-ES': "Non se atopou ningún reminderfox.ics nos teus perfís de Thunderbird ou Firefox. O complemento ReminderFox gardábao no cartafol reminderfox dun perfil: escólleo ti.",
 'da': "Der blev ikke fundet nogen reminderfox.ics i dine Thunderbird- eller Firefox-profiler. ReminderFox-tilføjelsen gemte den i mappen reminderfox i en profil: vælg den selv.",
 'nb-NO': "Fant ingen reminderfox.ics i Thunderbird- eller Firefox-profilene dine. ReminderFox-tillegget lagret den i mappen reminderfox i en profil: velg den selv.",
 'sv-SE': "Ingen reminderfox.ics hittades i dina Thunderbird- eller Firefox-profiler. Tillägget ReminderFox sparade den i mappen reminderfox i en profil: välj den själv.",
 'fi': "Thunderbird- tai Firefox-profiileistasi ei löytynyt reminderfox.ics-tiedostoa. ReminderFox-lisäosa säilytti sen profiilin reminderfox-kansiossa: valitse se itse.",
 'et-EE': "Sinu Thunderbirdi või Firefoxi profiilidest ei leitud faili reminderfox.ics. ReminderFoxi lisa hoidis seda profiili kaustas reminderfox: vali see ise.",
 'fy-NL': "Der is gjin reminderfox.ics fûn yn dyn Thunderbird- of Firefox-profilen. De ReminderFox-add-on bewarre it yn de map reminderfox fan in profyl: kies it sels.",
 'ga-IE': "Níor aimsíodh aon reminderfox.ics i do phróifílí Thunderbird nó Firefox. Choinnigh an breiseán ReminderFox é i bhfillteán reminderfox próifíle: roghnaigh féin é.",
 'cs-CZ': "Ve vašich profilech Thunderbirdu ani Firefoxu nebyl nalezen soubor reminderfox.ics. Doplněk ReminderFox ho ukládal do složky reminderfox profilu: vyberte ho sami.",
 'sk-SK': "Vo vašich profiloch Thunderbirdu ani Firefoxu sa nenašiel súbor reminderfox.ics. Doplnok ReminderFox ho ukladal do priečinka reminderfox profilu: vyberte ho sami.",
 'pl': "W Twoich profilach Thunderbirda ani Firefoksa nie znaleziono pliku reminderfox.ics. Dodatek ReminderFox przechowywał go w folderze reminderfox profilu: wybierz go samodzielnie.",
 'hu-HU': "A Thunderbird- vagy Firefox-profiljaiban nem található reminderfox.ics. A ReminderFox kiegészítő egy profil reminderfox mappájában tárolta: válassza ki saját maga.",
 'ro-RO': "Nu s-a găsit niciun reminderfox.ics în profilurile tale Thunderbird sau Firefox. Suplimentul ReminderFox îl păstra în dosarul reminderfox al unui profil: alege-l tu.",
 'ru-RU': "В ваших профилях Thunderbird и Firefox файл reminderfox.ics не найден. Дополнение ReminderFox хранило его в папке reminderfox профиля: выберите его сами.",
 'uk-UA': "У ваших профілях Thunderbird і Firefox файл reminderfox.ics не знайдено. Доповнення ReminderFox зберігало його в теці reminderfox профілю: виберіть його самі.",
 'be-BY': "У вашых профілях Thunderbird і Firefox файл reminderfox.ics не знойдзены. Дадатак ReminderFox захоўваў яго ў папцы reminderfox профілю: выберыце яго самі.",
 'tr': "Thunderbird veya Firefox profillerinizde reminderfox.ics bulunamadı. ReminderFox eklentisi onu bir profilin reminderfox klasöründe tutuyordu: kendiniz seçin.",
 'ar': "لم يُعثر على ملف reminderfox.ics في ملفات تعريف Thunderbird أو Firefox. كانت إضافة ReminderFox تحفظه في مجلد reminderfox ضمن ملف تعريف: اختره بنفسك.",
 'he-IL': "לא נמצא קובץ reminderfox.ics בפרופילים של Thunderbird או Firefox. התוסף ReminderFox שמר אותו בתיקייה reminderfox של פרופיל: יש לבחור אותו בעצמך.",
 'ja-JP': "Thunderbird や Firefox のプロファイルに reminderfox.ics は見つかりませんでした。ReminderFox アドオンはプロファイルの reminderfox フォルダーに保存していました。ご自分で選んでください。",
 'ko-KR': "Thunderbird나 Firefox 프로필에서 reminderfox.ics를 찾지 못했습니다. ReminderFox 부가 기능은 프로필의 reminderfox 폴더에 저장했습니다. 직접 선택하세요.",
 'zh-CN': "在你的 Thunderbird 或 Firefox 配置文件中没有找到 reminderfox.ics。ReminderFox 附加组件把它保存在配置文件的 reminderfox 文件夹中：请自己选择。",
 'zh-TW': "在你的 Thunderbird 或 Firefox 設定檔中找不到 reminderfox.ics。ReminderFox 附加元件將它儲存在設定檔的 reminderfox 資料夾中：請自行選擇。",
 'vi': "Không tìm thấy reminderfox.ics trong các hồ sơ Thunderbird hoặc Firefox của bạn. Tiện ích ReminderFox lưu nó trong thư mục reminderfox của một hồ sơ: hãy tự chọn.",
 'mn-MN': "Таны Thunderbird эсвэл Firefox профайлд reminderfox.ics олдсонгүй. ReminderFox нэмэлт үүнийг профайлын reminderfox хавтсанд хадгалдаг байсан: өөрөө сонгоно уу.",
}
def main():
    cat = os.path.join(DIR, 'catalog.txt')
    lines = [l for l in open(cat, encoding='utf8').read().split('\n') if l.strip() and not l.startswith('#')]
    if EN[0] in lines: print('already added'); return
    start = len(lines) + 1
    have = sorted(f[:-4] for f in os.listdir(DIR) if f.endswith('.txt') and f != 'catalog.txt')
    assert not [c for c in have if c not in L]
    for c, t in L.items(): assert 'reminderfox.ics' in t and 'ReminderFox' in t, c
    with open(cat, 'a', encoding='utf8') as f:
        f.write('# Thunderbird add-on: Import from ReminderFox… when nothing was found\n' + EN[0] + '\n')
    for code, t in L.items():
        p = os.path.join(DIR, f'{code}.txt')
        txt = open(p, encoding='utf8').read()
        if not txt.endswith('\n'): txt += '\n'
        open(p, 'w', encoding='utf8').write(txt + f'{start}| {t}\n')
    print('added at', start)
main()
