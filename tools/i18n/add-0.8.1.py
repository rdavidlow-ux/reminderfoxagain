#!/usr/bin/env python3
# Adds the 0.8.1 strings (your own themes) to catalog.txt and every <code>.txt (run once).
import os
DIR = os.path.dirname(os.path.abspath(__file__))
EN = [
 "Make a theme of your own from five colours",
 "＋ New theme…",
 "Change the colours of your theme",
 "＋ New theme… makes one of your own from five colours.",
 "Your themes",
 "Background",
 "Behind everything",
 "Lists and panels",
 "The lists, the calendar panel, dialogs",
 "Text",
 "Accent",
 "Buttons, today, selection",
 "Starred items",
 "Important reminders and to-dos",
 "The text is hard to read on the background (contrast {n}:1; 4.5:1 or more is easy to read).",
 "The accent is hard to see on the lists (contrast {n}:1; 3:1 or more is better).",
 "Starred items are hard to see on the lists (contrast {n}:1; 3:1 or more is better).",
 "Edit theme",
 "New theme",
 "Start from",
 "e.g. Forest",
 "The whole window shows the theme while you choose. Cancel puts the old one back.",
 "Please give the theme a name.",
 "There is already a theme with that name.",
 "Theme “{s}” saved",
 "Theme “{s}” added",
 "Delete theme?",
 "The theme “{s}” will be deleted. The app goes back to the Default theme.",
]
L = {}
L['de'] = ["Ein eigenes Design aus fünf Farben erstellen", "＋ Neues Design…", "Die Farben Ihres Designs ändern", "＋ Neues Design… erstellt ein eigenes aus fünf Farben.", "Ihre Designs",
 "Hintergrund", "Hinter allem", "Listen und Bereiche", "Die Listen, der Kalenderbereich, Dialoge", "Text", "Akzent", "Schaltflächen, heute, Auswahl", "Markierte Einträge", "Wichtige Erinnerungen und Aufgaben",
 "Der Text ist auf dem Hintergrund schwer zu lesen (Kontrast {n}:1; ab 4,5:1 gut lesbar).", "Der Akzent ist auf den Listen schwer zu sehen (Kontrast {n}:1; 3:1 oder mehr ist besser).", "Markierte Einträge sind auf den Listen schwer zu sehen (Kontrast {n}:1; 3:1 oder mehr ist besser).",
 "Design bearbeiten", "Neues Design", "Ausgehend von", "z. B. Wald", "Das ganze Fenster zeigt das Design, während Sie wählen. „Abbrechen“ stellt das alte wieder her.",
 "Bitte geben Sie dem Design einen Namen.", "Es gibt bereits ein Design mit diesem Namen.", "Design „{s}“ gespeichert", "Design „{s}“ hinzugefügt", "Design löschen?", "Das Design „{s}“ wird gelöscht. Die App kehrt zum Standard-Design zurück."]
L['fr'] = ["Créer votre propre thème à partir de cinq couleurs", "＋ Nouveau thème…", "Changer les couleurs de votre thème", "＋ Nouveau thème… en crée un à partir de cinq couleurs.", "Vos thèmes",
 "Arrière-plan", "Derrière tout", "Listes et panneaux", "Les listes, le panneau du calendrier, les dialogues", "Texte", "Accent", "Boutons, aujourd'hui, sélection", "Éléments étoilés", "Rappels et tâches importants",
 "Le texte est difficile à lire sur l'arrière-plan (contraste {n}:1 ; 4,5:1 ou plus se lit facilement).", "L'accent se voit mal sur les listes (contraste {n}:1 ; 3:1 ou plus est mieux).", "Les éléments étoilés se voient mal sur les listes (contraste {n}:1 ; 3:1 ou plus est mieux).",
 "Modifier le thème", "Nouveau thème", "À partir de", "p. ex. Forêt", "Toute la fenêtre montre le thème pendant votre choix. Annuler remet l'ancien.",
 "Veuillez donner un nom au thème.", "Un thème porte déjà ce nom.", "Thème « {s} » enregistré", "Thème « {s} » ajouté", "Supprimer le thème ?", "Le thème « {s} » sera supprimé. L'application revient au thème par défaut."]
L['es-ES'] = ["Crear un tema propio con cinco colores", "＋ Nuevo tema…", "Cambiar los colores de su tema", "＋ Nuevo tema… crea uno propio con cinco colores.", "Sus temas",
 "Fondo", "Detrás de todo", "Listas y paneles", "Las listas, el panel del calendario, los diálogos", "Texto", "Acento", "Botones, hoy, selección", "Elementos destacados", "Recordatorios y tareas importantes",
 "El texto se lee mal sobre el fondo (contraste {n}:1; 4,5:1 o más se lee bien).", "El acento se ve mal sobre las listas (contraste {n}:1; 3:1 o más es mejor).", "Los elementos destacados se ven mal sobre las listas (contraste {n}:1; 3:1 o más es mejor).",
 "Editar tema", "Nuevo tema", "Partir de", "p. ej., Bosque", "Toda la ventana muestra el tema mientras elige. Cancelar vuelve a poner el anterior.",
 "Ponga un nombre al tema.", "Ya hay un tema con ese nombre.", "Tema «{s}» guardado", "Tema «{s}» añadido", "¿Eliminar el tema?", "Se eliminará el tema «{s}». La aplicación vuelve al tema predeterminado."]
L['it'] = ["Crea un tema tuo da cinque colori", "＋ Nuovo tema…", "Cambia i colori del tuo tema", "＋ Nuovo tema… ne crea uno tuo da cinque colori.", "I tuoi temi",
 "Sfondo", "Dietro a tutto", "Elenchi e pannelli", "Gli elenchi, il pannello del calendario, le finestre di dialogo", "Testo", "Accento", "Pulsanti, oggi, selezione", "Voci con stella", "Promemoria e attività importanti",
 "Il testo si legge male sullo sfondo (contrasto {n}:1; da 4,5:1 si legge bene).", "L'accento si vede male sugli elenchi (contrasto {n}:1; 3:1 o più è meglio).", "Le voci con stella si vedono male sugli elenchi (contrasto {n}:1; 3:1 o più è meglio).",
 "Modifica tema", "Nuovo tema", "Parti da", "es. Foresta", "Tutta la finestra mostra il tema mentre scegli. Annulla rimette quello di prima.",
 "Dai un nome al tema.", "Esiste già un tema con questo nome.", "Tema «{s}» salvato", "Tema «{s}» aggiunto", "Eliminare il tema?", "Il tema «{s}» verrà eliminato. L'app torna al tema predefinito."]
L['nl'] = ["Een eigen thema maken van vijf kleuren", "＋ Nieuw thema…", "De kleuren van uw thema wijzigen", "＋ Nieuw thema… maakt er een van vijf kleuren.", "Uw thema's",
 "Achtergrond", "Achter alles", "Lijsten en panelen", "De lijsten, het kalenderpaneel, dialoogvensters", "Tekst", "Accent", "Knoppen, vandaag, selectie", "Items met ster", "Belangrijke herinneringen en taken",
 "De tekst is slecht leesbaar op de achtergrond (contrast {n}:1; vanaf 4,5:1 goed leesbaar).", "Het accent is slecht zichtbaar op de lijsten (contrast {n}:1; 3:1 of meer is beter).", "Items met ster zijn slecht zichtbaar op de lijsten (contrast {n}:1; 3:1 of meer is beter).",
 "Thema bewerken", "Nieuw thema", "Uitgaan van", "bijv. Bos", "Het hele venster toont het thema terwijl u kiest. Annuleren zet het oude terug.",
 "Geef het thema een naam.", "Er is al een thema met die naam.", "Thema ‘{s}’ opgeslagen", "Thema ‘{s}’ toegevoegd", "Thema verwijderen?", "Het thema ‘{s}’ wordt verwijderd. De app gaat terug naar het standaardthema."]
L['pt-BR'] = ["Criar um tema seu a partir de cinco cores", "＋ Novo tema…", "Mudar as cores do seu tema", "＋ Novo tema… cria um seu a partir de cinco cores.", "Seus temas",
 "Fundo", "Atrás de tudo", "Listas e painéis", "As listas, o painel do calendário, as caixas de diálogo", "Texto", "Destaque", "Botões, hoje, seleção", "Itens com estrela", "Lembretes e tarefas importantes",
 "O texto fica difícil de ler no fundo (contraste {n}:1; a partir de 4,5:1 fica fácil de ler).", "O destaque fica difícil de ver nas listas (contraste {n}:1; 3:1 ou mais é melhor).", "Os itens com estrela ficam difíceis de ver nas listas (contraste {n}:1; 3:1 ou mais é melhor).",
 "Editar tema", "Novo tema", "Começar de", "ex.: Floresta", "A janela inteira mostra o tema enquanto você escolhe. Cancelar volta ao anterior.",
 "Dê um nome ao tema.", "Já existe um tema com esse nome.", "Tema “{s}” salvo", "Tema “{s}” adicionado", "Excluir o tema?", "O tema “{s}” será excluído. O app volta ao tema padrão."]
L['pt-PT'] = ["Criar um tema seu a partir de cinco cores", "＋ Novo tema…", "Mudar as cores do seu tema", "＋ Novo tema… cria um seu a partir de cinco cores.", "Os seus temas",
 "Fundo", "Atrás de tudo", "Listas e painéis", "As listas, o painel do calendário, as caixas de diálogo", "Texto", "Destaque", "Botões, hoje, seleção", "Itens com estrela", "Lembretes e tarefas importantes",
 "O texto lê-se mal sobre o fundo (contraste {n}:1; a partir de 4,5:1 lê-se bem).", "O destaque vê-se mal nas listas (contraste {n}:1; 3:1 ou mais é melhor).", "Os itens com estrela veem-se mal nas listas (contraste {n}:1; 3:1 ou mais é melhor).",
 "Editar tema", "Novo tema", "Começar a partir de", "p. ex. Floresta", "A janela inteira mostra o tema enquanto escolhe. Cancelar repõe o anterior.",
 "Dê um nome ao tema.", "Já existe um tema com esse nome.", "Tema “{s}” guardado", "Tema “{s}” adicionado", "Eliminar o tema?", "O tema “{s}” será eliminado. A aplicação volta ao tema predefinido."]
L['ca-AD'] = ["Crea un tema propi amb cinc colors", "＋ Tema nou…", "Canvia els colors del vostre tema", "＋ Tema nou… en crea un de propi amb cinc colors.", "Els vostres temes",
 "Fons", "Darrere de tot", "Llistes i plafons", "Les llistes, el plafó del calendari, els diàlegs", "Text", "Accent", "Botons, avui, selecció", "Elements destacats", "Recordatoris i tasques importants",
 "El text es llegeix malament sobre el fons (contrast {n}:1; a partir de 4,5:1 es llegeix bé).", "L'accent es veu malament sobre les llistes (contrast {n}:1; 3:1 o més és millor).", "Els elements destacats es veuen malament sobre les llistes (contrast {n}:1; 3:1 o més és millor).",
 "Edita el tema", "Tema nou", "Parteix de", "p. ex. Bosc", "Tota la finestra mostra el tema mentre trieu. Cancel·la torna a posar l'anterior.",
 "Doneu un nom al tema.", "Ja hi ha un tema amb aquest nom.", "S'ha desat el tema «{s}»", "S'ha afegit el tema «{s}»", "Voleu suprimir el tema?", "Se suprimirà el tema «{s}». L'aplicació torna al tema per defecte."]
L['gl-ES'] = ["Crear un tema propio con cinco cores", "＋ Novo tema…", "Cambiar as cores do seu tema", "＋ Novo tema… crea un propio con cinco cores.", "Os seus temas",
 "Fondo", "Detrás de todo", "Listas e paneis", "As listas, o panel do calendario, os diálogos", "Texto", "Acento", "Botóns, hoxe, selección", "Elementos destacados", "Lembretes e tarefas importantes",
 "O texto lese mal sobre o fondo (contraste {n}:1; a partir de 4,5:1 lese ben).", "O acento vese mal sobre as listas (contraste {n}:1; 3:1 ou máis é mellor).", "Os elementos destacados vense mal sobre as listas (contraste {n}:1; 3:1 ou máis é mellor).",
 "Editar o tema", "Novo tema", "Partir de", "p. ex. Bosque", "Toda a xanela mostra o tema mentres escolle. Cancelar volve poñer o anterior.",
 "Poña un nome ao tema.", "Xa hai un tema con ese nome.", "Gardouse o tema «{s}»", "Engadiuse o tema «{s}»", "Eliminar o tema?", "Eliminarase o tema «{s}». A aplicación volve ao tema predeterminado."]
L['sv-SE'] = ["Skapa ett eget tema av fem färger", "＋ Nytt tema…", "Ändra färgerna i ditt tema", "＋ Nytt tema… skapar ett eget av fem färger.", "Dina teman",
 "Bakgrund", "Bakom allt", "Listor och paneler", "Listorna, kalenderpanelen, dialogrutor", "Text", "Accent", "Knappar, idag, markering", "Stjärnmärkta poster", "Viktiga påminnelser och uppgifter",
 "Texten är svårläst mot bakgrunden (kontrast {n}:1; 4,5:1 eller mer är lättläst).", "Accenten syns dåligt mot listorna (kontrast {n}:1; 3:1 eller mer är bättre).", "Stjärnmärkta poster syns dåligt mot listorna (kontrast {n}:1; 3:1 eller mer är bättre).",
 "Redigera tema", "Nytt tema", "Utgå från", "t.ex. Skog", "Hela fönstret visar temat medan du väljer. Avbryt sätter tillbaka det gamla.",
 "Ge temat ett namn.", "Det finns redan ett tema med det namnet.", "Temat ”{s}” sparat", "Temat ”{s}” tillagt", "Ta bort temat?", "Temat ”{s}” tas bort. Appen går tillbaka till standardtemat."]
L['da'] = ["Lav dit eget tema af fem farver", "＋ Nyt tema…", "Skift farverne i dit tema", "＋ Nyt tema… laver dit eget af fem farver.", "Dine temaer",
 "Baggrund", "Bag det hele", "Lister og paneler", "Listerne, kalenderpanelet, dialogbokse", "Tekst", "Accent", "Knapper, i dag, markering", "Stjernemarkerede punkter", "Vigtige påmindelser og opgaver",
 "Teksten er svær at læse på baggrunden (kontrast {n}:1; 4,5:1 eller mere er let at læse).", "Accenten er svær at se på listerne (kontrast {n}:1; 3:1 eller mere er bedre).", "Stjernemarkerede punkter er svære at se på listerne (kontrast {n}:1; 3:1 eller mere er bedre).",
 "Rediger tema", "Nyt tema", "Tag udgangspunkt i", "f.eks. Skov", "Hele vinduet viser temaet, mens du vælger. Annuller sætter det gamle tilbage.",
 "Giv temaet et navn.", "Der findes allerede et tema med det navn.", "Temaet »{s}« gemt", "Temaet »{s}« tilføjet", "Slet temaet?", "Temaet »{s}« bliver slettet. Appen går tilbage til standardtemaet."]
L['nb-NO'] = ["Lag ditt eget tema av fem farger", "＋ Nytt tema…", "Endre fargene i temaet ditt", "＋ Nytt tema… lager ditt eget av fem farger.", "Dine temaer",
 "Bakgrunn", "Bak alt", "Lister og paneler", "Listene, kalenderpanelet, dialogbokser", "Tekst", "Aksent", "Knapper, i dag, utvalg", "Stjernemerkede punkter", "Viktige påminnelser og oppgaver",
 "Teksten er vanskelig å lese på bakgrunnen (kontrast {n}:1; 4,5:1 eller mer er lett å lese).", "Aksenten er vanskelig å se på listene (kontrast {n}:1; 3:1 eller mer er bedre).", "Stjernemerkede punkter er vanskelige å se på listene (kontrast {n}:1; 3:1 eller mer er bedre).",
 "Rediger tema", "Nytt tema", "Ta utgangspunkt i", "f.eks. Skog", "Hele vinduet viser temaet mens du velger. Avbryt setter det gamle tilbake.",
 "Gi temaet et navn.", "Det finnes allerede et tema med det navnet.", "Temaet «{s}» lagret", "Temaet «{s}» lagt til", "Slette temaet?", "Temaet «{s}» blir slettet. Appen går tilbake til standardtemaet."]
L['fi'] = ["Tee oma teema viidestä väristä", "＋ Uusi teema…", "Muuta teemasi värejä", "＋ Uusi teema… tekee oman teeman viidestä väristä.", "Omat teemat",
 "Tausta", "Kaiken takana", "Listat ja paneelit", "Listat, kalenteripaneeli, valintaikkunat", "Teksti", "Korostus", "Painikkeet, tänään, valinta", "Tähdellä merkityt", "Tärkeät muistutukset ja tehtävät",
 "Tekstiä on vaikea lukea taustalla (kontrasti {n}:1; 4,5:1 tai enemmän on helppolukuinen).", "Korostusväriä on vaikea nähdä listoilla (kontrasti {n}:1; 3:1 tai enemmän on parempi).", "Tähdellä merkittyjä on vaikea nähdä listoilla (kontrasti {n}:1; 3:1 tai enemmän on parempi).",
 "Muokkaa teemaa", "Uusi teema", "Lähtökohta", "esim. Metsä", "Koko ikkuna näyttää teeman valitessasi. Peruuta palauttaa vanhan.",
 "Anna teemalle nimi.", "Samanniminen teema on jo olemassa.", "Teema ”{s}” tallennettu", "Teema ”{s}” lisätty", "Poistetaanko teema?", "Teema ”{s}” poistetaan. Sovellus palaa oletusteemaan."]
L['et-EE'] = ["Loo viiest värvist oma teema", "＋ Uus teema…", "Muuda oma teema värve", "＋ Uus teema… loob viiest värvist oma teema.", "Sinu teemad",
 "Taust", "Kõige taga", "Loendid ja paneelid", "Loendid, kalendripaneel, dialoogid", "Tekst", "Rõhuvärv", "Nupud, täna, valik", "Tärniga kirjed", "Olulised meeldetuletused ja ülesanded",
 "Teksti on taustal raske lugeda (kontrast {n}:1; alates 4,5:1 on hästi loetav).", "Rõhuvärvi on loenditel raske näha (kontrast {n}:1; 3:1 või rohkem on parem).", "Tärniga kirjeid on loenditel raske näha (kontrast {n}:1; 3:1 või rohkem on parem).",
 "Muuda teemat", "Uus teema", "Alusta teemast", "nt Mets", "Kogu aken näitab teemat valimise ajal. Loobu paneb vana tagasi.",
 "Anna teemale nimi.", "Selle nimega teema on juba olemas.", "Teema „{s}“ salvestati", "Teema „{s}“ lisati", "Kas kustutada teema?", "Teema „{s}“ kustutatakse. Rakendus läheb tagasi vaiketeemale."]
L['hu-HU'] = ["Saját téma készítése öt színből", "＋ Új téma…", "A saját téma színeinek módosítása", "＋ Új téma… öt színből készít egy sajátot.", "Saját témák",
 "Háttér", "Minden mögött", "Listák és panelek", "A listák, a naptárpanel, a párbeszédablakok", "Szöveg", "Kiemelőszín", "Gombok, ma, kijelölés", "Csillagos elemek", "Fontos emlékeztetők és teendők",
 "A szöveg nehezen olvasható a háttéren (kontraszt {n}:1; 4,5:1-től jól olvasható).", "A kiemelőszín nehezen látszik a listákon (kontraszt {n}:1; 3:1 vagy több jobb).", "A csillagos elemek nehezen látszanak a listákon (kontraszt {n}:1; 3:1 vagy több jobb).",
 "Téma szerkesztése", "Új téma", "Kiindulás", "pl. Erdő", "Az egész ablak mutatja a témát, amíg választ. A Mégse visszaállítja a régit.",
 "Adjon nevet a témának.", "Már van ilyen nevű téma.", "„{s}” téma mentve", "„{s}” téma hozzáadva", "Törli a témát?", "A(z) „{s}” téma törlődik. Az alkalmazás visszatér az alapértelmezett témához."]
L['ru-RU'] = ["Создать свою тему из пяти цветов", "＋ Новая тема…", "Изменить цвета вашей темы", "＋ Новая тема… создаёт свою тему из пяти цветов.", "Ваши темы",
 "Фон", "Позади всего", "Списки и панели", "Списки, панель календаря, диалоги", "Текст", "Акцент", "Кнопки, сегодня, выделение", "Элементы со звёздочкой", "Важные напоминания и задачи",
 "Текст плохо читается на фоне (контраст {n}:1; от 4,5:1 читается легко).", "Акцент плохо виден на списках (контраст {n}:1; лучше 3:1 и выше).", "Элементы со звёздочкой плохо видны на списках (контраст {n}:1; лучше 3:1 и выше).",
 "Изменить тему", "Новая тема", "На основе", "напр., Лес", "Всё окно показывает тему, пока вы выбираете. «Отмена» возвращает прежнюю.",
 "Дайте теме название.", "Тема с таким названием уже есть.", "Тема «{s}» сохранена", "Тема «{s}» добавлена", "Удалить тему?", "Тема «{s}» будет удалена. Приложение вернётся к теме по умолчанию."]
L['uk-UA'] = ["Створити власну тему з п'яти кольорів", "＋ Нова тема…", "Змінити кольори вашої теми", "＋ Нова тема… створює власну тему з п'яти кольорів.", "Ваші теми",
 "Тло", "Позаду всього", "Списки й панелі", "Списки, панель календаря, діалоги", "Текст", "Акцент", "Кнопки, сьогодні, виділення", "Елементи із зірочкою", "Важливі нагадування й завдання",
 "Текст погано читається на тлі (контраст {n}:1; від 4,5:1 читається легко).", "Акцент погано видно на списках (контраст {n}:1; краще 3:1 і вище).", "Елементи із зірочкою погано видно на списках (контраст {n}:1; краще 3:1 і вище).",
 "Редагувати тему", "Нова тема", "На основі", "напр., Ліс", "Усе вікно показує тему, поки ви вибираєте. «Скасувати» повертає попередню.",
 "Дайте темі назву.", "Тема з такою назвою вже є.", "Тему «{s}» збережено", "Тему «{s}» додано", "Видалити тему?", "Тему «{s}» буде видалено. Програма повернеться до типової теми."]
L['be-BY'] = ["Стварыць сваю тэму з пяці колераў", "＋ Новая тэма…", "Змяніць колеры вашай тэмы", "＋ Новая тэма… стварае сваю тэму з пяці колераў.", "Вашы тэмы",
 "Фон", "Ззаду ўсяго", "Спісы і панэлі", "Спісы, панэль календара, дыялогі", "Тэкст", "Акцэнт", "Кнопкі, сёння, вылучэнне", "Элементы з зорачкай", "Важныя напаміны і задачы",
 "Тэкст дрэнна чытаецца на фоне (кантраст {n}:1; ад 4,5:1 чытаецца лёгка).", "Акцэнт дрэнна відаць на спісах (кантраст {n}:1; лепш 3:1 і вышэй).", "Элементы з зорачкай дрэнна відаць на спісах (кантраст {n}:1; лепш 3:1 і вышэй).",
 "Рэдагаваць тэму", "Новая тэма", "На аснове", "напр., Лес", "Усё акно паказвае тэму, пакуль вы выбіраеце. «Скасаваць» вяртае папярэднюю.",
 "Дайце тэме назву.", "Тэма з такой назвай ужо ёсць.", "Тэма «{s}» захавана", "Тэма «{s}» дададзена", "Выдаліць тэму?", "Тэма «{s}» будзе выдалена. Праграма вернецца да тэмы па змаўчанні."]
L['pl'] = ["Utwórz własny motyw z pięciu kolorów", "＋ Nowy motyw…", "Zmień kolory swojego motywu", "＋ Nowy motyw… tworzy własny z pięciu kolorów.", "Twoje motywy",
 "Tło", "Za wszystkim", "Listy i panele", "Listy, panel kalendarza, okna dialogowe", "Tekst", "Akcent", "Przyciski, dziś, zaznaczenie", "Elementy z gwiazdką", "Ważne przypomnienia i zadania",
 "Tekst jest słabo czytelny na tle (kontrast {n}:1; od 4,5:1 czyta się łatwo).", "Akcent jest słabo widoczny na listach (kontrast {n}:1; lepiej 3:1 lub więcej).", "Elementy z gwiazdką są słabo widoczne na listach (kontrast {n}:1; lepiej 3:1 lub więcej).",
 "Edytuj motyw", "Nowy motyw", "Zacznij od", "np. Las", "Całe okno pokazuje motyw podczas wybierania. Anuluj przywraca poprzedni.",
 "Nadaj motywowi nazwę.", "Motyw o tej nazwie już istnieje.", "Zapisano motyw „{s}”", "Dodano motyw „{s}”", "Usunąć motyw?", "Motyw „{s}” zostanie usunięty. Aplikacja wróci do motywu domyślnego."]
L['cs-CZ'] = ["Vytvořit vlastní motiv z pěti barev", "＋ Nový motiv…", "Změnit barvy vašeho motivu", "＋ Nový motiv… vytvoří vlastní z pěti barev.", "Vaše motivy",
 "Pozadí", "Za vším", "Seznamy a panely", "Seznamy, panel kalendáře, dialogy", "Text", "Zvýraznění", "Tlačítka, dnes, výběr", "Položky s hvězdičkou", "Důležité připomínky a úkoly",
 "Text se na pozadí špatně čte (kontrast {n}:1; od 4,5:1 se čte dobře).", "Zvýraznění je na seznamech špatně vidět (kontrast {n}:1; lepší je 3:1 a víc).", "Položky s hvězdičkou jsou na seznamech špatně vidět (kontrast {n}:1; lepší je 3:1 a víc).",
 "Upravit motiv", "Nový motiv", "Vycházet z", "např. Les", "Celé okno ukazuje motiv, zatímco vybíráte. Zrušit vrátí ten předchozí.",
 "Zadejte název motivu.", "Motiv s tímto názvem už existuje.", "Motiv „{s}“ uložen", "Motiv „{s}“ přidán", "Smazat motiv?", "Motiv „{s}“ bude smazán. Aplikace se vrátí k výchozímu motivu."]
L['sk-SK'] = ["Vytvoriť vlastný motív z piatich farieb", "＋ Nový motív…", "Zmeniť farby vášho motívu", "＋ Nový motív… vytvorí vlastný z piatich farieb.", "Vaše motívy",
 "Pozadie", "Za všetkým", "Zoznamy a panely", "Zoznamy, panel kalendára, dialógy", "Text", "Zvýraznenie", "Tlačidlá, dnes, výber", "Položky s hviezdičkou", "Dôležité pripomienky a úlohy",
 "Text sa na pozadí zle číta (kontrast {n}:1; od 4,5:1 sa číta dobre).", "Zvýraznenie je na zoznamoch zle vidieť (kontrast {n}:1; lepšie je 3:1 a viac).", "Položky s hviezdičkou je na zoznamoch zle vidieť (kontrast {n}:1; lepšie je 3:1 a viac).",
 "Upraviť motív", "Nový motív", "Vychádzať z", "napr. Les", "Celé okno ukazuje motív, kým vyberáte. Zrušiť vráti predchádzajúci.",
 "Zadajte názov motívu.", "Motív s týmto názvom už existuje.", "Motív „{s}“ uložený", "Motív „{s}“ pridaný", "Odstrániť motív?", "Motív „{s}“ bude odstránený. Aplikácia sa vráti k predvolenému motívu."]
L['ro-RO'] = ["Creați o temă proprie din cinci culori", "＋ Temă nouă…", "Schimbați culorile temei dvs.", "＋ Temă nouă… creează una proprie din cinci culori.", "Temele dvs.",
 "Fundal", "În spatele tuturor", "Liste și panouri", "Listele, panoul calendarului, dialogurile", "Text", "Accent", "Butoane, azi, selecție", "Elemente cu stea", "Mementouri și sarcini importante",
 "Textul se citește greu pe fundal (contrast {n}:1; de la 4,5:1 se citește ușor).", "Accentul se vede greu pe liste (contrast {n}:1; 3:1 sau mai mult e mai bine).", "Elementele cu stea se văd greu pe liste (contrast {n}:1; 3:1 sau mai mult e mai bine).",
 "Editează tema", "Temă nouă", "Pornind de la", "de ex. Pădure", "Toată fereastra arată tema cât alegeți. Anulează pune la loc tema veche.",
 "Dați un nume temei.", "Există deja o temă cu acest nume.", "Tema „{s}” a fost salvată", "Tema „{s}” a fost adăugată", "Ștergeți tema?", "Tema „{s}” va fi ștearsă. Aplicația revine la tema implicită."]
L['tr'] = ["Beş renkten kendi temanızı oluşturun", "＋ Yeni tema…", "Temanızın renklerini değiştirin", "＋ Yeni tema… beş renkten kendi temanızı oluşturur.", "Temalarınız",
 "Arka plan", "Her şeyin arkasında", "Listeler ve paneller", "Listeler, takvim paneli, iletişim kutuları", "Metin", "Vurgu", "Düğmeler, bugün, seçim", "Yıldızlı öğeler", "Önemli hatırlatıcılar ve yapılacaklar",
 "Metin arka planda zor okunuyor (karşıtlık {n}:1; 4,5:1 ve üzeri kolay okunur).", "Vurgu listelerde zor görünüyor (karşıtlık {n}:1; 3:1 veya üzeri daha iyi).", "Yıldızlı öğeler listelerde zor görünüyor (karşıtlık {n}:1; 3:1 veya üzeri daha iyi).",
 "Temayı düzenle", "Yeni tema", "Başlangıç", "örn. Orman", "Siz seçerken tüm pencere temayı gösterir. İptal eskisini geri getirir.",
 "Lütfen temaya bir ad verin.", "Bu adda bir tema zaten var.", "“{s}” teması kaydedildi", "“{s}” teması eklendi", "Tema silinsin mi?", "“{s}” teması silinecek. Uygulama varsayılan temaya döner."]
L['vi'] = ["Tạo chủ đề riêng từ năm màu", "＋ Chủ đề mới…", "Đổi màu của chủ đề của bạn", "＋ Chủ đề mới… tạo một chủ đề riêng từ năm màu.", "Chủ đề của bạn",
 "Nền", "Phía sau mọi thứ", "Danh sách và bảng", "Các danh sách, bảng lịch, hộp thoại", "Chữ", "Màu nhấn", "Nút, hôm nay, vùng chọn", "Mục gắn sao", "Lời nhắc và việc cần làm quan trọng",
 "Chữ khó đọc trên nền (độ tương phản {n}:1; từ 4,5:1 trở lên dễ đọc).", "Màu nhấn khó thấy trên danh sách (độ tương phản {n}:1; từ 3:1 trở lên tốt hơn).", "Mục gắn sao khó thấy trên danh sách (độ tương phản {n}:1; từ 3:1 trở lên tốt hơn).",
 "Sửa chủ đề", "Chủ đề mới", "Bắt đầu từ", "ví dụ: Rừng", "Cả cửa sổ hiện chủ đề trong khi bạn chọn. Hủy sẽ trả lại chủ đề cũ.",
 "Hãy đặt tên cho chủ đề.", "Đã có chủ đề với tên đó.", "Đã lưu chủ đề “{s}”", "Đã thêm chủ đề “{s}”", "Xóa chủ đề?", "Chủ đề “{s}” sẽ bị xóa. Ứng dụng trở về chủ đề mặc định."]
L['zh-CN'] = ["用五种颜色制作自己的主题", "＋ 新建主题…", "更改你的主题的颜色", "＋ 新建主题… 用五种颜色制作你自己的主题。", "你的主题",
 "背景", "在所有内容后面", "列表和面板", "列表、日历面板、对话框", "文字", "强调色", "按钮、今天、所选内容", "加星标的项目", "重要的提醒和待办事项",
 "文字在背景上不易阅读（对比度 {n}:1；4.5:1 或以上易于阅读）。", "强调色在列表上不易看清（对比度 {n}:1；3:1 或以上更好）。", "加星标的项目在列表上不易看清（对比度 {n}:1；3:1 或以上更好）。",
 "编辑主题", "新建主题", "基于", "例如：森林", "选择时整个窗口会显示该主题。点“取消”会恢复原来的主题。",
 "请为主题命名。", "已有同名的主题。", "已保存主题“{s}”", "已添加主题“{s}”", "删除主题？", "将删除主题“{s}”。应用会回到默认主题。"]
L['zh-TW'] = ["用五種顏色製作自己的主題", "＋ 新增主題…", "變更你的主題的顏色", "＋ 新增主題… 用五種顏色製作你自己的主題。", "你的主題",
 "背景", "在所有內容後面", "清單和面板", "清單、日曆面板、對話方塊", "文字", "強調色", "按鈕、今天、所選內容", "加星號的項目", "重要的提醒和待辦事項",
 "文字在背景上不易閱讀（對比度 {n}:1；4.5:1 以上易於閱讀）。", "強調色在清單上不易看清（對比度 {n}:1；3:1 以上較好）。", "加星號的項目在清單上不易看清（對比度 {n}:1；3:1 以上較好）。",
 "編輯主題", "新增主題", "基於", "例如：森林", "選擇時整個視窗會顯示該主題。按「取消」會恢復原來的主題。",
 "請為主題命名。", "已有同名的主題。", "已儲存主題「{s}」", "已新增主題「{s}」", "刪除主題？", "將刪除主題「{s}」。應用程式會回到預設主題。"]
L['ja-JP'] = ["5 つの色から自分のテーマを作る", "＋ 新しいテーマ…", "自分のテーマの色を変える", "＋ 新しいテーマ… で 5 つの色から自分のテーマを作れます。", "自分のテーマ",
 "背景", "すべての後ろ", "リストとパネル", "リスト、カレンダーパネル、ダイアログ", "文字", "アクセント", "ボタン、今日、選択", "スター付きの項目", "重要なリマインダーと ToDo",
 "文字が背景の上で読みにくくなっています (コントラスト {n}:1。4.5:1 以上なら読みやすくなります)。", "アクセントがリストの上で見えにくくなっています (コントラスト {n}:1。3:1 以上がおすすめです)。", "スター付きの項目がリストの上で見えにくくなっています (コントラスト {n}:1。3:1 以上がおすすめです)。",
 "テーマを編集", "新しいテーマ", "元にするテーマ", "例: 森", "選んでいる間、ウィンドウ全体がそのテーマになります。キャンセルすると元に戻ります。",
 "テーマに名前を付けてください。", "同じ名前のテーマがすでにあります。", "テーマ「{s}」を保存しました", "テーマ「{s}」を追加しました", "テーマを削除しますか?", "テーマ「{s}」を削除します。既定のテーマに戻ります。"]
L['ko-KR'] = ["다섯 가지 색으로 나만의 테마 만들기", "＋ 새 테마…", "내 테마의 색 바꾸기", "＋ 새 테마…로 다섯 가지 색에서 나만의 테마를 만들 수 있습니다.", "내 테마",
 "배경", "모든 것의 뒤", "목록과 패널", "목록, 달력 패널, 대화 상자", "글자", "강조색", "버튼, 오늘, 선택", "별표 항목", "중요한 미리 알림과 할 일",
 "배경 위의 글자를 읽기 어렵습니다 (대비 {n}:1, 4.5:1 이상이면 읽기 쉽습니다).", "목록 위에서 강조색이 잘 보이지 않습니다 (대비 {n}:1, 3:1 이상이 좋습니다).", "목록 위에서 별표 항목이 잘 보이지 않습니다 (대비 {n}:1, 3:1 이상이 좋습니다).",
 "테마 편집", "새 테마", "시작할 테마", "예: 숲", "고르는 동안 창 전체에 테마가 적용됩니다. 취소하면 이전 테마로 돌아갑니다.",
 "테마의 이름을 입력하세요.", "같은 이름의 테마가 이미 있습니다.", "테마 “{s}”을(를) 저장했습니다", "테마 “{s}”을(를) 추가했습니다", "테마를 삭제할까요?", "테마 “{s}”이(가) 삭제됩니다. 앱은 기본 테마로 돌아갑니다."]
L['ar'] = ["أنشئ سمتك الخاصة من خمسة ألوان", "＋ سمة جديدة…", "غيّر ألوان سمتك", "＋ سمة جديدة… تنشئ سمة خاصة بك من خمسة ألوان.", "سماتك",
 "الخلفية", "خلف كل شيء", "القوائم واللوحات", "القوائم ولوحة التقويم ومربعات الحوار", "النص", "لون التمييز", "الأزرار واليوم والتحديد", "العناصر المميّزة بنجمة", "التذكيرات والمهام المهمّة",
 "يصعب قراءة النص على الخلفية (التباين {n}:1؛ ويسهل القراءة من 4.5:1 فأكثر).", "يصعب رؤية لون التمييز على القوائم (التباين {n}:1؛ والأفضل 3:1 فأكثر).", "يصعب رؤية العناصر المميّزة بنجمة على القوائم (التباين {n}:1؛ والأفضل 3:1 فأكثر).",
 "تحرير السمة", "سمة جديدة", "البدء من", "مثلًا: غابة", "تعرض النافذة كلها السمة أثناء اختيارك. يعيد «إلغاء» السمة السابقة.",
 "يُرجى إعطاء السمة اسمًا.", "توجد سمة بهذا الاسم بالفعل.", "تم حفظ السمة «{s}»", "تمت إضافة السمة «{s}»", "حذف السمة؟", "ستُحذف السمة «{s}». يعود التطبيق إلى السمة الافتراضية."]
L['he-IL'] = ["יצירת ערכת נושא משלך מחמישה צבעים", "＋ ערכת נושא חדשה…", "שינוי הצבעים של ערכת הנושא שלך", "＋ ערכת נושא חדשה… יוצרת ערכה משלך מחמישה צבעים.", "ערכות הנושא שלך",
 "רקע", "מאחורי הכול", "רשימות וחלוניות", "הרשימות, חלונית לוח השנה, תיבות הדו־שיח", "טקסט", "צבע הדגשה", "כפתורים, היום, בחירה", "פריטים מסומנים בכוכב", "תזכורות ומשימות חשובות",
 "קשה לקרוא את הטקסט על הרקע (ניגודיות {n}:1; מ־4.5:1 ומעלה קל לקרוא).", "קשה לראות את צבע ההדגשה על הרשימות (ניגודיות {n}:1; 3:1 ומעלה עדיף).", "קשה לראות את הפריטים המסומנים בכוכב על הרשימות (ניגודיות {n}:1; 3:1 ומעלה עדיף).",
 "עריכת ערכת נושא", "ערכת נושא חדשה", "התחלה מ־", "למשל: יער", "כל החלון מציג את ערכת הנושא בזמן הבחירה. ביטול מחזיר את הקודמת.",
 "נא לתת שם לערכת הנושא.", "כבר יש ערכת נושא בשם הזה.", "ערכת הנושא „{s}” נשמרה", "ערכת הנושא „{s}” נוספה", "למחוק את ערכת הנושא?", "ערכת הנושא „{s}” תימחק. היישום יחזור לערכת הנושא ברירת המחדל."]
L['mn-MN'] = ["Таван өнгөөр өөрийн загвар үүсгэх", "＋ Шинэ загвар…", "Өөрийн загварын өнгийг өөрчлөх", "＋ Шинэ загвар… таван өнгөөр өөрийн загвар үүсгэнэ.", "Таны загварууд",
 "Дэвсгэр", "Бүх зүйлийн ард", "Жагсаалт ба самбарууд", "Жагсаалтууд, хуанлийн самбар, харилцах цонхнууд", "Бичвэр", "Тодруулах өнгө", "Товчнууд, өнөөдөр, сонголт", "Одтой зүйлс", "Чухал сануулга, хийх зүйлс",
 "Бичвэр дэвсгэр дээр уншихад хэцүү байна (ялгарал {n}:1; 4.5:1-ээс дээш бол уншихад амар).", "Тодруулах өнгө жагсаалт дээр харагдахад хэцүү байна (ялгарал {n}:1; 3:1-ээс дээш бол дээр).", "Одтой зүйлс жагсаалт дээр харагдахад хэцүү байна (ялгарал {n}:1; 3:1-ээс дээш бол дээр).",
 "Загвар засах", "Шинэ загвар", "Эхлэх загвар", "жишээ нь Ой", "Сонгож байх үед бүх цонх тухайн загварыг харуулна. Цуцлах нь хуучныг сэргээнэ.",
 "Загварт нэр өгнө үү.", "Ийм нэртэй загвар аль хэдийн байна.", "“{s}” загвар хадгалагдлаа", "“{s}” загвар нэмэгдлээ", "Загварыг устгах уу?", "“{s}” загвар устгагдана. Програм үндсэн загвар руу буцна."]
L['ga-IE'] = ["Déan do théama féin as cúig dhath", "＋ Téama nua…", "Athraigh dathanna do théama", "＋ Téama nua… déanann sé téama duit as cúig dhath.", "Do théamaí",
 "Cúlra", "Taobh thiar de gach rud", "Liostaí agus painéil", "Na liostaí, painéal an fhéilire, na dialóga", "Téacs", "Dath béime", "Cnaipí, inniu, roghnú", "Míreanna le réalta", "Meabhrúcháin agus tascanna tábhachtacha",
 "Is deacair an téacs a léamh ar an gcúlra (codarsnacht {n}:1; is furasta é a léamh ó 4.5:1 suas).", "Is deacair an dath béime a fheiceáil ar na liostaí (codarsnacht {n}:1; is fearr 3:1 nó níos mó).", "Is deacair na míreanna le réalta a fheiceáil ar na liostaí (codarsnacht {n}:1; is fearr 3:1 nó níos mó).",
 "Cuir an téama in eagar", "Téama nua", "Tosaigh ó", "m.sh. Foraois", "Taispeánann an fhuinneog ar fad an téama agus tú ag roghnú. Cuireann Cealaigh an seancheann ar ais.",
 "Tabhair ainm don téama, le do thoil.", "Tá téama leis an ainm sin ann cheana.", "Sábháladh an téama “{s}”", "Cuireadh an téama “{s}” leis", "Scrios an téama?", "Scriosfar an téama “{s}”. Fillfidh an aip ar an téama réamhshocraithe."]
L['fy-NL'] = ["In eigen tema meitsje fan fiif kleuren", "＋ Nij tema…", "De kleuren fan jo tema wizigje", "＋ Nij tema… makket der ien fan fiif kleuren.", "Jo tema's",
 "Eftergrûn", "Efter alles", "Listen en panielen", "De listen, it kalinderpaniel, dialoochfinsters", "Tekst", "Aksint", "Knoppen, hjoed, seleksje", "Items mei stjer", "Wichtige oantinkers en taken",
 "De tekst is min te lêzen op de eftergrûn (kontrast {n}:1; fan 4,5:1 ôf goed te lêzen).", "It aksint is min te sjen op de listen (kontrast {n}:1; 3:1 of mear is better).", "Items mei stjer binne min te sjen op de listen (kontrast {n}:1; 3:1 of mear is better).",
 "Tema bewurkje", "Nij tema", "Útgean fan", "bgl. Bosk", "It hiele finster lit it tema sjen wylst jo kieze. Annulearje set it âlde werom.",
 "Jou it tema in namme.", "Der is al in tema mei dy namme.", "Tema ‘{s}’ bewarre", "Tema ‘{s}’ tafoege", "Tema fuortsmite?", "It tema ‘{s}’ wurdt fuortsmiten. De app giet werom nei it standerttema."]

def main():
    cat = os.path.join(DIR, 'catalog.txt')
    lines = [l for l in open(cat, encoding='utf8').read().split('\n') if l.strip() and not l.startswith('#')]
    if EN[0] in lines: print('already added'); return
    start = len(lines) + 1
    with open(cat, 'a', encoding='utf8') as f:
        f.write('# 0.8.1: your own themes\n')
        for s in EN: f.write(s + '\n')
    for code, tr in L.items():
        assert len(tr) == len(EN), (code, len(tr))
        p = os.path.join(DIR, f'{code}.txt')
        txt = open(p, encoding='utf8').read()
        if not txt.endswith('\n'): txt += '\n'
        txt += ''.join(f'{start + i}| {t}\n' for i, t in enumerate(tr))
        open(p, 'w', encoding='utf8').write(txt)
    have = sorted(f[:-4] for f in os.listdir(DIR) if f.endswith('.txt') and f != 'catalog.txt')
    print('added', len(EN), 'from', start, 'to', len(L), 'languages; missing:', [c for c in have if c not in L])

main()
