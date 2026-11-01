#!/usr/bin/env python3
# Adds the strings for "Open email" in the experimental Thunderbird add-on (an item made from an email opens it) to
# catalog.txt and every <code>.txt (run once), then run: node tools/i18n/build.js
import os, re
DIR = os.path.dirname(os.path.abspath(__file__))
NF = "The email this came from was not found. It may have been deleted, or it is in an account that is not set up in this Thunderbird."
EN = ["Open email", "✉ Open email", "Open the email this came from", "This item has no email to open.", NF]
# per language: "Open email", the tooltip, "no email", "not found" ("✉ " + the first is made from it)
L = {
 'de': ["E-Mail öffnen", "Die E-Mail öffnen, aus der dies stammt", "Zu diesem Eintrag gibt es keine E-Mail.", "Die E-Mail, aus der dies stammt, wurde nicht gefunden. Sie wurde vielleicht gelöscht, oder sie liegt in einem Konto, das in diesem Thunderbird nicht eingerichtet ist."],
 'fr': ["Ouvrir le courriel", "Ouvrir le courriel d'où vient cet élément", "Cet élément n'a pas de courriel à ouvrir.", "Le courriel d'où vient cet élément est introuvable. Il a peut-être été supprimé, ou il se trouve dans un compte qui n'est pas configuré dans ce Thunderbird."],
 'es-ES': ["Abrir el correo", "Abrir el correo del que procede", "Este elemento no tiene ningún correo que abrir.", "No se encontró el correo del que procede. Puede que se haya eliminado o que esté en una cuenta que no está configurada en este Thunderbird."],
 'it': ["Apri l'email", "Apri l'email da cui proviene", "Questo elemento non ha un'email da aprire.", "L'email da cui proviene non è stata trovata. Forse è stata eliminata, oppure si trova in un account non configurato in questo Thunderbird."],
 'nl': ["E-mail openen", "De e-mail openen waar dit vandaan komt", "Dit item heeft geen e-mail om te openen.", "De e-mail waar dit vandaan komt, is niet gevonden. Misschien is hij verwijderd, of hij staat in een account dat niet in deze Thunderbird is ingesteld."],
 'pt-BR': ["Abrir o e-mail", "Abrir o e-mail de onde isto veio", "Este item não tem um e-mail para abrir.", "O e-mail de onde isto veio não foi encontrado. Talvez tenha sido excluído, ou está em uma conta que não está configurada neste Thunderbird."],
 'pt-PT': ["Abrir o e-mail", "Abrir o e-mail de onde isto veio", "Este item não tem nenhum e-mail para abrir.", "O e-mail de onde isto veio não foi encontrado. Pode ter sido eliminado, ou está numa conta que não está configurada neste Thunderbird."],
 'ca-AD': ["Obre el correu", "Obre el correu d'on prové", "Aquest element no té cap correu per obrir.", "No s'ha trobat el correu d'on prové. Potser s'ha suprimit, o és en un compte que no està configurat en aquest Thunderbird."],
 'gl-ES': ["Abrir o correo", "Abrir o correo do que procede", "Este elemento non ten ningún correo que abrir.", "Non se atopou o correo do que procede. Quizais se eliminou, ou está nunha conta que non está configurada neste Thunderbird."],
 'da': ["Åbn e-mail", "Åbn den e-mail, det kom fra", "Dette element har ingen e-mail at åbne.", "Den e-mail, det kom fra, blev ikke fundet. Den er måske slettet, eller den ligger i en konto, der ikke er sat op i denne Thunderbird."],
 'nb-NO': ["Åpne e-post", "Åpne e-posten dette kom fra", "Dette elementet har ingen e-post å åpne.", "Fant ikke e-posten dette kom fra. Den kan være slettet, eller den ligger i en konto som ikke er satt opp i denne Thunderbird."],
 'sv-SE': ["Öppna e-post", "Öppna e-postmeddelandet detta kom från", "Det här objektet har inget e-postmeddelande att öppna.", "E-postmeddelandet detta kom från hittades inte. Det kan ha tagits bort, eller så ligger det i ett konto som inte är konfigurerat i denna Thunderbird."],
 'fi': ["Avaa sähköposti", "Avaa sähköposti, josta tämä tuli", "Tällä kohteella ei ole avattavaa sähköpostia.", "Sähköpostia, josta tämä tuli, ei löytynyt. Se on ehkä poistettu, tai se on tilillä, jota ei ole määritetty tähän Thunderbirdiin."],
 'et-EE': ["Ava e-kiri", "Ava e-kiri, millest see pärineb", "Sellel kirjel pole avatavat e-kirja.", "E-kirja, millest see pärineb, ei leitud. See võib olla kustutatud või on see kontol, mida selles Thunderbirdis pole seadistatud."],
 'fy-NL': ["E-mail iepenje", "De e-mail iepenje dêr't dit wei komt", "Dit item hat gjin e-mail om te iepenjen.", "De e-mail dêr't dit wei komt, is net fûn. Miskien is er fuortsmiten, of er stiet yn in account dat net yn dizze Thunderbird ynsteld is."],
 'ga-IE': ["Oscail an ríomhphost", "Oscail an ríomhphost ar tháinig sé seo as", "Níl aon ríomhphost le hoscailt ag an mír seo.", "Níor aimsíodh an ríomhphost ar tháinig sé seo as. B'fhéidir gur scriosadh é, nó tá sé i gcuntas nach bhfuil socraithe sa Thunderbird seo."],
 'cs-CZ': ["Otevřít e-mail", "Otevřít e-mail, ze kterého to pochází", "Tato položka nemá žádný e-mail k otevření.", "E-mail, ze kterého to pochází, nebyl nalezen. Možná byl smazán, nebo je v účtu, který v tomto Thunderbirdu není nastaven."],
 'sk-SK': ["Otvoriť e-mail", "Otvoriť e-mail, z ktorého to pochádza", "Táto položka nemá žiadny e-mail na otvorenie.", "E-mail, z ktorého to pochádza, sa nenašiel. Možno bol odstránený, alebo je v účte, ktorý v tomto Thunderbirde nie je nastavený."],
 'pl': ["Otwórz e-mail", "Otwórz e-mail, z którego to pochodzi", "Ten element nie ma e-maila do otwarcia.", "Nie znaleziono e-maila, z którego to pochodzi. Mógł zostać usunięty albo jest na koncie, które nie jest skonfigurowane w tym Thunderbirdzie."],
 'hu-HU': ["E-mail megnyitása", "Annak az e-mailnek a megnyitása, amelyből ez származik", "Ehhez az elemhez nincs megnyitható e-mail.", "Nem található az e-mail, amelyből ez származik. Lehet, hogy törölték, vagy olyan fiókban van, amely nincs beállítva ebben a Thunderbirdben."],
 'ro-RO': ["Deschide e-mailul", "Deschide e-mailul din care provine", "Acest element nu are niciun e-mail de deschis.", "E-mailul din care provine nu a fost găsit. Poate a fost șters sau se află într-un cont care nu este configurat în acest Thunderbird."],
 'ru-RU': ["Открыть письмо", "Открыть письмо, из которого это создано", "У этого элемента нет письма, которое можно открыть.", "Письмо, из которого это создано, не найдено. Возможно, оно удалено или находится в учётной записи, которая не настроена в этом Thunderbird."],
 'uk-UA': ["Відкрити лист", "Відкрити лист, з якого це створено", "У цього елемента немає листа, який можна відкрити.", "Лист, з якого це створено, не знайдено. Можливо, його видалено або він в обліковому записі, який не налаштовано в цьому Thunderbird."],
 'be-BY': ["Адкрыць ліст", "Адкрыць ліст, з якога гэта створана", "У гэтага элемента няма ліста, які можна адкрыць.", "Ліст, з якога гэта створана, не знойдзены. Магчыма, ён выдалены або знаходзіцца ва ўліковым запісе, які не наладжаны ў гэтым Thunderbird."],
 'tr': ["E-postayı aç", "Bunun geldiği e-postayı aç", "Bu öğenin açılacak bir e-postası yok.", "Bunun geldiği e-posta bulunamadı. Silinmiş olabilir ya da bu Thunderbird'de kurulu olmayan bir hesapta olabilir."],
 'ar': ["فتح البريد", "فتح البريد الذي جاء منه هذا", "لا يوجد بريد لفتحه لهذا العنصر.", "لم يُعثر على البريد الذي جاء منه هذا. ربما حُذف، أو أنه في حساب غير مُعَدّ في Thunderbird هذا."],
 'he-IL': ["פתיחת הדוא״ל", "פתיחת הדוא״ל שממנו זה הגיע", "לפריט הזה אין דוא״ל לפתוח.", "הדוא״ל שממנו זה הגיע לא נמצא. ייתכן שנמחק, או שהוא בחשבון שאינו מוגדר ב־Thunderbird הזה."],
 'ja-JP': ["メールを開く", "これの元になったメールを開く", "この項目には開くメールがありません。", "これの元になったメールが見つかりません。削除されたか、この Thunderbird に設定されていないアカウントにある可能性があります。"],
 'ko-KR': ["이메일 열기", "이 항목이 만들어진 이메일 열기", "이 항목에는 열 이메일이 없습니다.", "이 항목이 만들어진 이메일을 찾을 수 없습니다. 삭제되었거나 이 Thunderbird에 설정되지 않은 계정에 있을 수 있습니다."],
 'zh-CN': ["打开邮件", "打开这一项来自的邮件", "此项没有可打开的邮件。", "找不到这一项来自的邮件。它可能已被删除，或者位于此 Thunderbird 中未设置的帐户里。"],
 'zh-TW': ["開啟郵件", "開啟這一項來自的郵件", "此項目沒有可開啟的郵件。", "找不到這一項來自的郵件。它可能已被刪除，或位於此 Thunderbird 中未設定的帳號裡。"],
 'vi': ["Mở email", "Mở email mà mục này được tạo từ đó", "Mục này không có email để mở.", "Không tìm thấy email mà mục này được tạo từ đó. Có thể email đã bị xóa, hoặc nằm trong một tài khoản chưa được thiết lập trong Thunderbird này."],
 'mn-MN': ["Имэйл нээх", "Үүнийг үүсгэсэн имэйлийг нээх", "Энэ зүйлд нээх имэйл алга.", "Үүнийг үүсгэсэн имэйл олдсонгүй. Устгагдсан эсвэл энэ Thunderbird-д тохируулаагүй бүртгэлд байж магадгүй."],
}

def main():
    cat = os.path.join(DIR, 'catalog.txt')
    lines = [l for l in open(cat, encoding='utf8').read().split('\n') if l.strip() and not l.startswith('#')]
    if EN[0] in lines: print('already added'); return
    start = len(lines) + 1
    have = sorted(f[:-4] for f in os.listdir(DIR) if f.endswith('.txt') and f != 'catalog.txt')
    missing = [c for c in have if c not in L]
    assert not missing, missing
    out = {code: [t[0], f"✉ {t[0]}", t[1], t[2], t[3]] for code, t in L.items()}
    for code, tr in out.items(): assert len(tr) == len(EN) and all(tr), code
    with open(cat, 'a', encoding='utf8') as f:
        f.write('# the Thunderbird add-on (experimental): open the email an item came from\n')
        for s in EN: f.write(s + '\n')
    for code, tr in out.items():
        p = os.path.join(DIR, f'{code}.txt')
        txt = open(p, encoding='utf8').read()
        if not txt.endswith('\n'): txt += '\n'
        txt += ''.join(f'{start + i}| {t}\n' for i, t in enumerate(tr))
        open(p, 'w', encoding='utf8').write(txt)
    print('added', len(EN), 'from', start, 'to', len(out), 'languages')

main()
