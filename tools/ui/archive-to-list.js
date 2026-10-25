// E2E (0.6.0): no Archive tab. An archive.ics left by an earlier version is moved into the "Terminated or Suspended"
// list on start-up (a copy kept in backups); the list is in the List dropdown, which is now the Lists tab itself.
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
const titles = () => [...document.querySelectorAll('#listView tbody tr .t')].map((t) => t.textContent);
const L = 'Terminated or Suspended';
try {
  await sleep(900);
  const meta = await window.rf.meta();
  check('archive emptied', meta.archiveCount, 0);
  check('moved count', meta.archiveMoved, 2);
  check('new list', meta.todoLists.includes(L), true);
  check('start-up toast', document.querySelector('.toast').firstChild.textContent, `2 archived items moved to the “${L}” list`);
  check('no Archive tab', !!document.querySelector('.tab[data-tab="archive"]'), false);
  check('no archive toolbar', !!$('tbArchive'), false);
  const gym = (await window.rf.all()).find((d) => d.summary === 'Gym membership payment');
  check('reminder is now a list item', `${gym.kind} ${gym.list}`, `todo ${L}`);
  check('keeps its repeat, category and alarm', `${gym.repeatText} | ${gym.categories.join(',')} | ${!!gym.alarm}`, 'Monthly on day 5 | Bills | true');
  check('archive marks gone', `${gym.archivedAt} ${gym.archiveReason}`, 'null ');
  const deck = (await window.rf.all()).find((d) => d.summary === 'Renovate the deck');
  check('to-do moved to the list', `${deck.kind} ${deck.list} ${deck.notes}`, `todo ${L} On hold until spring`);
  check('backup of the archive kept', (await window.rf.backupList()).some((b) => b.kind === 'The archive, before it became a list' && b.items + b.archived === 2), true);
  // the toast's Show opens the list
  document.querySelector('.toast .toast-act').click(); await sleep(700);
  check('Lists tab selected', document.querySelector('.tab[aria-selected="true"]').dataset.tab, 'todos');
  check('dropdown on the list', $('todoList').value, L);
  check('its items', titles().sort().join('|'), 'Gym membership payment|Renovate the deck');
  // the dropdown sits in the tab bar
  check('dropdown is the Lists tab', $('todoList').closest('.tab').dataset.tab, 'todos');
  check('no List dropdown in the toolbar', !!$('tbTodos').querySelector('select#todoList'), false);
  check('top bar button', $('addTodo').textContent.replace(/\s+/g, ' ').trim(), '＋ List Item');
  check('context menu has no archive', await (async () => {
    const tr = document.querySelector('#listView tbody tr'); const r = tr.getBoundingClientRect();
    tr.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: r.left + 300, clientY: r.top + 10 })); await sleep(300);
    const has = !!document.querySelector('#ctx button[data-ctx=arch]'); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return has;
  })(), false);
  // from another tab, opening the dropdown goes back to the Lists tab
  await window.__rf.setTab('reminders'); await sleep(400);
  $('todoList').dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); await sleep(500);
  check('opening the dropdown shows the list', `${window.__rf.S.tab} ${titles().length}`, 'todos 2');
  // picking another list in the dropdown
  $('todoList').value = "To-Do's"; $('todoList').dispatchEvent(new Event('change')); await sleep(500);
  check('picked list shown', titles().includes('Renovate the deck'), false);
  // a restart finds nothing more to move
  check('editor has no archive button', !!$('edArchive'), false);
} catch (e) { console.log(`E2E ERROR ${e && e.stack || e}`); }
