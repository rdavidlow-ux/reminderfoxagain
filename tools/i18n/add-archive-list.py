#!/usr/bin/env python3
# The "Terminated or Suspended" list can't be renamed or removed. Run once, then node tools/i18n/build.js
import os
DIR = os.path.dirname(os.path.abspath(__file__))
EN = ["archive",
      "This list keeps archived items: it can't be renamed or removed, and its items stay out of the Reminders and calendar views",
      "The “{list}” list keeps archived items and can't be renamed.",
      "The “{list}” list keeps archived items and can't be removed."]
L = {
 'de': ["Archiv", "Diese Liste enthält archivierte Einträge: Sie kann nicht umbenannt oder entfernt werden, und ihre Einträge erscheinen nicht in den Erinnerungen und Kalenderansichten", "Die Liste „{list}“ enthält archivierte Einträge und kann nicht umbenannt werden.", "Die Liste „{list}“ enthält archivierte Einträge und kann nicht entfernt werden."],
 'fr': ["archive", "Cette liste garde les éléments archivés : elle ne peut pas être renommée ni supprimée, et ses éléments n'apparaissent pas dans les rappels ni dans les vues du calendrier", "La liste «{list}» garde les éléments archivés et ne peut pas être renommée.", "La liste «{list}» garde les éléments archivés et ne peut pas être supprimée."],
 'es-ES': ["archivo", "Esta lista guarda los elementos archivados: no se puede renombrar ni quitar, y sus elementos no aparecen en Recordatorios ni en las vistas de calendario", "La lista «{list}» guarda los elementos archivados y no se puede renombrar.", "La lista «{list}» guarda los elementos archivados y no se puede quitar."],
 'it': ["archivio", "Questo elenco conserva gli elementi archiviati: non può essere rinominato né rimosso, e i suoi elementi non compaiono nei promemoria né nelle viste del calendario", "L'elenco «{list}» conserva gli elementi archiviati e non può essere rinominato.", "L'elenco «{list}» conserva gli elementi archiviati e non può essere rimosso."],
 'nl': ["archief", "Deze lijst bewaart gearchiveerde items: hij kan niet worden hernoemd of verwijderd, en de items staan niet in Herinneringen en de agendaweergaven", "De lijst ‘{list}’ bewaart gearchiveerde items en kan niet worden hernoemd.", "De lijst ‘{list}’ bewaart gearchiveerde items en kan niet worden verwijderd."],
 'pt-BR': ["arquivo", "Esta lista guarda itens arquivados: não pode ser renomeada nem removida, e seus itens não aparecem em Lembretes nem nas visualizações de calendário", "A lista “{list}” guarda itens arquivados e não pode ser renomeada.", "A lista “{list}” guarda itens arquivados e não pode ser removida."],
 'pt-PT': ["arquivo", "Esta lista guarda itens arquivados: não pode ser mudada de nome nem removida, e os seus itens não aparecem em Lembretes nem nas vistas de calendário", "A lista «{list}» guarda itens arquivados e não pode ser mudada de nome.", "A lista «{list}» guarda itens arquivados e não pode ser removida."],
 'ca-AD': ["arxiu", "Aquesta llista guarda els elements arxivats: no es pot reanomenar ni eliminar, i els seus elements no apareixen als recordatoris ni a les vistes de calendari", "La llista «{list}» guarda els elements arxivats i no es pot reanomenar.", "La llista «{list}» guarda els elements arxivats i no es pot eliminar."],
 'gl-ES': ["arquivo", "Esta lista garda os elementos arquivados: non se pode renomear nin quitar, e os seus elementos non aparecen nos recordatorios nin nas vistas de calendario", "A lista «{list}» garda os elementos arquivados e non se pode renomear.", "A lista «{list}» garda os elementos arquivados e non se pode quitar."],
 'da': ["arkiv", "Denne liste gemmer arkiverede elementer: den kan ikke omdøbes eller fjernes, og dens elementer vises ikke i Påmindelser og kalendervisningerne", "Listen “{list}” gemmer arkiverede elementer og kan ikke omdøbes.", "Listen “{list}” gemmer arkiverede elementer og kan ikke fjernes."],
 'nb-NO': ["arkiv", "Denne listen tar vare på arkiverte elementer: den kan ikke gis nytt navn eller fjernes, og elementene vises ikke i Påminnelser og kalendervisningene", "Listen «{list}» tar vare på arkiverte elementer og kan ikke gis nytt navn.", "Listen «{list}» tar vare på arkiverte elementer og kan ikke fjernes."],
 'sv-SE': ["arkiv", "Den här listan sparar arkiverade objekt: den kan inte byta namn eller tas bort, och dess objekt visas inte i Påminnelser och kalendervyerna", "Listan ”{list}” sparar arkiverade objekt och kan inte byta namn.", "Listan ”{list}” sparar arkiverade objekt och kan inte tas bort."],
 'fi': ["arkisto", "Tämä luettelo säilyttää arkistoidut kohteet: sitä ei voi nimetä uudelleen tai poistaa, eikä sen kohteita näytetä muistutuksissa tai kalenterinäkymissä", "Luettelo ”{list}” säilyttää arkistoidut kohteet, eikä sitä voi nimetä uudelleen.", "Luettelo ”{list}” säilyttää arkistoidut kohteet, eikä sitä voi poistaa."],
 'et-EE': ["arhiiv", "See loend hoiab arhiveeritud üksusi: seda ei saa ümber nimetada ega eemaldada ning selle üksusi ei näidata meeldetuletustes ega kalendrivaadetes", "Loend „{list}“ hoiab arhiveeritud üksusi ja seda ei saa ümber nimetada.", "Loend „{list}“ hoiab arhiveeritud üksusi ja seda ei saa eemaldada."],
 'fy-NL': ["argyf", "Dizze list bewarret argivearre items: hy kin net omneamd of fuortsmiten wurde, en de items steane net yn Oantinkens en de aginda-werjeften", "De list ‘{list}’ bewarret argivearre items en kin net omneamd wurde.", "De list ‘{list}’ bewarret argivearre items en kin net fuortsmiten wurde."],
 'ga-IE': ["cartlann", "Coinníonn an liosta seo míreanna cartlannaithe: ní féidir é a athainmniú ná a bhaint, agus ní thaispeántar a mhíreanna sna meabhrúcháin ná sna radhairc féilire", "Coinníonn an liosta “{list}” míreanna cartlannaithe agus ní féidir é a athainmniú.", "Coinníonn an liosta “{list}” míreanna cartlannaithe agus ní féidir é a bhaint."],
 'cs-CZ': ["archiv", "Tento seznam uchovává archivované položky: nelze jej přejmenovat ani odebrat a jeho položky se nezobrazují v připomínkách ani v zobrazeních kalendáře", "Seznam „{list}“ uchovává archivované položky a nelze jej přejmenovat.", "Seznam „{list}“ uchovává archivované položky a nelze jej odebrat."],
 'sk-SK': ["archív", "Tento zoznam uchováva archivované položky: nedá sa premenovať ani odstrániť a jeho položky sa nezobrazujú v pripomienkach ani v zobrazeniach kalendára", "Zoznam „{list}“ uchováva archivované položky a nedá sa premenovať.", "Zoznam „{list}“ uchováva archivované položky a nedá sa odstrániť."],
 'pl': ["archiwum", "Ta lista przechowuje zarchiwizowane elementy: nie można zmienić jej nazwy ani jej usunąć, a jej elementy nie pojawiają się w przypomnieniach ani w widokach kalendarza", "Lista „{list}” przechowuje zarchiwizowane elementy i nie można zmienić jej nazwy.", "Lista „{list}” przechowuje zarchiwizowane elementy i nie można jej usunąć."],
 'hu-HU': ["archívum", "Ez a lista az archivált elemeket őrzi: nem nevezhető át és nem távolítható el, elemei pedig nem jelennek meg az emlékeztetőkben és a naptárnézetekben", "A „{list}” lista az archivált elemeket őrzi, és nem nevezhető át.", "A „{list}” lista az archivált elemeket őrzi, és nem távolítható el."],
 'ro-RO': ["arhivă", "Această listă păstrează elementele arhivate: nu poate fi redenumită sau eliminată, iar elementele ei nu apar în Mementouri și în vizualizările calendarului", "Lista „{list}” păstrează elementele arhivate și nu poate fi redenumită.", "Lista „{list}” păstrează elementele arhivate și nu poate fi eliminată."],
 'ru-RU': ["архив", "В этом списке хранятся архивные элементы: его нельзя переименовать или удалить, а его элементы не показываются в напоминаниях и в представлениях календаря", "В списке «{list}» хранятся архивные элементы, его нельзя переименовать.", "В списке «{list}» хранятся архивные элементы, его нельзя удалить."],
 'uk-UA': ["архів", "У цьому списку зберігаються архівні елементи: його не можна перейменувати чи вилучити, а його елементи не показуються в нагадуваннях і поданнях календаря", "У списку «{list}» зберігаються архівні елементи, його не можна перейменувати.", "У списку «{list}» зберігаються архівні елементи, його не можна вилучити."],
 'be-BY': ["архіў", "У гэтым спісе захоўваюцца архіўныя элементы: яго нельга перайменаваць або выдаліць, а яго элементы не паказваюцца ў напамінах і ў выглядах календара", "У спісе «{list}» захоўваюцца архіўныя элементы, яго нельга перайменаваць.", "У спісе «{list}» захоўваюцца архіўныя элементы, яго нельга выдаліць."],
 'tr': ["arşiv", "Bu liste arşivlenmiş öğeleri tutar: yeniden adlandırılamaz veya kaldırılamaz ve öğeleri Anımsatıcılar ile takvim görünümlerinde gösterilmez", "“{list}” listesi arşivlenmiş öğeleri tutar ve yeniden adlandırılamaz.", "“{list}” listesi arşivlenmiş öğeleri tutar ve kaldırılamaz."],
 'ar': ["أرشيف", "تحتفظ هذه القائمة بالعناصر المؤرشفة: لا يمكن إعادة تسميتها أو إزالتها، ولا تظهر عناصرها في التذكيرات ولا في طرق عرض التقويم", "تحتفظ قائمة «{list}» بالعناصر المؤرشفة ولا يمكن إعادة تسميتها.", "تحتفظ قائمة «{list}» بالعناصر المؤرشفة ولا يمكن إزالتها."],
 'he-IL': ["ארכיון", "רשימה זו שומרת פריטים בארכיון: אי אפשר לשנות את שמה או להסיר אותה, והפריטים שלה לא מוצגים בתזכורות ובתצוגות לוח השנה", "הרשימה „{list}” שומרת פריטים בארכיון ואי אפשר לשנות את שמה.", "הרשימה „{list}” שומרת פריטים בארכיון ואי אפשר להסיר אותה."],
 'ja-JP': ["アーカイブ", "このリストはアーカイブした項目を保管します。名前の変更や削除はできず、項目はリマインダーやカレンダー表示には出ません", "「{list}」リストはアーカイブした項目を保管するため、名前を変更できません。", "「{list}」リストはアーカイブした項目を保管するため、削除できません。"],
 'ko-KR': ["보관함", "이 목록은 보관한 항목을 담습니다. 이름을 바꾸거나 제거할 수 없으며, 항목은 미리 알림과 달력 보기에 표시되지 않습니다", "“{list}” 목록은 보관한 항목을 담고 있어 이름을 바꿀 수 없습니다.", "“{list}” 목록은 보관한 항목을 담고 있어 제거할 수 없습니다."],
 'zh-CN': ["归档", "此列表保存已归档的项目：不能重命名或移除，其中的项目不会显示在提醒和日历视图中", "“{list}”列表保存已归档的项目，不能重命名。", "“{list}”列表保存已归档的项目，不能移除。"],
 'zh-TW': ["封存", "此清單保存已封存的項目：無法重新命名或移除，其中的項目不會顯示在提醒和行事曆檢視中", "「{list}」清單保存已封存的項目，無法重新命名。", "「{list}」清單保存已封存的項目，無法移除。"],
 'vi': ["lưu trữ", "Danh sách này giữ các mục đã lưu trữ: không thể đổi tên hay xóa, và các mục của nó không hiện trong Lời nhắc và các chế độ xem lịch", "Danh sách “{list}” giữ các mục đã lưu trữ và không thể đổi tên.", "Danh sách “{list}” giữ các mục đã lưu trữ và không thể xóa."],
 'mn-MN': ["архив", "Энэ жагсаалт архивласан зүйлсийг хадгална: нэрийг нь өөрчлөх эсвэл устгах боломжгүй бөгөөд зүйлс нь сануулга болон хуанлийн харагдацад харагдахгүй", "“{list}” жагсаалт архивласан зүйлсийг хадгалдаг тул нэрийг нь өөрчлөх боломжгүй.", "“{list}” жагсаалт архивласан зүйлсийг хадгалдаг тул устгах боломжгүй."],
}
def main():
    cat = os.path.join(DIR, 'catalog.txt')
    lines = [l for l in open(cat, encoding='utf8').read().split('\n') if l.strip() and not l.startswith('#')]
    if EN[1] in lines: print('already added'); return
    start = len(lines) + 1
    have = sorted(f[:-4] for f in os.listdir(DIR) if f.endswith('.txt') and f != 'catalog.txt')
    assert not [c for c in have if c not in L], [c for c in have if c not in L]
    assert all(len(v) == len(EN) for v in L.values())
    with open(cat, 'a', encoding='utf8') as f:
        f.write('# the "Terminated or Suspended" list can\'t be renamed or removed\n')
        for s in EN: f.write(s + '\n')
    for code, tr in L.items():
        p = os.path.join(DIR, f'{code}.txt')
        txt = open(p, encoding='utf8').read()
        if not txt.endswith('\n'): txt += '\n'
        txt += ''.join(f'{start + i}| {t}\n' for i, t in enumerate(tr))
        open(p, 'w', encoding='utf8').write(txt)
    print('added', len(EN), 'from', start)
main()
