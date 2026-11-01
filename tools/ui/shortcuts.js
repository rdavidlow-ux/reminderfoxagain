// E2E (shortcuts): Alt+Shift and a letter, the same in the desktop app and the Thunderbird add-on; the tooltips name them.
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
const press = async (k, mods = { altKey: true, shiftKey: true }) => { (document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', { key: k, code: `Key${k}`, bubbles: true, cancelable: true, ...mods })); await sleep(450); };
const closeAll = async () => { for (const d of document.querySelectorAll('dialog[open]')) d.close(); document.activeElement && document.activeElement.blur && document.activeElement.blur(); await sleep(250); };
try {
  await window.__rf.setTab('reminders'); await sleep(400);
  const TB = document.documentElement.dataset.host === 'thunderbird';
  if (!TB) check('the tooltips name them', [$('addReminder').title, $('addTodo').title, $('search').title].join(' | '), 'New reminder (Alt+Shift+A) | New item in the list being shown (Alt+Shift+O) | Search (Alt+Shift+K)');
  const open = (id) => !!$(id) && $(id).open;
  await press('A'); check('Alt+Shift+A: new reminder', `${open('editor')} ${$('edTitle').textContent}`, 'true New reminder'); await closeAll();
  await press('O'); check('Alt+Shift+O: new list item', `${open('editor')} ${$('edTitle').textContent}`, 'true New list item'); await closeAll();
  await press('Q'); check('Alt+Shift+Q: quick alarm', open('quickDlg'), true); await closeAll();
  await press('K'); check('Alt+Shift+K: search', document.activeElement === $('search'), true); await closeAll();
  await press('J'); check('Alt+Shift+J: go to a date', !!document.querySelector('dialog[open]'), true); await closeAll();
  await press('X'); check('Alt+Shift+X: export', open('exportDlg'), true); await closeAll();
  await press('L'); check('Alt+Shift+L: alarms', open('alarmsDlg'), true); await closeAll();
  const side = document.body.classList.contains('no-side');
  await press('B'); check('Alt+Shift+B: calendar panel', document.body.classList.contains('no-side') !== side, true);
  await press('B');
  await press('N', { ctrlKey: true }); check('Ctrl+N no longer does anything', open('editor'), false); await closeAll();
} catch (e) { console.log(`E2E ERROR ${e && e.stack || e}`); }
