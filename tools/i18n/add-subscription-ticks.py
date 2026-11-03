#!/usr/bin/env python3
# Calendar subscriptions: the option to mark an event completed once it is over. Run once, then
# node tools/i18n/build.js
import os
DIR = os.path.dirname(os.path.abspath(__file__))
EN = ["Mark past events completed", "Events count as completed once they are over; you can still untick one"]
L = {
 'de': ["Vergangene Termine als erledigt markieren", "Termine gelten als erledigt, sobald sie vorbei sind; Sie können einen trotzdem wieder abhaken"],
 'fr': ["Marquer les événements passés comme terminés", "Les événements comptent comme terminés une fois passés ; vous pouvez toujours en décocher un"],
 'es-ES': ["Marcar los eventos pasados como completados", "Los eventos cuentan como completados cuando ya han pasado; aún puedes desmarcar uno"],
 'it': ["Segna come completati gli eventi passati", "Gli eventi contano come completati una volta passati; puoi comunque togliere la spunta a uno"],
 'nl': ["Voorbije afspraken als voltooid markeren", "Afspraken tellen als voltooid zodra ze voorbij zijn; je kunt er nog steeds een afvinken ongedaan maken"],
 'pt-BR': ["Marcar eventos passados como concluídos", "Os eventos contam como concluídos quando terminam; você ainda pode desmarcar um"],
 'pt-PT': ["Marcar eventos passados como concluídos", "Os eventos contam como concluídos quando terminam; pode ainda desmarcar um"],
 'ca-AD': ["Marca els esdeveniments passats com a completats", "Els esdeveniments compten com a completats quan s'acaben; encara en pots desmarcar un"],
 'gl-ES': ["Marcar os eventos pasados como completados", "Os eventos contan como completados cando rematan; aínda podes desmarcar un"],
 'da': ["Markér tidligere begivenheder som fuldført", "Begivenheder tæller som fuldført, når de er overstået; du kan stadig fjerne fluebenet fra en"],
 'nb-NO': ["Merk tidligere hendelser som fullført", "Hendelser regnes som fullført når de er over; du kan fortsatt fjerne haken på en"],
 'sv-SE': ["Markera tidigare händelser som klara", "Händelser räknas som klara när de är över; du kan fortfarande bocka av en igen"],
 'fi': ["Merkitse menneet tapahtumat tehdyiksi", "Tapahtumat lasketaan tehdyiksi, kun ne ovat ohi; voit silti poistaa merkinnän yhdestä"],
 'et-EE': ["Märgi möödunud sündmused tehtuks", "Sündmused loetakse tehtuks, kui need on möödas; saad ühe märke siiski eemaldada"],
 'fy-NL': ["Foarbye barrens as foltôge markearje", "Barrens telle as foltôge sa gau't se foarby binne; jo kinne der noch altyd ien ôfvinkje"],
 'ga-IE': ["Marcáil imeachtaí atá thart mar críochnaithe", "Áirítear imeachtaí mar chríochnaithe nuair a bhíonn siad thart; is féidir leat tic a bhaint de cheann fós"],
 'cs-CZ': ["Označit minulé události jako dokončené", "Události se počítají jako dokončené, jakmile skončí; zaškrtnutí u jedné můžete stále zrušit"],
 'sk-SK': ["Označiť minulé udalosti ako dokončené", "Udalosti sa považujú za dokončené, keď skončia; začiarknutie pri jednej môžete stále zrušiť"],
 'pl': ["Oznacz minione wydarzenia jako ukończone", "Wydarzenia liczą się jako ukończone, gdy się skończą; nadal możesz odznaczyć jedno z nich"],
 'hu-HU': ["Elmúlt események megjelölése elvégzettként", "Az események elvégzettnek számítanak, ha véget értek; egyről így is leveheted a pipát"],
 'ro-RO': ["Marchează evenimentele trecute ca finalizate", "Evenimentele contează ca finalizate după ce s-au încheiat; poți totuși debifa unul"],
 'ru-RU': ["Отмечать прошедшие события как выполненные", "События считаются выполненными, когда они прошли; отметку с любого можно снять"],
 'uk-UA': ["Позначати минулі події виконаними", "Події вважаються виконаними, коли вони минули; позначку з будь-якої можна зняти"],
 'be-BY': ["Адзначаць мінулыя падзеі выкананымі", "Падзеі лічацца выкананымі, калі яны мінулі; адзнаку з любой можна зняць"],
 'tr': ["Geçmiş etkinlikleri tamamlandı olarak işaretle", "Etkinlikler bittiğinde tamamlanmış sayılır; yine de birinin işaretini kaldırabilirsiniz"],
 'ar': ["تعليم الأحداث الماضية كمكتملة", "تُعدّ الأحداث مكتملة عند انتهائها؛ ولا يزال بإمكانك إلغاء تحديد أي منها"],
 'he-IL': ["סימון אירועים שעברו כהושלמו", "אירועים נחשבים כהושלמו לאחר שהסתיימו; עדיין אפשר לבטל את הסימון של אחד מהם"],
 'ja-JP': ["過ぎた予定を完了にする", "終わった予定は完了として扱われます。チェックを外すこともできます"],
 'ko-KR': ["지난 일정을 완료로 표시", "일정이 끝나면 완료로 간주됩니다. 체크를 해제할 수도 있습니다"],
 'zh-CN': ["将过去的事件标记为已完成", "事件结束后即视为已完成；你仍可以取消勾选"],
 'zh-TW': ["將過去的活動標示為已完成", "活動結束後即視為已完成；你仍可取消勾選"],
 'vi': ["Đánh dấu các sự kiện đã qua là hoàn thành", "Sự kiện được tính là hoàn thành khi đã kết thúc; bạn vẫn có thể bỏ đánh dấu một sự kiện"],
 'mn-MN': ["Өнгөрсөн үйл явдлуудыг дууссан гэж тэмдэглэх", "Үйл явдал дууссаны дараа дууссанд тооцогдоно; та нэгийг нь тэмдэглэлээс авч болно"],
}
def main():
    cat = os.path.join(DIR, 'catalog.txt')
    lines = [l for l in open(cat, encoding='utf8').read().split('\n') if l.strip() and not l.startswith('#')]
    if EN[0] in lines: print('already added'); return
    start = len(lines) + 1
    have = sorted(f[:-4] for f in os.listdir(DIR) if f.endswith('.txt') and f != 'catalog.txt')
    assert not [c for c in have if c not in L], [c for c in have if c not in L]
    with open(cat, 'a', encoding='utf8') as f:
        f.write('# calendar subscriptions: mark an event completed once it is over\n')
        for s in EN: f.write(s + '\n')
    for code, tr in L.items():
        p = os.path.join(DIR, f'{code}.txt')
        txt = open(p, encoding='utf8').read()
        if not txt.endswith('\n'): txt += '\n'
        txt += ''.join(f'{start + i}| {t}\n' for i, t in enumerate(tr))
        open(p, 'w', encoding='utf8').write(txt)
    print('added', len(EN), 'from', start)
main()
