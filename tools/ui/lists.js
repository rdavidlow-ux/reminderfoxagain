// E2E (0.5.0): items in a list — add, duplicate (menu, Ctrl+D, toolbar), copy and move between lists, delete,
// a new list from the dropdown, removing a list with its to-dos, and importing the add-on's lists from its profile.
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
const titles = () => [...document.querySelectorAll('#listView tbody tr .t')].map((t) => t.textContent);
const rowOf = (title) => [...document.querySelectorAll('#listView tbody tr')].find((tr) => tr.querySelector('.t') && tr.querySelector('.t').textContent === title);
const ctxOn = async (tr) => { const r = tr.getBoundingClientRect(); tr.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: r.left + 300, clientY: r.top + 10 })); await sleep(300); };
const act = (a) => $('todoActs').querySelector(`[data-ta=${a}]`);
const R = window.__rf;
const all = async () => (await window.rf.all());
const byTitle = async (t) => (await all()).filter((d) => d.summary === t);
try {
  await sleep(600);
  // ---------- import the add-on's lists, with the items, from a profile folder (prefs.js beside reminderfox/)
  const dataDir = (await window.rf.meta()).dataFile.replace(/[\\/][^\\/]+$/, '');
  const res = await window.rf.importPath(`${dataDir}/addon-profile/reminderfox/reminderfox.ics`);
  check('import counts', `${res.added} added`, '9 added');
  check('lists from the add-on profile', res.lists.join('|'), 'Movies to see|Gift ideas');
  check('list order as in the add-on', (await window.rf.meta()).todoLists.join('|'), "To-Do's|Errands|Home|Movies to see|Gift ideas");
  check('add-on items on their lists', (await byTitle('Back up photos')).map((d) => d.list).sort().join('|'), "Home|To-Do's");
  const again = await window.rf.importPath(`${dataDir}/addon-profile/reminderfox/reminderfox.ics`);
  check('importing again adds no lists', `${again.added} ${again.lists.length}`, '0 0');
  // ---------- the dropdown and an empty list
  await R.setTab('todos'); await sleep(500);
  await R.showList('Movies to see'); await sleep(500);
  check('empty list message', document.querySelector('#listView .empty h3').textContent, '“Movies to see” is empty');
  check('item actions disabled with nothing selected', act('dup').disabled, true);
  // add an item to this list with ＋ To-Do
  $('addTodo').click(); await sleep(400);
  check('editor list', $('edList').value, 'Movies to see');
  $('edSummary').value = 'Dune Part Two'; $('edSave').click(); await sleep(900);
  check('added to the list', titles().join('|'), 'Dune Part Two');
  // ---------- duplicate: toolbar, Ctrl+D, menu
  rowOf('Dune Part Two').click(); await sleep(200);
  check('item actions enabled when selected', act('dup').disabled, false);
  act('dup').click(); await sleep(900);
  check('toolbar duplicate', titles().sort().join('|'), 'Dune Part Two|Dune Part Two (copy)');
  rowOf('Dune Part Two').click(); await sleep(200);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true })); await sleep(900);
  check('Ctrl+D duplicates', titles().filter((t) => t === 'Dune Part Two (copy)').length, 2);
  await ctxOn(rowOf('Dune Part Two'));
  check('menu has Duplicate, Move and Copy', ['dup', 'list', 'copy'].every((a) => document.querySelector(`#ctx button[data-ctx=${a}]`)), true);
  document.querySelector('#ctx button[data-ctx=dup]').click(); await sleep(900);
  check('menu duplicate', titles().length, 4);
  // a duplicate keeps the whole item: repeat, alarm, notes, category, star
  const plants = (await byTitle('Water the plants'))[0];
  const pc = await R.duplicate(plants);
  const pcd = await window.rf.get(pc);
  for (const k of ['repeatText', 'notes', 'important', 'list']) check(`duplicate keeps ${k}`, JSON.stringify(pcd[k]), JSON.stringify(plants[k]));
  check('duplicate keeps the categories and alarm', JSON.stringify([pcd.categories, pcd.alarm]), JSON.stringify([plants.categories, plants.alarm]));
  check('duplicate title', pcd.summary, 'Water the plants (copy)');
  // ---------- delete from the toolbar
  rowOf('Dune Part Two (copy)').click(); await sleep(200);
  act('del').click(); await sleep(300);
  $('cfFoot').querySelector('.btn.danger').click(); await sleep(900);
  check('toolbar delete', titles().length, 3);
  // ---------- copy to another list (toolbar): the original stays
  rowOf('Dune Part Two').click(); await sleep(200);
  act('copy').click(); await sleep(300);
  check('copy dialog', `${$('mlGo').textContent} ${$('mlSel').value}`, 'Copy Movies to see');
  $('mlSel').value = 'Gift ideas'; $('mlGo').click(); await sleep(900);
  check('original stays after copy', !!rowOf('Dune Part Two'), true);
  check('copy on the other list', (await byTitle('Dune Part Two')).map((d) => d.list).sort().join('|'), 'Gift ideas|Movies to see');
  // ---------- move to another list (toolbar)
  rowOf('Dune Part Two (copy)').click(); await sleep(200);
  act('move').click(); await sleep(300);
  check('move dialog starts on another list', $('mlSel').value !== 'Movies to see', true);
  $('mlSel').value = 'Errands'; $('mlGo').click(); await sleep(900);
  check('moved out (one of the two copies)', titles().filter((t) => t === 'Dune Part Two (copy)').length, 1);
  check('moved in', (await byTitle('Dune Part Two (copy)')).map((d) => d.list).sort().join('|'), 'Errands|Movies to see');
  // ---------- copy a reminder to a list: the reminder stays, a to-do copy goes on the list
  await R.setTab('reminders'); await sleep(300);
  $('remFilter').value = 'all'; $('remFilter').dispatchEvent(new Event('change')); await sleep(500);
  await ctxOn(rowOf('Car service'));
  check('reminder menu offers copy', document.querySelector('#ctx button[data-ctx=copy]').textContent, 'Copy to a list…');
  document.querySelector('#ctx button[data-ctx=copy]').click(); await sleep(300);
  $('mlSel').value = 'Errands'; $('mlGo').click(); await sleep(900);
  check('reminder and to-do copy', (await byTitle('Car service')).map((d) => `${d.kind}:${d.list || ''}`).sort().join('|'), 'event:|todo:Errands');
  // ---------- a new list from the dropdown
  await R.setTab('todos'); await sleep(400);
  $('todoList').value = '__new'; $('todoList').dispatchEvent(new Event('change')); await sleep(400);
  $('atVal').value = 'Groceries'; $('atOk').click(); await sleep(900);
  check('new list shown', `${$('todoList').value} ${titles().length}`, 'Groceries 0');
  check('new list in the dropdown', [...$('todoList').options].some((o) => o.textContent === 'List: Groceries (0)'), true);
  $('todoList').value = '__manage'; $('todoList').dispatchEvent(new Event('change')); await sleep(400);
  check('manage from the dropdown', $('listsDlg').open, true);
  check('dropdown stays on the list', $('todoList').value, 'Groceries');
  // ---------- remove a list together with its to-dos
  $('lsList').querySelector('[data-l="Gift ideas"] [data-a=del]').click(); await sleep(300);
  check('the safe choice has the focus', document.activeElement.textContent, 'Move to “To-Do\'s”');
  $('cfFoot').querySelector('.btn.danger').click(); await sleep(1000);
  check('list and its to-dos deleted', `${(await window.rf.meta()).todoLists.includes('Gift ideas')} ${(await byTitle('Dune Part Two')).length}`, 'false 1');
  $('listsDlg').close();
  // the list being shown survives a restart of the page (remembered)
  check('remembered list', localStorage.getItem('rf.todoList') || localStorage.getItem('todoList') || '', 'Groceries');
} catch (e) { console.log(`E2E ERROR ${e.stack || e}`); }
