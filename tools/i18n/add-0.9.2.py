#!/usr/bin/env python3
# Adds the 0.9.2 string (the Windows uninstaller's question) to catalog.txt and every <code>.txt (run once).
# {path} is the data folder; build.sh writes installer/lang.nsh from src/ui/locales/*.json for the NSIS installer.
import os
DIR = os.path.dirname(os.path.abspath(__file__))
EN = ["Also delete your reminders and settings in {path}? Choose No to keep them."]
T = {
 'ar': "هل تريد حذف تذكيراتك وإعداداتك في {path} أيضًا؟ اختر «لا» للاحتفاظ بها.",
 'be-BY': "Выдаліць таксама вашы напаміны і налады ў {path}? Выберыце «Не», каб захаваць іх.",
 'ca-AD': "Voleu suprimir també els recordatoris i la configuració de {path}? Trieu No per conservar-los.",
 'cs-CZ': "Smazat také připomínky a nastavení ve složce {path}? Zvolte Ne, pokud je chcete zachovat.",
 'da': "Vil du også slette dine påmindelser og indstillinger i {path}? Vælg Nej for at beholde dem.",
 'de': "Auch Ihre Erinnerungen und Einstellungen in {path} löschen? Wählen Sie „Nein“, um sie zu behalten.",
 'es-ES': "¿Eliminar también sus recordatorios y su configuración en {path}? Elija No para conservarlos.",
 'et-EE': "Kas kustutada ka sinu meeldetuletused ja seaded kaustas {path}? Vali „Ei“, et need alles jätta.",
 'fi': "Poistetaanko myös muistutuksesi ja asetuksesi kansiosta {path}? Valitse Ei, jos haluat säilyttää ne.",
 'fr': "Supprimer aussi vos rappels et vos réglages dans {path} ? Choisissez Non pour les conserver.",
 'fy-NL': "Ek jo oantinkers en ynstellingen yn {path} fuortsmite? Kies Nee om se te hâlden.",
 'ga-IE': "Scrios do mheabhrúcháin agus do shocruithe in {path} freisin? Roghnaigh Níl chun iad a choinneáil.",
 'gl-ES': "Eliminar tamén os seus lembretes e axustes en {path}? Escolla Non para conservalos.",
 'he-IL': "למחוק גם את התזכורות וההגדרות שלך ב־{path}? יש לבחור „לא” כדי לשמור אותן.",
 'hu-HU': "Törli az emlékeztetőit és beállításait is ebből a mappából: {path}? A megtartásukhoz válassza a Nem lehetőséget.",
 'it': "Eliminare anche i promemoria e le impostazioni in {path}? Scegli No per conservarli.",
 'ja-JP': "{path} にあるリマインダーと設定も削除しますか? 残す場合は「いいえ」を選んでください。",
 'ko-KR': "{path}에 있는 미리 알림과 설정도 삭제할까요? 보관하려면 [아니요]를 선택하세요.",
 'mn-MN': "{path} доторх сануулга, тохиргоог мөн устгах уу? Хадгалах бол «Үгүй»-г сонгоно уу.",
 'nb-NO': "Vil du også slette påminnelsene og innstillingene dine i {path}? Velg Nei for å beholde dem.",
 'nl': "Ook uw herinneringen en instellingen in {path} verwijderen? Kies Nee om ze te bewaren.",
 'pl': "Usunąć także przypomnienia i ustawienia w {path}? Wybierz Nie, aby je zachować.",
 'pt-BR': "Excluir também seus lembretes e configurações em {path}? Escolha Não para mantê-los.",
 'pt-PT': "Eliminar também os seus lembretes e definições em {path}? Escolha Não para os manter.",
 'ro-RO': "Ștergeți și mementourile și setările din {path}? Alegeți Nu pentru a le păstra.",
 'ru-RU': "Удалить также ваши напоминания и настройки в {path}? Выберите «Нет», чтобы сохранить их.",
 'sk-SK': "Odstrániť aj pripomienky a nastavenia v priečinku {path}? Ak ich chcete ponechať, zvoľte Nie.",
 'sv-SE': "Vill du även ta bort dina påminnelser och inställningar i {path}? Välj Nej för att behålla dem.",
 'tr': "{path} içindeki hatırlatıcılarınız ve ayarlarınız da silinsin mi? Saklamak için Hayır'ı seçin.",
 'uk-UA': "Видалити також ваші нагадування й параметри в {path}? Виберіть «Ні», щоб зберегти їх.",
 'vi': "Xóa cả lời nhắc và cài đặt của bạn trong {path}? Chọn Không để giữ lại.",
 'zh-CN': "同时删除 {path} 中的提醒和设置吗？选择“否”可保留它们。",
 'zh-TW': "同時刪除 {path} 中的提醒和設定嗎？選擇「否」可保留它們。",
}
def main():
    cat = os.path.join(DIR, 'catalog.txt')
    lines = [l for l in open(cat, encoding='utf8').read().split('\n') if l.strip() and not l.startswith('#')]
    if EN[0] in lines: print('already added'); return
    start = len(lines) + 1
    with open(cat, 'a', encoding='utf8') as f:
        f.write('# 0.9.2: the Windows uninstaller\n')
        for s in EN: f.write(s + '\n')
    for code, tr in T.items():
        p = os.path.join(DIR, f'{code}.txt')
        txt = open(p, encoding='utf8').read()
        if not txt.endswith('\n'): txt += '\n'
        open(p, 'w', encoding='utf8').write(txt + f'{start}| {tr}\n')
    have = sorted(f[:-4] for f in os.listdir(DIR) if f.endswith('.txt') and f != 'catalog.txt')
    print('added', len(EN), 'from', start, 'to', len(T), 'languages; missing:', [c for c in have if c not in T])
main()
