#!/usr/bin/env python3
# The Android app (branch new/android-test): the Calendar view's tab, the ＋ button, the alarm sheets and notification
# channels, where the data is kept, and how to bring the ReminderFox add-on's file. Run once, then node tools/i18n/build.js
import os
DIR = os.path.dirname(os.path.abspath(__file__))
EN = ["Calendar", "New", "Today and upcoming", "Alarms (silent)", "Share a copy of your reminders file",
      "Your reminders are kept on this device, with a backup every day.",
      "Copy reminderfox.ics from your computer's Firefox or Thunderbird profile (its reminderfox folder) to this device, then choose it here."]
L = {
 'de': ["Kalender", "Neu", "Heute und demnächst", "Alarme (lautlos)", "Eine Kopie Ihrer Erinnerungsdatei teilen", "Ihre Erinnerungen werden auf diesem Gerät gespeichert, mit einer Sicherung jeden Tag.", "Kopieren Sie reminderfox.ics aus dem Firefox- oder Thunderbird-Profil Ihres Computers (dessen Ordner reminderfox) auf dieses Gerät und wählen Sie die Datei dann hier aus."],
 'fr': ["Calendrier", "Nouveau", "Aujourd'hui et à venir", "Alarmes (silencieuses)", "Partager une copie de votre fichier de rappels", "Vos rappels sont gardés sur cet appareil, avec une sauvegarde chaque jour.", "Copiez reminderfox.ics depuis le profil Firefox ou Thunderbird de votre ordinateur (son dossier reminderfox) vers cet appareil, puis choisissez-le ici."],
 'es-ES': ["Calendario", "Nuevo", "Hoy y próximos", "Alarmas (en silencio)", "Compartir una copia de tu archivo de recordatorios", "Tus recordatorios se guardan en este dispositivo, con una copia de seguridad cada día.", "Copia reminderfox.ics del perfil de Firefox o Thunderbird de tu ordenador (su carpeta reminderfox) a este dispositivo y luego elígelo aquí."],
 'it': ["Calendario", "Nuovo", "Oggi e prossimi", "Allarmi (silenziosi)", "Condividi una copia del file dei promemoria", "I promemoria sono conservati su questo dispositivo, con un backup ogni giorno.", "Copia reminderfox.ics dal profilo di Firefox o Thunderbird del computer (la sua cartella reminderfox) su questo dispositivo, poi sceglilo qui."],
 'nl': ["Agenda", "Nieuw", "Vandaag en binnenkort", "Alarmen (stil)", "Een kopie van je herinneringenbestand delen", "Je herinneringen worden op dit apparaat bewaard, met elke dag een back-up.", "Kopieer reminderfox.ics uit het Firefox- of Thunderbird-profiel van je computer (de map reminderfox) naar dit apparaat en kies het dan hier."],
 'pt-BR': ["Calendário", "Novo", "Hoje e próximos", "Alarmes (silenciosos)", "Compartilhar uma cópia do arquivo de lembretes", "Seus lembretes ficam neste dispositivo, com um backup todo dia.", "Copie reminderfox.ics do perfil do Firefox ou Thunderbird do seu computador (a pasta reminderfox) para este dispositivo e depois escolha-o aqui."],
 'pt-PT': ["Calendário", "Novo", "Hoje e próximos", "Alarmes (silenciosos)", "Partilhar uma cópia do ficheiro de lembretes", "Os seus lembretes ficam neste dispositivo, com uma cópia de segurança todos os dias.", "Copie reminderfox.ics do perfil do Firefox ou Thunderbird do computador (a pasta reminderfox) para este dispositivo e depois escolha-o aqui."],
 'ca-AD': ["Calendari", "Nou", "Avui i properament", "Alarmes (en silenci)", "Comparteix una còpia del fitxer de recordatoris", "Els recordatoris es guarden en aquest dispositiu, amb una còpia de seguretat cada dia.", "Copia reminderfox.ics del perfil de Firefox o Thunderbird de l'ordinador (la carpeta reminderfox) a aquest dispositiu i després tria'l aquí."],
 'gl-ES': ["Calendario", "Novo", "Hoxe e próximos", "Alarmas (en silencio)", "Compartir unha copia do ficheiro de recordatorios", "Os teus recordatorios gárdanse neste dispositivo, cunha copia de seguranza cada día.", "Copia reminderfox.ics do perfil de Firefox ou Thunderbird do computador (o cartafol reminderfox) a este dispositivo e despois escólleo aquí."],
 'da': ["Kalender", "Ny", "I dag og kommende", "Alarmer (lydløse)", "Del en kopi af din påmindelsesfil", "Dine påmindelser gemmes på denne enhed med en sikkerhedskopi hver dag.", "Kopiér reminderfox.ics fra Firefox- eller Thunderbird-profilen på din computer (mappen reminderfox) til denne enhed, og vælg den så her."],
 'nb-NO': ["Kalender", "Ny", "I dag og kommende", "Alarmer (lydløse)", "Del en kopi av påminnelsesfilen", "Påminnelsene dine lagres på denne enheten, med en sikkerhetskopi hver dag.", "Kopier reminderfox.ics fra Firefox- eller Thunderbird-profilen på datamaskinen (mappen reminderfox) til denne enheten, og velg den så her."],
 'sv-SE': ["Kalender", "Ny", "I dag och kommande", "Larm (tysta)", "Dela en kopia av din påminnelsefil", "Dina påminnelser sparas på den här enheten, med en säkerhetskopia varje dag.", "Kopiera reminderfox.ics från Firefox- eller Thunderbird-profilen på datorn (mappen reminderfox) till den här enheten och välj den sedan här."],
 'fi': ["Kalenteri", "Uusi", "Tänään ja tulossa", "Hälytykset (äänettömät)", "Jaa kopio muistutustiedostostasi", "Muistutuksesi säilytetään tällä laitteella, ja niistä tehdään varmuuskopio joka päivä.", "Kopioi reminderfox.ics tietokoneesi Firefox- tai Thunderbird-profiilista (sen reminderfox-kansiosta) tälle laitteelle ja valitse se sitten tästä."],
 'et-EE': ["Kalender", "Uus", "Täna ja tulemas", "Alarmid (vaikne)", "Jaga oma meeldetuletuste faili koopiat", "Sinu meeldetuletusi hoitakse selles seadmes, iga päev tehakse varukoopia.", "Kopeeri reminderfox.ics oma arvuti Firefoxi või Thunderbirdi profiilist (selle kaustast reminderfox) sellesse seadmesse ja vali see siis siin."],
 'fy-NL': ["Aginda", "Nij", "Hjoed en meikoarten", "Alarms (stil)", "In kopy fan dyn oantinkensbestân diele", "Dyn oantinkens wurde op dit apparaat bewarre, mei elke dei in reservekopy.", "Kopiearje reminderfox.ics út it Firefox- of Thunderbird-profyl fan dyn kompjûter (de map reminderfox) nei dit apparaat en kies it dan hjir."],
 'ga-IE': ["Féilire", "Nua", "Inniu agus le teacht", "Aláraim (ciúin)", "Comhroinn cóip de do chomhad meabhrúchán", "Coinnítear do mheabhrúcháin ar an ngléas seo, le cúltaca gach lá.", "Cóipeáil reminderfox.ics ó phróifíl Firefox nó Thunderbird do ríomhaire (a fhillteán reminderfox) chuig an ngléas seo, ansin roghnaigh anseo é."],
 'cs-CZ': ["Kalendář", "Nový", "Dnes a nadcházející", "Budíky (tiché)", "Sdílet kopii souboru s připomínkami", "Vaše připomínky jsou uloženy v tomto zařízení, se zálohou každý den.", "Zkopírujte reminderfox.ics z profilu Firefoxu nebo Thunderbirdu v počítači (jeho složky reminderfox) do tohoto zařízení a pak ho vyberte zde."],
 'sk-SK': ["Kalendár", "Nový", "Dnes a nadchádzajúce", "Budíky (tiché)", "Zdieľať kópiu súboru s pripomienkami", "Vaše pripomienky sa uchovávajú v tomto zariadení, so zálohou každý deň.", "Skopírujte reminderfox.ics z profilu Firefoxu alebo Thunderbirdu v počítači (jeho priečinka reminderfox) do tohto zariadenia a potom ho vyberte tu."],
 'pl': ["Kalendarz", "Nowy", "Dziś i wkrótce", "Alarmy (ciche)", "Udostępnij kopię pliku przypomnień", "Twoje przypomnienia są przechowywane na tym urządzeniu, z kopią zapasową każdego dnia.", "Skopiuj reminderfox.ics z profilu Firefoksa lub Thunderbirda na komputerze (z folderu reminderfox) na to urządzenie, a potem wybierz go tutaj."],
 'hu-HU': ["Naptár", "Új", "Ma és hamarosan", "Riasztások (némák)", "Az emlékeztetőfájl másolatának megosztása", "Az emlékeztetőid ezen az eszközön vannak, minden nap biztonsági mentéssel.", "Másold a reminderfox.ics fájlt a számítógéped Firefox- vagy Thunderbird-profiljából (annak reminderfox mappájából) erre az eszközre, majd válaszd ki itt."],
 'ro-RO': ["Calendar", "Nou", "Azi și în curând", "Alarme (silențioase)", "Partajează o copie a fișierului de mementouri", "Mementourile tale sunt păstrate pe acest dispozitiv, cu o copie de rezervă în fiecare zi.", "Copiază reminderfox.ics din profilul Firefox sau Thunderbird al computerului (dosarul reminderfox) pe acest dispozitiv, apoi alege-l aici."],
 'ru-RU': ["Календарь", "Новое", "Сегодня и скоро", "Будильники (без звука)", "Поделиться копией файла напоминаний", "Ваши напоминания хранятся на этом устройстве, с резервной копией каждый день.", "Скопируйте reminderfox.ics из профиля Firefox или Thunderbird на компьютере (папка reminderfox) на это устройство, затем выберите его здесь."],
 'uk-UA': ["Календар", "Нове", "Сьогодні й незабаром", "Будильники (без звуку)", "Поділитися копією файлу нагадувань", "Ваші нагадування зберігаються на цьому пристрої, з резервною копією щодня.", "Скопіюйте reminderfox.ics із профілю Firefox або Thunderbird на комп'ютері (тека reminderfox) на цей пристрій, а потім виберіть його тут."],
 'be-BY': ["Каляндар", "Новае", "Сёння і хутка", "Будзільнікі (без гуку)", "Падзяліцца копіяй файла напамінаў", "Вашы напаміны захоўваюцца на гэтай прыладзе, з рэзервовай копіяй кожны дзень.", "Скапіруйце reminderfox.ics з профілю Firefox або Thunderbird на камп'ютары (тэчка reminderfox) на гэту прыладу, потым выберыце яго тут."],
 'tr': ["Takvim", "Yeni", "Bugün ve yaklaşanlar", "Alarmlar (sessiz)", "Anımsatıcı dosyanızın bir kopyasını paylaşın", "Anımsatıcılarınız bu cihazda, her gün bir yedekle saklanır.", "reminderfox.ics dosyasını bilgisayarınızdaki Firefox veya Thunderbird profilinden (reminderfox klasöründen) bu cihaza kopyalayın, sonra burada seçin."],
 'ar': ["التقويم", "جديد", "اليوم والقادم", "المنبهات (صامتة)", "مشاركة نسخة من ملف التذكيرات", "تُحفظ تذكيراتك على هذا الجهاز، مع نسخة احتياطية كل يوم.", "انسخ reminderfox.ics من ملف تعريف Firefox أو Thunderbird على حاسوبك (مجلد reminderfox) إلى هذا الجهاز، ثم اختره هنا."],
 'he-IL': ["לוח שנה", "חדש", "היום ובקרוב", "התראות (שקטות)", "שיתוף עותק של קובץ התזכורות", "התזכורות שלך נשמרות במכשיר הזה, עם גיבוי בכל יום.", "העתק את reminderfox.ics מפרופיל Firefox או Thunderbird במחשב (התיקייה reminderfox) למכשיר הזה, ואז בחר אותו כאן."],
 'ja-JP': ["カレンダー", "新規", "今日と今後", "アラーム（サイレント）", "リマインダーファイルのコピーを共有", "リマインダーはこのデバイスに保存され、毎日バックアップされます。", "パソコンの Firefox または Thunderbird のプロファイル（reminderfox フォルダー）から reminderfox.ics をこのデバイスにコピーし、ここで選んでください。"],
 'ko-KR': ["캘린더", "새로 만들기", "오늘 및 예정", "알람(무음)", "미리 알림 파일 사본 공유", "미리 알림은 이 기기에 보관되며 매일 백업됩니다.", "컴퓨터의 Firefox 또는 Thunderbird 프로필(reminderfox 폴더)에서 reminderfox.ics를 이 기기로 복사한 다음 여기에서 선택하세요."],
 'zh-CN': ["日历", "新建", "今天和即将到来", "闹钟（静音）", "分享提醒文件的副本", "你的提醒保存在此设备上，每天备份一次。", "将 reminderfox.ics 从电脑的 Firefox 或 Thunderbird 配置文件（其 reminderfox 文件夹）复制到此设备，然后在这里选择它。"],
 'zh-TW': ["行事曆", "新增", "今天和即將到來", "鬧鐘（靜音）", "分享提醒檔案的副本", "你的提醒保存在此裝置上，每天備份一次。", "將 reminderfox.ics 從電腦的 Firefox 或 Thunderbird 設定檔（其 reminderfox 資料夾）複製到此裝置，然後在這裡選擇它。"],
 'vi': ["Lịch", "Mới", "Hôm nay và sắp tới", "Báo thức (im lặng)", "Chia sẻ bản sao tệp lời nhắc", "Lời nhắc của bạn được lưu trên thiết bị này, sao lưu mỗi ngày.", "Sao chép reminderfox.ics từ hồ sơ Firefox hoặc Thunderbird trên máy tính (thư mục reminderfox) sang thiết bị này, rồi chọn nó ở đây."],
 'mn-MN': ["Хуанли", "Шинэ", "Өнөөдөр ба удахгүй", "Сэрүүлэг (дуугүй)", "Сануулгын файлын хуулбарыг хуваалцах", "Таны сануулгууд энэ төхөөрөмжид хадгалагдаж, өдөр бүр нөөцлөгдөнө.", "Компьютерийнхээ Firefox эсвэл Thunderbird профайлаас (reminderfox хавтас) reminderfox.ics-г энэ төхөөрөмж рүү хуулаад энд сонгоно уу."],
}
def main():
    cat = os.path.join(DIR, 'catalog.txt')
    lines = [l for l in open(cat, encoding='utf8').read().split('\n') if l.strip() and not l.startswith('#')]
    if EN[-1] in lines: print('already added'); return
    start = len(lines) + 1
    have = sorted(f[:-4] for f in os.listdir(DIR) if f.endswith('.txt') and f != 'catalog.txt')
    assert not [c for c in have if c not in L], [c for c in have if c not in L]
    assert all(len(v) == len(EN) for v in L.values())
    with open(cat, 'a', encoding='utf8') as f:
        f.write('# the Android app\n')
        for s in EN: f.write(s + '\n')
    for code, tr in L.items():
        p = os.path.join(DIR, f'{code}.txt')
        txt = open(p, encoding='utf8').read()
        if not txt.endswith('\n'): txt += '\n'
        txt += ''.join(f'{start + i}| {t}\n' for i, t in enumerate(tr))
        open(p, 'w', encoding='utf8').write(txt)
    print('added', len(EN), 'from', start)
main()
