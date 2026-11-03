// E2E (the "Terminated or Suspended" list keeps archived items: it can't be renamed or removed, and its items stay out
// of the Reminders list and the Month, Week and Day views); desktop app and Thunderbird add-on.
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
const R = window.__rf;
try {
  const ARCH = 'Terminated or Suspended';
  const key = (d) => RF.dayKey(d);
  const now = new Date();
  const tomorrow = key(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  await window.rf.save({ kind: 'todo', summary: 'Archived: old gym class', list: ARCH, date: tomorrow, time: '10:00', allDay: false });
  await window.rf.save({ kind: 'todo', summary: 'Archived: old magazine', list: ARCH, date: tomorrow, allDay: true });
  await window.rf.save({ kind: 'todo', summary: 'Open: pick up parcel', date: tomorrow, allDay: true });
  await R.refresh(); await sleep(500);
  const seen = (root, t) => [...root.querySelectorAll('.ev,.item,tr[data-key]')].some((e) => e.textContent.includes(t));

  // the views
  await R.setTab('month'); await sleep(600);
  for (const m of ['month', 'week', 'day']) {
    document.querySelector(`#calMode [data-cmode="${m}"]`).click(); await sleep(600);
    await R.selectDay(tomorrow); await sleep(600);
    const box = m === 'month' ? $('monthGrid') : $('calDays');
    check(`${m}: list items show, archived ones don't`, `${seen(box, 'Open: pick up parcel')} ${seen(box, 'Archived: old gym class')} ${seen(box, 'Archived: old magazine')}`, 'true false false');
  }
  document.querySelector('#calMode [data-cmode="month"]').click(); await sleep(500);
  check('the calendar panel\'s day list leaves them out', `${seen($('agenda'), 'Open: pick up parcel')} ${seen($('agenda'), 'Archived: old gym class')}`, 'true false');
  // a Reminders view with list items in it
  await R.setTab('reminders'); await sleep(500);
  $('search').value = 'Archived'; $('search').dispatchEvent(new Event('input')); await sleep(900);
  check('Reminders: not found by a search', seen($('listView'), 'Archived: old'), false);
  $('search').value = ''; $('search').dispatchEvent(new Event('input')); await sleep(900);
  // still on their list
  await R.showList(ARCH); await sleep(700);
  check('the list still shows them', `${seen($('listView'), 'Archived: old gym class')} ${seen($('listView'), 'Archived: old magazine')}`, 'true true');

  // the Lists dialog: no Rename or Remove for it
  window.__rfx.openLists(); await sleep(500);
  const row = $('lsList').querySelector(`[data-l="${ARCH}"]`);
  check('Lists: no Rename… or Remove… for it', `${!!row} ${!!(row && row.querySelector('[data-a=ren]'))} ${!!(row && row.querySelector('[data-a=del]'))}`, 'true false false');
  check('Lists: it says why', row ? row.querySelector('.note[title]').title.includes("can't be renamed or removed") : 'none', true);
  $('listsDlg').close();
  // nor through the host
  let err = '';
  try { await window.rf.renameList(ARCH, 'Old stuff'); } catch (e) { err = String(e && e.message || e); }
  check('renaming it is refused', /can't be renamed/.test(err), true);
  err = '';
  try { await window.rf.removeList(ARCH, { deleteItems: true }); } catch (e) { err = String(e && e.message || e); }
  check('removing it is refused', /can't be removed/.test(err), true);
  const all = await window.rf.all();
  check('its items are still there', all.filter((d) => d.list === ARCH).length, 2);
} catch (e) { console.log(`E2E ERROR ${e && e.stack || e}`); }
