// E2E (0.7.0): completed list items leave the Month view and the calendar panel; the import dialog (add or replace,
// duplicates by title and date, a category for imported items).
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
const X = window.__rfx; const R = window.__rf;
try {
  await sleep(600);
  // ---------- completed list items leave the Month view, the mini calendar and the agenda
  const day = RF.dayKey(new Date(Date.now() + 3 * 864e5));
  const uid = await window.rf.save({ kind: 'todo', summary: 'Pick up the cake', date: day, allDay: true, categories: [] });
  await R.refresh(); await R.selectDay(day); await sleep(400);
  const inAgenda = () => [...document.querySelectorAll('.side .item b')].some((b) => b.textContent.includes('Pick up the cake'));
  const inMonth = () => [...document.querySelectorAll('#monthGrid .ev')].some((e) => e.textContent.includes('Pick up the cake'));
  const dot = () => !!document.querySelector(`#mcal .mday[data-day="${day}"] .dot, #mcal .mday[data-day="${day}"].has`);
  check('open item in the agenda', inAgenda(), true);
  await R.setTab('month'); await sleep(500);
  check('open item in the Month view', inMonth(), true);
  await window.rf.complete(uid, true); await sleep(900);
  check('completed item shown in the Month view (Show completed is ticked at start)', inMonth(), true);
  $('mDone').checked = false; $('mDone').dispatchEvent(new Event('change')); await sleep(600);
  check('completed item gone from the Month view when unticked', inMonth(), false);
  $('mDone').checked = true; $('mDone').dispatchEvent(new Event('change')); await sleep(300);
  check('completed item gone from the agenda', inAgenda(), false);
  check('still in its list', (await window.rf.get(uid)).completed, true);
  await R.showList("To-Do's"); await sleep(400);
  check('shown in the list (Show completed)', [...document.querySelectorAll('#listView tbody tr .t')].some((t) => t.textContent === 'Pick up the cake'), true);
  // ---------- import: preview, duplicates skipped, a category added
  const dataDir = (await window.rf.meta()).dataFile.replace(/[\\/][^\\/]+$/, '');
  const file = `${dataDir}/addon-sample.ics`;
  const count0 = (await window.rf.meta()).count;
  const p = X.askImport(file); await sleep(600);
  check('import dialog', $('importDlg').open, true);
  check('preview finds the one duplicate', $('imSummary').textContent, '4 reminders and 2 list items; 1 looks like a duplicate (same title and date as an item you have).');
  $('imCat').value = 'From ReminderFox';
  $('imGo').click(); const r = await p; await sleep(600);
  check('imported, duplicate skipped', `${r.added} ${r.duplicates}`, '5 1');
  check('category on every imported item', (await window.rf.all()).filter((d) => d.categories.includes('From ReminderFox')).length, 5);
  check('category remembered', (await window.rf.meta()).categories.includes('From ReminderFox'), true);
  // the same file again: everything is already here (by UID)
  const p2 = X.askImport(file); await sleep(600);
  check('preview says already here', $('imSummary').textContent.includes('5 already here'), true);
  $('importDlg').close(); check('cancel', await p2, null);
  // a copy with new UIDs: the same titles and dates are found as duplicates
  const copy = (await window.rf.all()).filter((d) => d.categories.includes('From ReminderFox')).slice(0, 2);
  for (const d of copy) await window.rf.remove(d.uid);
  await sleep(300);
  // ---------- replace everything (with a backup first)
  const p3 = X.askImport(file); await sleep(600);
  document.querySelector('input[name=imMode][value=replace]').click(); await sleep(100);
  check('duplicates choice off when replacing', document.querySelector('input[name=imDup]').disabled, true);
  $('imGo').click(); await sleep(400);
  check('asks before replacing', $('cfTitle').textContent, 'Replace everything?');
  check('safe choice focused', document.activeElement.textContent, 'Cancel');
  $('cfFoot').querySelector('.btn.danger').click(); const r3 = await p3; await sleep(800);
  check('replaced', `${(await window.rf.meta()).count} ${r3.replaced && r3.replaced.count > 6}`, '6 true');
  check('backup listed', (await window.rf.backupList()).some((b) => b.kind === 'Saved before an import replaced everything'), true);
  check('items before the import are gone', (await window.rf.all()).some((d) => d.summary === 'Pick up the cake'), false);
  check('count before', count0 > 6, true);
} catch (e) { console.log(`E2E ERROR ${e && e.stack || e}`); }
