// E2E (0.3.0, lists 0.5.0): views, the Lists tab and its dropdown, move to list, my order, categories, go to date, side panel, formats.
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
const titles = () => [...document.querySelectorAll('#listView tbody tr .t')].map((t) => t.textContent);
const rowOf = (title) => [...document.querySelectorAll('#listView tbody tr')].find((tr) => tr.querySelector('.t') && tr.querySelector('.t').textContent === title);
const ctxOn = async (tr) => { const r = tr.getBoundingClientRect(); tr.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: r.left + 300, clientY: r.top + 10 })); await sleep(300); };
const tab = (t) => document.querySelector(`.tab[data-tab="${t}"]`);
const X = window.__rfx; const R = window.__rf;
try {
  // ---------- views
  X.openViews(); await sleep(300);
  check('views dialog empty', $('vwList').textContent.includes('No saved filters yet'), true);
  $('vwNew').click(); await sleep(300);
  $('veName').value = 'Birthdays';
  const crit = document.querySelector('#veCrit [data-k]');
  crit.querySelector('[data-v]').value = 'Birthday, Anniversary';
  crit.querySelector('[data-v]').dispatchEvent(new Event('input', { bubbles: true })); await sleep(100);
  check('view description', $('vePreview').textContent, 'Category is “Birthday” or “Anniversary”');
  $('veSave').click(); await sleep(900);
  check('view saved', JSON.stringify((await window.rf.meta()).settings.views.map((v) => v.name)), '["Birthdays"]');
  check('view is shown', R.S.filter, 'view:0');
  check('view rows', titles().join('|'), "Sarah's birthday");
  check('view hint', $('remHint').textContent, 'Saved filter “Birthdays” · 1 reminder');
  check('filter list has the view', [...$('remFilter').options].map((o) => o.textContent).includes('Birthdays'), true);
  $('viewsDlg').close();
  // a second view: words in the description within dates (any field, next 14 days)
  X.openViews(); await sleep(200); $('vwNew').click(); await sleep(300);
  $('veName').value = 'Soon: Thanksgiving';
  const c2 = document.querySelector('#veCrit [data-k]');
  c2.querySelector('[data-f]').value = 'any'; c2.querySelector('[data-f]').dispatchEvent(new Event('change', { bubbles: true })); await sleep(100);
  document.querySelector('#veCrit [data-k] [data-v]').value = 'thanksgiving';
  $('veDated').checked = true; $('veFromN').value = '0'; $('veFromU').value = 'D'; $('veToN').value = '14'; $('veToU').value = 'D';
  $('veSave').click(); await sleep(900);
  check('dated view picks only the coming one', titles().join('|'), "Thanksgiving dinner at Mom's");
  // delete the first view: the shown one keeps its place in the list
  $('vwList').querySelector('[data-i="0"] [data-a=del]').click(); await sleep(300);
  $('cfFoot').querySelector('.btn.danger').click(); await sleep(900);
  check('after deleting the other view', R.S.filter, 'view:0');
  check('still the same view', $('remHint').textContent.startsWith('Saved filter “Soon: Thanksgiving”'), true);
  $('viewsDlg').close();
  // ---------- lists: one Lists tab, picked in a dropdown that includes To-Do's
  const opts = () => [...$('todoList').options].map((o) => o.textContent);
  check('no list tabs any more', !!document.querySelector('.tab[data-tab^="list:"]'), false);
  check('the List dropdown is the Lists tab', $('todoList').closest('.tab') === tab('todos'), true);
  await R.setTab('todos'); await sleep(500);
  check('dropdown lists', opts().join('|'), "List: To-Do's (3)|Errands (2)|All lists (5)|──────────|＋ New list…|Manage lists…");
  check('both top-bar buttons look the same', $('addTodo').className === $('addReminder').className && getComputedStyle($('addTodo')).backgroundColor === getComputedStyle($('addReminder')).backgroundColor, true);
  check('dropdown has its own background', getComputedStyle($('todoList')).backgroundColor !== getComputedStyle(document.querySelector('.tabs')).backgroundColor, true);
  check('starts on To-Do\'s', $('todoList').value, "To-Do's");
  check("To-Do's shows only its list", titles().includes('Buy milk and eggs'), false);
  await R.showList('Errands'); await sleep(600);
  check('Errands rows', titles().sort().join('|'), 'Buy milk and eggs|Return library books');
  check('the prefix follows the chosen list', opts().filter((o) => o.startsWith('List: ')).join('|'), 'List: Errands (2)');
  check('to-do toolbar shown', $('tbTodos').classList.contains('hidden'), false);
  await R.openEditor({ kind: 'todo' }); await sleep(300);
  check('new to-do goes on this list', $('edList').value, 'Errands');
  $('editor').close();
  $('todoList').value = ''; $('todoList').dispatchEvent(new Event('change')); await sleep(600);
  check('All lists', titles().length, 6);
  check('All lists shows the list name', !!rowOf('Buy milk and eggs').textContent.includes('Errands'), true);
  await R.showList("To-Do's"); await sleep(500);
  // move to list (context menu)
  await ctxOn(rowOf('Back up photos'));
  document.querySelector('#ctx button[data-ctx=list]').click(); await sleep(300);
  $('mlSel').value = '__new'; $('mlSel').dispatchEvent(new Event('change')); $('mlNew').value = 'Home jobs';
  $('mlGo').click(); await sleep(1000);
  check('moved out of this list', !!rowOf('Back up photos'), false);
  check('new list in the dropdown', opts().includes('Home jobs (1)'), true);
  check('moved item list', (await window.rf.all()).find((d) => d.summary === 'Back up photos').list, 'Home jobs');
  // a reminder becomes a to-do
  await R.setTab('reminders'); await sleep(300);
  $('remFilter').value = 'all'; $('remFilter').dispatchEvent(new Event('change')); await sleep(500);
  await ctxOn(rowOf('Car service'));
  check('reminder menu offers to-do', document.querySelector('#ctx button[data-ctx=list]').textContent, 'Make it a to-do…');
  document.querySelector('#ctx button[data-ctx=list]').click(); await sleep(300);
  $('mlSel').value = 'Errands'; $('mlGo').click(); await sleep(900);
  const car = (await window.rf.all()).find((d) => d.summary === 'Car service');
  check('now a to-do', `${car.kind} ${car.list} ${car.date}`, `todo Errands ${car.date}`);
  // lists manager: rename and remove
  X.openLists(); await sleep(300);
  check('lists in the manager', [...$('lsList').querySelectorAll('b')].map((b) => b.textContent).join('|'), "To-Do's|Errands|Home jobs");
  $('lsList').querySelector('[data-l="Home jobs"] [data-a=ren]').click(); await sleep(300);
  $('atVal').value = 'House'; $('atOk').click(); await sleep(1000);
  check('renamed list', (await window.rf.all()).find((d) => d.summary === 'Back up photos').list, 'House');
  check('renamed in the dropdown', opts().includes('House (1)') && !opts().some((o) => o.startsWith('Home jobs')), true);
  $('lsList').querySelector('[data-l="House"] [data-a=up]').click(); await sleep(900);
  check('list order', (await window.rf.meta()).todoLists.join('|'), "To-Do's|House|Errands");
  $('lsList').querySelector('[data-l="House"] [data-a=del]').click(); await sleep(300);
  check('remove asks move or delete', [...$('cfFoot').querySelectorAll('.btn')].map((b) => b.textContent).join('|'), 'Cancel|Move to “To-Do\'s”|Delete list and to-dos');
  [...$('cfFoot').querySelectorAll('.btn')][1].click(); await sleep(1000);
  check('removed list items go to the main list', (await window.rf.all()).find((d) => d.summary === 'Back up photos').list, "To-Do's");
  $('lsNew').value = 'Garden'; $('lsAdd').click(); await sleep(900);
  check('empty list added', (await window.rf.meta()).todoLists.includes('Garden'), true);
  $('listsDlg').close();
  // ---------- my order
  await R.setTab('todos'); await sleep(500);
  const before = titles();
  $('todoSort').value = 'manual'; $('todoSort').dispatchEvent(new Event('change')); await sleep(700);
  check('rows draggable in my order', document.querySelectorAll('#listView tr.drag').length > 2, true);
  rowOf(before[0]).click(); await sleep(200);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true })); await sleep(900);
  const after = titles();
  check('Alt+Down moves it down', `${after[0]}|${after[1]}`, `${before[1]}|${before[0]}`);
  check('order saved', (await window.rf.all()).find((d) => d.summary === before[0]).order, 2);
  check('selection follows', document.querySelector('#listView tr.selected .t').textContent, before[0]);
  await R.reorder((await window.rf.all()).find((d) => d.summary === after[2]).uid, (await window.rf.all()).find((d) => d.summary === after[0]).uid, false); await sleep(900);
  check('drop before the first', titles()[0], after[2]);
  // ---------- categories
  X.openCategories(); await sleep(300);
  $('ctList').querySelector('[data-c="Home"] [data-a=ren]').click(); await sleep(300);
  $('atVal').value = 'House'; $('atOk').click(); await sleep(1000);
  check('category renamed', (await window.rf.all()).find((d) => d.summary === 'Recycling & green bin').categories.join(','), 'House');
  $('ctList').querySelector('[data-c="Car"] [data-a=del]').click(); await sleep(300);
  $('cfFoot').querySelector('.btn.danger').click(); await sleep(1000);
  check('category deleted from the item', (await window.rf.all()).find((d) => d.summary === 'Car service').categories.length, 0);
  check('category gone', (await window.rf.meta()).categories.includes('Car'), false);
  $('ctCommon').click(); await sleep(900);
  check('common categories added', (await window.rf.meta()).categories.includes('Appointment'), true);
  $('catsDlg').close();
  // the editor's category picker
  await R.openEditor({ uid: (await window.rf.all()).find((d) => d.summary === 'Dentist — Dr. Patel').uid }); await sleep(300);
  $('edCatPick').click(); await sleep(300);
  document.querySelector('#cpList input[value="Appointment"]').checked = true;
  $('cpOk').click(); await sleep(300);
  check('picked categories', $('edCats').value, 'Health, Appointment');
  check('map link', R.mapUrl('Yonge & Eglinton'), 'https://www.google.com/maps/search/?api=1&query=Yonge%20%26%20Eglinton');
  $('editor').close();
  // ---------- go to date
  X.openGoTo(); await sleep(300);
  $('gtDate').value = '2026-12-25'; $('gtGo').click(); await sleep(900);
  check('go to date', `${R.S.tab} ${R.S.filter} ${R.S.selDay}`, 'reminders day 2026-12-25');
  check('calendar moved', document.querySelector('#mcal .ttl').textContent, RF.fmt.month(RF.parseKey('2026-12-25')));
  // ---------- calendar panel
  await R.setSetting({ miniMonths: 2 }); await R.renderSide(); await sleep(300);
  check('two months', document.querySelectorAll('#mcal .mcal-month').length, 2);
  $('sideToggle').click(); await sleep(400);
  check('panel hidden', getComputedStyle(document.querySelector('aside.side')).display, 'none');
  check('saved', (await window.rf.meta()).settings.sidePanel, false);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true })); await sleep(400);
  check('Ctrl+B shows it again', document.body.classList.contains('no-side'), false);
  // overdue mark: "Renew passport" (2 days ago) is still open
  await window.__rf.selectDay(R.S.today); await sleep(300);
  const pass = (await window.rf.all()).find((d) => d.summary === 'Renew passport');
  check('overdue day marked', document.querySelector(`#mcal .mday[data-day="${pass.date}"]`).classList.contains('overdue'), true);
  // ---------- date and time formats
  await R.setSetting({ dateFormat: 'iso', timeFormat: '24' }); await R.refresh(); await sleep(400);
  $('remFilter').value = 'all'; $('remFilter').dispatchEvent(new Event('change')); await sleep(500);
  const dent = rowOf('Dentist — Dr. Patel');
  check('ISO date', /^\d{4}-\d\d-\d\d$/.test(dent.querySelector('.c-date').textContent), true);
  check('24-hour time', dent.querySelector('.c-time').textContent, '14:30');
} catch (e) { console.log(`E2E ERROR ${e && e.stack}`); }
