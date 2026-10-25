#!/usr/bin/env python3
# Adds the 0.9.0 strings (macOS and Linux: the application menu, the platform wording) to catalog.txt and every
# <code>.txt (run once). The note on themes, "As in your system ({s})" and the Mac / Linux welcome lines are made from
# each language's own Windows wording.
import os, re
DIR = os.path.dirname(os.path.abspath(__file__))
NOTE_W = "Default is Fox, light or dark to match Windows. Starred items have their own colour in every theme. High contrast uses black, white, yellow and cyan with larger text and heavier lines."
WELCOME_W = "Your reminders, to-dos and alarms as a Windows app — a tribute to the original ReminderFox add-on."
EN = [
 "File", "Edit", "Window", "Settings…", "About {app}", "Hide {app}", "Close window", "Reminders, to-dos and alarms",
 "Start ReminderFoxAgain when you log in",
 "As in your system",
 "Default (follows the system)",
 "Keep running in the menu bar when the window is closed",
 "Show a number on the Dock icon",
 "Show a number on the tray icon",
 "Show the reminders file in Finder",
 "Show the reminders file in your file manager",
 "Your desktop shows no tray icons, so closing the window quits. To keep alarms coming with the window closed, add a tray extension (on GNOME, “AppIndicator and KStatusNotifierItem Support”).",
 # made from the existing translations:
 NOTE_W.replace('match Windows', 'match your system'),
 "As in your system ({s})",
 WELCOME_W.replace('a Windows app', 'a Mac app'),
 WELCOME_W.replace('a Windows app', 'a Linux app'),
]
EXT = 'AppIndicator and KStatusNotifierItem Support'
# per language: 17 translations (the order of EN), then the note's Windows phrase → the system phrase
L = {}
L['de'] = ["Ablage", "Bearbeiten", "Fenster", "Einstellungen…", "Über {app}", "{app} ausblenden", "Fenster schließen", "Erinnerungen, Aufgaben und Alarme",
 "ReminderFoxAgain bei der Anmeldung starten", "Wie im System", "Standard (wie das System)", "In der Menüleiste weiterlaufen, wenn das Fenster geschlossen wird",
 "Eine Zahl auf dem Dock-Symbol anzeigen", "Eine Zahl auf dem Symbol im Infobereich anzeigen", "Die Erinnerungsdatei im Finder zeigen", "Die Erinnerungsdatei im Dateimanager zeigen",
 f"Ihr Desktop zeigt keine Symbole im Infobereich, daher beendet das Schließen des Fensters die App. Damit Alarme auch bei geschlossenem Fenster erscheinen, fügen Sie eine Erweiterung für den Infobereich hinzu (unter GNOME „{EXT}“).",
 ("passend zu Windows", "passend zum System")]
L['fr'] = ["Fichier", "Édition", "Fenêtre", "Réglages…", "À propos de {app}", "Masquer {app}", "Fermer la fenêtre", "Rappels, tâches et alarmes",
 "Démarrer ReminderFoxAgain à l'ouverture de session", "Comme dans le système", "Par défaut (comme le système)", "Rester dans la barre des menus quand la fenêtre est fermée",
 "Afficher un nombre sur l'icône du Dock", "Afficher un nombre sur l'icône de la zone de notification", "Afficher le fichier des rappels dans le Finder", "Afficher le fichier des rappels dans le gestionnaire de fichiers",
 f"Votre bureau n'affiche pas d'icônes de notification : fermer la fenêtre quitte l'application. Pour que les alarmes continuent fenêtre fermée, ajoutez une extension de zone de notification (sous GNOME, « {EXT} »).",
 ("selon Windows", "selon le système")]
L['es-ES'] = ["Archivo", "Edición", "Ventana", "Ajustes…", "Acerca de {app}", "Ocultar {app}", "Cerrar ventana", "Recordatorios, tareas y alarmas",
 "Iniciar ReminderFoxAgain al iniciar sesión", "Como en el sistema", "Predeterminado (como el sistema)", "Seguir en la barra de menús al cerrar la ventana",
 "Mostrar un número en el icono del Dock", "Mostrar un número en el icono de la bandeja", "Mostrar el archivo de recordatorios en el Finder", "Mostrar el archivo de recordatorios en el gestor de archivos",
 f"Su escritorio no muestra iconos en la bandeja, así que cerrar la ventana cierra la aplicación. Para seguir recibiendo alarmas con la ventana cerrada, añada una extensión de bandeja (en GNOME, «{EXT}»).",
 ("según Windows", "según el sistema")]
L['it'] = ["File", "Modifica", "Finestra", "Impostazioni…", "Informazioni su {app}", "Nascondi {app}", "Chiudi finestra", "Promemoria, attività e allarmi",
 "Avvia ReminderFoxAgain all'accesso", "Come nel sistema", "Predefinito (come il sistema)", "Resta nella barra dei menu quando la finestra è chiusa",
 "Mostra un numero sull'icona del Dock", "Mostra un numero sull'icona dell'area di notifica", "Mostra il file dei promemoria nel Finder", "Mostra il file dei promemoria nel file manager",
 f"Il tuo desktop non mostra icone nell'area di notifica, quindi chiudere la finestra chiude l'app. Per continuare a ricevere gli allarmi a finestra chiusa, aggiungi un'estensione per l'area di notifica (su GNOME, «{EXT}»).",
 ("come Windows", "come il sistema")]
L['nl'] = ["Archief", "Wijzig", "Venster", "Instellingen…", "Over {app}", "Verberg {app}", "Venster sluiten", "Herinneringen, taken en alarmen",
 "ReminderFoxAgain starten bij het inloggen", "Zoals in het systeem", "Standaard (volgt het systeem)", "In de menubalk blijven draaien als het venster wordt gesloten",
 "Een getal op het Dock-pictogram tonen", "Een getal op het pictogram in het systeemvak tonen", "Het herinneringenbestand tonen in de Finder", "Het herinneringenbestand tonen in de bestandsbeheerder",
 f"Uw bureaublad toont geen pictogrammen in het systeemvak, dus sluiten van het venster beëindigt de app. Wilt u alarmen blijven krijgen met het venster dicht, voeg dan een systeemvak-extensie toe (in GNOME: ‘{EXT}’).",
 ("passend bij Windows", "passend bij het systeem")]
L['pt-BR'] = ["Arquivo", "Editar", "Janela", "Ajustes…", "Sobre o {app}", "Ocultar {app}", "Fechar janela", "Lembretes, tarefas e alarmes",
 "Iniciar o ReminderFoxAgain ao entrar na sessão", "Como no sistema", "Padrão (segue o sistema)", "Continuar rodando na barra de menus quando a janela for fechada",
 "Mostrar um número no ícone do Dock", "Mostrar um número no ícone da bandeja", "Mostrar o arquivo de lembretes no Finder", "Mostrar o arquivo de lembretes no gerenciador de arquivos",
 f"Sua área de trabalho não mostra ícones na bandeja, então fechar a janela encerra o app. Para continuar recebendo alarmes com a janela fechada, adicione uma extensão de bandeja (no GNOME, “{EXT}”).",
 ("conforme o Windows", "conforme o sistema")]
L['pt-PT'] = ["Ficheiro", "Editar", "Janela", "Definições…", "Acerca do {app}", "Ocultar {app}", "Fechar janela", "Lembretes, tarefas e alarmes",
 "Iniciar o ReminderFoxAgain ao iniciar sessão", "Como no sistema", "Padrão (segue o sistema)", "Continuar em execução na barra de menus quando a janela for fechada",
 "Mostrar um número no ícone da Dock", "Mostrar um número no ícone da área de notificação", "Mostrar o ficheiro de lembretes no Finder", "Mostrar o ficheiro de lembretes no gestor de ficheiros",
 f"O seu ambiente de trabalho não mostra ícones na área de notificação, pelo que fechar a janela termina a aplicação. Para continuar a receber alarmes com a janela fechada, adicione uma extensão de área de notificação (no GNOME, «{EXT}»).",
 ("conforme o Windows", "conforme o sistema")]
L['ca-AD'] = ["Fitxer", "Edita", "Finestra", "Configuració…", "Quant a {app}", "Amaga {app}", "Tanca la finestra", "Recordatoris, tasques i alarmes",
 "Inicia ReminderFoxAgain en iniciar la sessió", "Com al sistema", "Predeterminat (com el sistema)", "Continua a la barra de menús quan es tanqui la finestra",
 "Mostra un número a la icona del Dock", "Mostra un número a la icona de la safata", "Mostra el fitxer de recordatoris al Finder", "Mostra el fitxer de recordatoris al gestor de fitxers",
 f"El vostre escriptori no mostra icones a la safata, així que tancar la finestra surt de l'aplicació. Per continuar rebent alarmes amb la finestra tancada, afegiu una extensió de safata (al GNOME, «{EXT}»).",
 ("segons el Windows", "segons el sistema")]
L['gl-ES'] = ["Ficheiro", "Editar", "Ventá", "Axustes…", "Acerca de {app}", "Agochar {app}", "Pechar a ventá", "Lembretes, tarefas e alarmas",
 "Iniciar ReminderFoxAgain ao iniciar sesión", "Como no sistema", "Predeterminado (como o sistema)", "Seguir na barra de menús ao pechar a ventá",
 "Mostrar un número na icona do Dock", "Mostrar un número na icona da bandexa", "Mostrar o ficheiro de lembretes no Finder", "Mostrar o ficheiro de lembretes no xestor de ficheiros",
 f"O seu escritorio non mostra iconas na bandexa, así que pechar a ventá sae da aplicación. Para seguir recibindo alarmas coa ventá pechada, engada unha extensión de bandexa (en GNOME, «{EXT}»).",
 ("segundo Windows", "segundo o sistema")]
L['da'] = ["Arkiv", "Rediger", "Vindue", "Indstillinger…", "Om {app}", "Skjul {app}", "Luk vindue", "Påmindelser, opgaver og alarmer",
 "Start ReminderFoxAgain, når du logger ind", "Som i systemet", "Standard (følger systemet)", "Fortsæt i menulinjen, når vinduet lukkes",
 "Vis et tal på Dock-ikonet", "Vis et tal på ikonet i meddelelsesområdet", "Vis påmindelsesfilen i Finder", "Vis påmindelsesfilen i filhåndteringen",
 f"Dit skrivebord viser ingen ikoner i meddelelsesområdet, så når vinduet lukkes, afsluttes appen. For at få alarmer med lukket vindue skal du tilføje en udvidelse til meddelelsesområdet (i GNOME: “{EXT}”).",
 ("efter Windows", "efter systemet")]
L['nb-NO'] = ["Arkiv", "Rediger", "Vindu", "Innstillinger…", "Om {app}", "Skjul {app}", "Lukk vindu", "Påminnelser, oppgaver og alarmer",
 "Start ReminderFoxAgain når du logger på", "Som i systemet", "Standard (følger systemet)", "Fortsett i menylinjen når vinduet lukkes",
 "Vis et tall på Dock-ikonet", "Vis et tall på ikonet i systemstatusfeltet", "Vis påminnelsesfilen i Finder", "Vis påminnelsesfilen i filbehandleren",
 f"Skrivebordet ditt viser ingen ikoner i systemstatusfeltet, så å lukke vinduet avslutter appen. For å få alarmer med vinduet lukket, legg til en utvidelse for statusfeltet (i GNOME: «{EXT}»).",
 ("etter Windows", "etter systemet")]
L['sv-SE'] = ["Arkiv", "Redigera", "Fönster", "Inställningar…", "Om {app}", "Göm {app}", "Stäng fönster", "Påminnelser, uppgifter och larm",
 "Starta ReminderFoxAgain när du loggar in", "Som i systemet", "Standard (följer systemet)", "Fortsätt köra i menyraden när fönstret stängs",
 "Visa ett tal på Dock-symbolen", "Visa ett tal på ikonen i meddelandefältet", "Visa påminnelsefilen i Finder", "Visa påminnelsefilen i filhanteraren",
 f"Ditt skrivbord visar inga ikoner i meddelandefältet, så att stänga fönstret avslutar appen. För att få larm med fönstret stängt, lägg till ett tillägg för meddelandefältet (i GNOME: ”{EXT}”).",
 ("efter Windows", "efter systemet")]
L['fi'] = ["Arkisto", "Muokkaa", "Ikkuna", "Asetukset…", "Tietoja: {app}", "Kätke {app}", "Sulje ikkuna", "Muistutukset, tehtävät ja hälytykset",
 "Käynnistä ReminderFoxAgain kirjautuessasi sisään", "Kuten järjestelmässä", "Oletus (järjestelmän mukaan)", "Jatka valikkorivillä, kun ikkuna suljetaan",
 "Näytä luku Dockin kuvakkeessa", "Näytä luku ilmaisinalueen kuvakkeessa", "Näytä muistutustiedosto Finderissa", "Näytä muistutustiedosto tiedostonhallinnassa",
 f"Työpöytäsi ei näytä ilmaisinalueen kuvakkeita, joten ikkunan sulkeminen lopettaa sovelluksen. Jotta hälytykset tulevat ikkunan ollessa suljettuna, lisää ilmaisinalueen laajennus (GNOMEssa ”{EXT}”).",
 ("Windowsin mukaan", "järjestelmän mukaan")]
L['et-EE'] = ["Fail", "Redigeeri", "Aken", "Seaded…", "Teave: {app}", "Peida {app}", "Sulge aken", "Meeldetuletused, ülesanded ja alarmid",
 "Käivita ReminderFoxAgain sisselogimisel", "Nagu süsteemis", "Vaikimisi (järgib süsteemi)", "Jätka menüüribal, kui aken suletakse",
 "Näita arvu Docki ikoonil", "Näita arvu teavitusala ikoonil", "Näita meeldetuletuste faili Finderis", "Näita meeldetuletuste faili failihalduris",
 f"Sinu töölaud ei näita teavitusala ikoone, seega akna sulgemine lõpetab rakenduse. Et alarmid tuleksid ka suletud aknaga, lisa teavitusala laiendus (GNOME'is „{EXT}“).",
 ("vastavalt Windowsile", "vastavalt süsteemile")]
L['fy-NL'] = ["Triem", "Bewurkje", "Finster", "Ynstellingen…", "Oer {app}", "{app} ferstopje", "Finster slute", "Oantinkers, taken en alarms",
 "ReminderFoxAgain starte by it oanmelden", "Lykas yn it systeem", "Standert (folget it systeem)", "Yn de menubalke trochrinne as it finster sluten wurdt",
 "In getal op it Dock-ikoan sjen litte", "In getal op it ikoan yn it systeemfak sjen litte", "It oantinkersbestân yn de Finder sjen litte", "It oantinkersbestân yn de triembehearder sjen litte",
 f"Jo buroblêd lit gjin ikoanen yn it systeemfak sjen, dus it finster slute einiget de app. Om alarms te krijen mei it finster ticht, foegje in systeemfak-útwreiding ta (yn GNOME: ‘{EXT}’).",
 ("neffens Windows", "neffens it systeem")]
L['ga-IE'] = ["Comhad", "Eagar", "Fuinneog", "Socruithe…", "Maidir le {app}", "Folaigh {app}", "Dún an fhuinneog", "Meabhrúcháin, tascanna agus aláraim",
 "Tosaigh ReminderFoxAgain nuair a logálann tú isteach", "Mar atá sa chóras", "Réamhshocrú (de réir an chórais)", "Coinnigh ag rith sa bharra roghchláir nuair a dhúntar an fhuinneog",
 "Taispeáin uimhir ar dheilbhín an Dock", "Taispeáin uimhir ar dheilbhín an tráidire", "Taispeáin comhad na meabhrúchán in Finder", "Taispeáin comhad na meabhrúchán sa bhainisteoir comhad",
 f"Ní thaispeánann do dheasc deilbhíní tráidire, mar sin scoireann an aip nuair a dhúntar an fhuinneog. Chun aláraim a fháil leis an bhfuinneog dúnta, cuir síneadh tráidire leis (ar GNOME, “{EXT}”).",
 ("de réir Windows", "de réir an chórais")]
L['cs-CZ'] = ["Soubor", "Úpravy", "Okno", "Nastavení…", "O aplikaci {app}", "Skrýt {app}", "Zavřít okno", "Připomínky, úkoly a alarmy",
 "Spouštět ReminderFoxAgain po přihlášení", "Jako v systému", "Výchozí (podle systému)", "Při zavření okna běžet dál v řádku nabídek",
 "Zobrazit číslo na ikoně v Docku", "Zobrazit číslo na ikoně v oznamovací oblasti", "Zobrazit soubor připomínek ve Finderu", "Zobrazit soubor připomínek ve správci souborů",
 f"Vaše plocha nezobrazuje ikony v oznamovací oblasti, takže zavření okna aplikaci ukončí. Aby alarmy chodily i se zavřeným oknem, přidejte rozšíření pro oznamovací oblast (v GNOME „{EXT}“).",
 ("podle Windows", "podle systému")]
L['sk-SK'] = ["Súbor", "Upraviť", "Okno", "Nastavenia…", "O aplikácii {app}", "Skryť {app}", "Zavrieť okno", "Pripomienky, úlohy a alarmy",
 "Spúšťať ReminderFoxAgain po prihlásení", "Ako v systéme", "Predvolený (podľa systému)", "Pri zatvorení okna bežať ďalej v lište ponúk",
 "Zobraziť číslo na ikone v Docku", "Zobraziť číslo na ikone v oblasti oznámení", "Zobraziť súbor pripomienok vo Finderi", "Zobraziť súbor pripomienok v správcovi súborov",
 f"Vaša pracovná plocha nezobrazuje ikony v oblasti oznámení, takže zatvorenie okna aplikáciu ukončí. Aby alarmy chodili aj so zatvoreným oknom, pridajte rozšírenie pre oblasť oznámení (v GNOME „{EXT}“).",
 ("podľa Windows", "podľa systému")]
L['pl'] = ["Plik", "Edycja", "Okno", "Ustawienia…", "{app} — informacje", "Ukryj {app}", "Zamknij okno", "Przypomnienia, zadania i alarmy",
 "Uruchamiaj ReminderFoxAgain po zalogowaniu", "Jak w systemie", "Domyślny (jak w systemie)", "Działaj dalej na pasku menu po zamknięciu okna",
 "Pokazuj liczbę na ikonie w Docku", "Pokazuj liczbę na ikonie w zasobniku", "Pokaż plik przypomnień w Finderze", "Pokaż plik przypomnień w menedżerze plików",
 f"Twój pulpit nie pokazuje ikon w zasobniku, więc zamknięcie okna kończy aplikację. Aby alarmy pojawiały się przy zamkniętym oknie, dodaj rozszerzenie zasobnika (w GNOME „{EXT}”).",
 ("zgodnie z Windows", "zgodnie z systemem")]
L['hu-HU'] = ["Fájl", "Szerkesztés", "Ablak", "Beállítások…", "A(z) {app} névjegye", "{app} elrejtése", "Ablak bezárása", "Emlékeztetők, teendők és riasztások",
 "A ReminderFoxAgain indítása bejelentkezéskor", "Mint a rendszerben", "Alapértelmezett (a rendszert követi)", "Futás a menüsorban az ablak bezárása után is",
 "Szám megjelenítése a Dock ikonján", "Szám megjelenítése a tálcaikonon", "Az emlékeztetőfájl megjelenítése a Finderben", "Az emlékeztetőfájl megjelenítése a fájlkezelőben",
 f"Az asztala nem mutat tálcaikonokat, ezért az ablak bezárása kilép az alkalmazásból. Hogy a riasztások zárt ablaknál is megjelenjenek, adjon hozzá egy tálcabővítményt (GNOME alatt: „{EXT}”).",
 ("a Windowsnak megfelelően", "a rendszernek megfelelően")]
L['ro-RO'] = ["Fișier", "Editare", "Fereastră", "Configurări…", "Despre {app}", "Ascunde {app}", "Închide fereastra", "Mementouri, sarcini și alarme",
 "Pornește ReminderFoxAgain la autentificare", "Ca în sistem", "Implicită (ca sistemul)", "Continuă în bara de meniu când fereastra e închisă",
 "Afișează un număr pe pictograma din Dock", "Afișează un număr pe pictograma din zona de notificare", "Afișează fișierul de mementouri în Finder", "Afișează fișierul de mementouri în managerul de fișiere",
 f"Desktopul dvs. nu afișează pictograme în zona de notificare, deci închiderea ferestrei închide aplicația. Ca alarmele să apară cu fereastra închisă, adăugați o extensie pentru zona de notificare (în GNOME, „{EXT}”).",
 ("după Windows", "după sistem")]
L['ru-RU'] = ["Файл", "Правка", "Окно", "Настройки…", "О программе {app}", "Скрыть {app}", "Закрыть окно", "Напоминания, задачи и сигналы",
 "Запускать ReminderFoxAgain при входе в систему", "Как в системе", "По умолчанию (как в системе)", "Продолжать работать в строке меню, когда окно закрыто",
 "Показывать число на значке в Dock", "Показывать число на значке в трее", "Показать файл напоминаний в Finder", "Показать файл напоминаний в файловом менеджере",
 f"Ваш рабочий стол не показывает значки в трее, поэтому закрытие окна завершает программу. Чтобы сигналы приходили при закрытом окне, добавьте расширение для трея (в GNOME — «{EXT}»).",
 ("в соответствии с Windows", "в соответствии с системой")]
L['uk-UA'] = ["Файл", "Редагування", "Вікно", "Параметри…", "Про {app}", "Сховати {app}", "Закрити вікно", "Нагадування, завдання й сигнали",
 "Запускати ReminderFoxAgain під час входу", "Як у системі", "Типова (як у системі)", "Працювати далі в рядку меню, коли вікно закрито",
 "Показувати число на значку в Dock", "Показувати число на значку в треї", "Показати файл нагадувань у Finder", "Показати файл нагадувань у файловому менеджері",
 f"Ваша стільниця не показує значки в треї, тому закриття вікна завершує застосунок. Щоб сигнали надходили із закритим вікном, додайте розширення для трею (у GNOME — «{EXT}»).",
 ("відповідно до Windows", "відповідно до системи")]
L['be-BY'] = ["Файл", "Праўка", "Акно", "Налады…", "Пра {app}", "Схаваць {app}", "Закрыць акно", "Напаміны, задачы і сігналы",
 "Запускаць ReminderFoxAgain пры ўваходзе", "Як у сістэме", "Па змаўчанні (як у сістэме)", "Працаваць далей у радку меню, калі акно закрыта",
 "Паказваць лік на значку ў Dock", "Паказваць лік на значку ў трэі", "Паказаць файл напамінаў у Finder", "Паказаць файл напамінаў у файлавым менеджары",
 f"Ваш працоўны стол не паказвае значкі ў трэі, таму закрыццё акна завяршае праграму. Каб сігналы прыходзілі пры закрытым акне, дадайце пашырэнне для трэя (у GNOME — «{EXT}»).",
 ("адпаведна Windows", "адпаведна сістэме")]
L['tr'] = ["Dosya", "Düzen", "Pencere", "Ayarlar…", "{app} Hakkında", "{app} Uygulamasını Gizle", "Pencereyi kapat", "Hatırlatıcılar, görevler ve alarmlar",
 "Oturum açınca ReminderFoxAgain'i başlat", "Sistemdeki gibi", "Varsayılan (sistemi izler)", "Pencere kapatılınca menü çubuğunda çalışmaya devam et",
 "Dock simgesinde bir sayı göster", "Tepsi simgesinde bir sayı göster", "Hatırlatıcı dosyasını Finder'da göster", "Hatırlatıcı dosyasını dosya yöneticisinde göster",
 f"Masaüstünüz tepsi simgelerini göstermiyor, bu yüzden pencereyi kapatmak uygulamadan çıkar. Pencere kapalıyken alarmların gelmesi için bir tepsi uzantısı ekleyin (GNOME'da “{EXT}”).",
 ("Windows'a göre", "sisteme göre")]
L['ar'] = ["ملف", "تحرير", "نافذة", "الإعدادات…", "حول {app}", "إخفاء {app}", "إغلاق النافذة", "تذكيرات ومهام ومنبّهات",
 "تشغيل ReminderFoxAgain عند تسجيل الدخول", "كما في النظام", "افتراضي (يتبع النظام)", "الاستمرار في شريط القوائم عند إغلاق النافذة",
 "إظهار رقم على أيقونة Dock", "إظهار رقم على أيقونة منطقة الإعلام", "إظهار ملف التذكيرات في Finder", "إظهار ملف التذكيرات في مدير الملفات",
 f"لا يعرض سطح المكتب لديك أيقونات منطقة الإعلام، لذا يؤدي إغلاق النافذة إلى إنهاء التطبيق. لتستمر المنبّهات والنافذة مغلقة، أضف امتدادًا لمنطقة الإعلام (في GNOME: «{EXT}»).",
 ("بحسب Windows", "بحسب النظام")]
L['he-IL'] = ["קובץ", "עריכה", "חלון", "הגדרות…", "אודות {app}", "הסתרת {app}", "סגירת החלון", "תזכורות, משימות והתראות",
 "להפעיל את ReminderFoxAgain בכניסה למערכת", "כמו במערכת", "ברירת מחדל (לפי המערכת)", "להמשיך לפעול בשורת התפריטים כשהחלון נסגר",
 "להציג מספר על הסמל ב־Dock", "להציג מספר על הסמל במגש", "הצגת קובץ התזכורות ב־Finder", "הצגת קובץ התזכורות במנהל הקבצים",
 f"שולחן העבודה שלך לא מציג סמלי מגש, ולכן סגירת החלון יוצאת מהיישום. כדי שההתראות ימשיכו כשהחלון סגור, יש להוסיף הרחבת מגש (ב־GNOME: „{EXT}”).",
 ("בהתאם ל־Windows", "בהתאם למערכת")]
L['ja-JP'] = ["ファイル", "編集", "ウインドウ", "設定…", "{app} について", "{app} を非表示", "ウインドウを閉じる", "リマインダー、ToDo、アラーム",
 "ログイン時に ReminderFoxAgain を起動する", "システムと同じ", "既定 (システムに従う)", "ウィンドウを閉じてもメニューバーで動作を続ける",
 "Dock のアイコンに数を表示する", "トレイのアイコンに数を表示する", "リマインダーファイルを Finder で表示", "リマインダーファイルをファイルマネージャーで表示",
 f"お使いのデスクトップはトレイアイコンを表示しないため、ウィンドウを閉じるとアプリが終了します。ウィンドウを閉じてもアラームを受け取るには、トレイの拡張機能を追加してください (GNOME では「{EXT}」)。",
 ("Windows に合わせて", "システムに合わせて")]
L['ko-KR'] = ["파일", "편집", "윈도우", "설정…", "{app}에 관하여", "{app} 가리기", "창 닫기", "미리 알림, 할 일, 알람",
 "로그인할 때 ReminderFoxAgain 시작", "시스템과 같게", "기본(시스템 따름)", "창을 닫아도 메뉴 막대에서 계속 실행",
 "Dock 아이콘에 숫자 표시", "트레이 아이콘에 숫자 표시", "Finder에서 미리 알림 파일 보기", "파일 관리자에서 미리 알림 파일 보기",
 f"데스크톱에 트레이 아이콘이 표시되지 않으므로 창을 닫으면 앱이 종료됩니다. 창을 닫아도 알람을 받으려면 트레이 확장을 추가하세요(GNOME에서는 “{EXT}”).",
 ("Windows에 맞춰", "시스템에 맞춰")]
L['zh-CN'] = ["文件", "编辑", "窗口", "设置…", "关于 {app}", "隐藏 {app}", "关闭窗口", "提醒、待办和闹钟",
 "登录时启动 ReminderFoxAgain", "与系统相同", "默认（跟随系统）", "关闭窗口后继续在菜单栏中运行",
 "在程序坞图标上显示数字", "在托盘图标上显示数字", "在访达中显示提醒文件", "在文件管理器中显示提醒文件",
 f"你的桌面不显示托盘图标，因此关闭窗口会退出应用。若要在关闭窗口后继续收到闹钟，请添加托盘扩展（在 GNOME 中为“{EXT}”）。",
 ("与 Windows 一致", "与系统一致")]
L['zh-TW'] = ["檔案", "編輯", "視窗", "設定…", "關於 {app}", "隱藏 {app}", "關閉視窗", "提醒、待辦事項和鬧鐘",
 "登入時啟動 ReminderFoxAgain", "與系統相同", "預設（跟隨系統）", "關閉視窗後繼續在選單列中執行",
 "在 Dock 圖示上顯示數字", "在系統匣圖示上顯示數字", "在 Finder 中顯示提醒檔案", "在檔案管理員中顯示提醒檔案",
 f"你的桌面不顯示系統匣圖示，因此關閉視窗會結束應用程式。若要在關閉視窗後繼續收到鬧鐘，請加入系統匣擴充功能（在 GNOME 中為「{EXT}」）。",
 ("與 Windows 一致", "與系統一致")]
L['vi'] = ["Tệp", "Sửa", "Cửa sổ", "Cài đặt…", "Giới thiệu {app}", "Ẩn {app}", "Đóng cửa sổ", "Lời nhắc, việc cần làm và báo thức",
 "Khởi động ReminderFoxAgain khi đăng nhập", "Như trong hệ thống", "Mặc định (theo hệ thống)", "Tiếp tục chạy trên thanh menu khi đóng cửa sổ",
 "Hiện số trên biểu tượng Dock", "Hiện số trên biểu tượng khay", "Hiện tệp lời nhắc trong Finder", "Hiện tệp lời nhắc trong trình quản lý tệp",
 f"Màn hình của bạn không hiện biểu tượng khay, nên đóng cửa sổ sẽ thoát ứng dụng. Để vẫn nhận báo thức khi đóng cửa sổ, hãy thêm một tiện ích khay (trên GNOME: “{EXT}”).",
 ("theo Windows", "theo hệ thống")]
L['mn-MN'] = ["Файл", "Засах", "Цонх", "Тохиргоо…", "{app}-ийн тухай", "{app}-ийг нуух", "Цонх хаах", "Сануулга, хийх ажил, сэрүүлэг",
 "Нэвтрэхэд ReminderFoxAgain-ийг эхлүүлэх", "Системтэй адил", "Өгөгдмөл (системийг дагана)", "Цонхыг хаахад цэсний мөрөнд ажилласаар байх",
 "Dock-ийн дүрс дээр тоо харуулах", "Тавиурын дүрс дээр тоо харуулах", "Сануулгын файлыг Finder-т харуулах", "Сануулгын файлыг файл менежерт харуулах",
 f"Таны ширээний орчин тавиурын дүрс харуулдаггүй тул цонхыг хаахад програм хаагдана. Цонх хаалттай үед сэрүүлэг ирсээр байхын тулд тавиурын өргөтгөл нэмнэ үү (GNOME дээр “{EXT}”).",
 ("Windows-ийн дагуу", "системийн дагуу")]

def parse(p):
    return {int(m.group(1)): m.group(2) for m in (re.match(r'(\d+)\| (.*)', l.rstrip('\n')) for l in open(p, encoding='utf8')) if m}

def main():
    cat = os.path.join(DIR, 'catalog.txt')
    lines = [l for l in open(cat, encoding='utf8').read().split('\n') if l.strip() and not l.startswith('#')]
    if EN[8] in lines: print('already added'); return
    num = {}
    for i, l in enumerate(lines, 1):
        for k in l.split(' || '): num.setdefault(k, i)
    for k in ("File", "Edit", "Window"): assert k not in num, k
    start = len(lines) + 1
    out = {}
    for code, tr in L.items():
        assert len(tr) == 18, (code, len(tr))
        d = parse(os.path.join(DIR, f'{code}.txt'))
        old, new = tr[17]
        note = d[num[NOTE_W]]; assert old in note, (code, 'note'); note = note.replace(old, new, 1)
        asw, asw_s = d[num['As in Windows']], d[num['As in Windows ({s})']]
        assert asw_s.startswith(asw), (code, 'as'); as_s = tr[9] + asw_s[len(asw):]
        wel = d[num[WELCOME_W]]; assert wel.count('Windows') == 1, (code, 'welcome')
        out[code] = tr[:17] + [note, as_s, wel.replace('Windows', 'Mac'), wel.replace('Windows', 'Linux')]
    with open(cat, 'a', encoding='utf8') as f:
        f.write('# 0.9.0: macOS and Linux (the application menu, the wording of the platform)\n')
        for s in EN: f.write(s + '\n')
    for code, tr in out.items():
        p = os.path.join(DIR, f'{code}.txt')
        txt = open(p, encoding='utf8').read()
        if not txt.endswith('\n'): txt += '\n'
        txt += ''.join(f'{start + i}| {t}\n' for i, t in enumerate(tr))
        open(p, 'w', encoding='utf8').write(txt)
    have = sorted(f[:-4] for f in os.listdir(DIR) if f.endswith('.txt') and f != 'catalog.txt')
    print('added', len(EN), 'from', start, 'to', len(out), 'languages; missing:', [c for c in have if c not in out])

main()
