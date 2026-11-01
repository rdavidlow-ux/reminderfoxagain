#!/usr/bin/env python3
# The editor's title for a list item: "New list item" / "Edit list item" (it said "New to-do"). Run once, then
# node tools/i18n/build.js
import os
DIR = os.path.dirname(os.path.abspath(__file__))
EN = ["New list item", "Edit list item"]
L = {
 'de': ["Neuer Listeneintrag", "Listeneintrag bearbeiten"], 'fr': ["Nouvel élément de liste", "Modifier l'élément de liste"],
 'es-ES': ["Nuevo elemento de lista", "Editar elemento de lista"], 'it': ["Nuovo elemento di elenco", "Modifica elemento di elenco"],
 'nl': ["Nieuw lijstitem", "Lijstitem bewerken"], 'pt-BR': ["Novo item de lista", "Editar item de lista"],
 'pt-PT': ["Novo item de lista", "Editar item de lista"], 'ca-AD': ["Element de llista nou", "Edita l'element de llista"],
 'gl-ES': ["Novo elemento de lista", "Editar elemento de lista"], 'da': ["Nyt listeelement", "Rediger listeelement"],
 'nb-NO': ["Nytt listeelement", "Rediger listeelement"], 'sv-SE': ["Nytt listobjekt", "Redigera listobjekt"],
 'fi': ["Uusi luettelon kohde", "Muokkaa luettelon kohdetta"], 'et-EE': ["Uus loendi kirje", "Muuda loendi kirjet"],
 'fy-NL': ["Nij listitem", "Listitem bewurkje"], 'ga-IE': ["Mír liosta nua", "Cuir mír liosta in eagar"],
 'cs-CZ': ["Nová položka seznamu", "Upravit položku seznamu"], 'sk-SK': ["Nová položka zoznamu", "Upraviť položku zoznamu"],
 'pl': ["Nowy element listy", "Edytuj element listy"], 'hu-HU': ["Új listaelem", "Listaelem szerkesztése"],
 'ro-RO': ["Element de listă nou", "Editează elementul de listă"], 'ru-RU': ["Новый элемент списка", "Изменить элемент списка"],
 'uk-UA': ["Новий елемент списку", "Змінити елемент списку"], 'be-BY': ["Новы элемент спіса", "Змяніць элемент спіса"],
 'tr': ["Yeni liste öğesi", "Liste öğesini düzenle"], 'ar': ["عنصر قائمة جديد", "تعديل عنصر القائمة"],
 'he-IL': ["פריט חדש ברשימה", "עריכת פריט ברשימה"], 'ja-JP': ["新しいリスト項目", "リスト項目を編集"],
 'ko-KR': ["새 목록 항목", "목록 항목 편집"], 'zh-CN': ["新建列表项", "编辑列表项"], 'zh-TW': ["新增清單項目", "編輯清單項目"],
 'vi': ["Mục danh sách mới", "Sửa mục danh sách"], 'mn-MN': ["Шинэ жагсаалтын зүйл", "Жагсаалтын зүйлийг засах"],
}
def main():
    cat = os.path.join(DIR, 'catalog.txt')
    lines = [l for l in open(cat, encoding='utf8').read().split('\n') if l.strip() and not l.startswith('#')]
    if EN[0] in lines: print('already added'); return
    start = len(lines) + 1
    have = sorted(f[:-4] for f in os.listdir(DIR) if f.endswith('.txt') and f != 'catalog.txt')
    assert not [c for c in have if c not in L]
    with open(cat, 'a', encoding='utf8') as f:
        f.write('# the editor title for a list item\n')
        for s in EN: f.write(s + '\n')
    for code, tr in L.items():
        p = os.path.join(DIR, f'{code}.txt')
        txt = open(p, encoding='utf8').read()
        if not txt.endswith('\n'): txt += '\n'
        txt += ''.join(f'{start + i}| {t}\n' for i, t in enumerate(tr))
        open(p, 'w', encoding='utf8').write(txt)
    print('added', len(EN), 'from', start)
main()
